import { db, ensureDbInitialized } from "@/db";
import {
  users,
  problems,
  daily_challenges,
  solutions,
  badges,
  user_badges,
} from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import {
  fetchUserAcSubmissions,
  fetchSubmissionDetails,
} from "@/lib/leetcode";
import { getDifficultyPoints } from "@/lib/utils";

export interface SyncResultSummary {
  date: string;
  checkedUsers: number;
  newSolutionsCount: number;
  newSolutions: Array<{
    username: string;
    displayName: string;
    problemTitle: string;
    difficulty: string;
    pointsAdded: number;
  }>;
  errors: string[];
}

/**
 * Verifies missing solutions for a given YYYY-MM-DD (UTC) date across all users.
 * Queries /{username}/acSubmission and GET /submission/{submissionId}.
 */
export async function syncSolutionsForDate(
  dateStr: string
): Promise<SyncResultSummary> {
  await ensureDbInitialized();

  const summary: SyncResultSummary = {
    date: dateStr,
    checkedUsers: 0,
    newSolutionsCount: 0,
    newSolutions: [],
    errors: [],
  };

  // 1. Fetch daily challenges for dateStr with problem metadata
  const challengesWithProblems = await db
    .select({
      challengeId: daily_challenges.id,
      date: daily_challenges.date,
      slotDifficulty: daily_challenges.difficulty,
      problemId: problems.id,
      title: problems.title,
      titleSlug: problems.titleSlug,
      problemDifficulty: problems.difficulty,
    })
    .from(daily_challenges)
    .innerJoin(problems, eq(daily_challenges.problemId, problems.id))
    .where(eq(daily_challenges.date, dateStr));

  if (challengesWithProblems.length === 0) {
    return summary;
  }

  const challengeIds = challengesWithProblems.map((c) => c.challengeId);

  // 2. Fetch all users and existing solutions for these challenges
  const allUsers = await db.select().from(users);
  if (allUsers.length === 0) {
    return summary;
  }

  const existingSolutions = await db
    .select()
    .from(solutions)
    .where(inArray(solutions.challengeId, challengeIds));

  const solvedSet = new Set(
    existingSolutions.map((s) => `${s.userId}:${s.challengeId}`)
  );

  // Start of dateStr in UTC (unix seconds) - allow a 12-hour grace buffer before UTC midnight for timezone flexibility
  const dayStartTimestampSec =
    Math.floor(new Date(`${dateStr}T00:00:00.000Z`).getTime() / 1000) -
    12 * 3600;

  // 3. For each user missing at least one challenge from dateStr, query the LeetCode API
  for (const user of allUsers) {
    const missingChallenges = challengesWithProblems.filter(
      (c) => !solvedSet.has(`${user.id}:${c.challengeId}`)
    );

    if (missingChallenges.length === 0) {
      continue;
    }

    summary.checkedUsers += 1;

    try {
      const acSubmissions = await fetchUserAcSubmissions(user.username, 25);

      for (const challenge of missingChallenges) {
        // Find matching Accepted submission for this problem
        const matchingSub = acSubmissions.find((sub) => {
          if (sub.titleSlug !== challenge.titleSlug) return false;
          const subTs = Number(sub.timestamp);
          if (!Number.isFinite(subTs) || subTs <= 0) return true;
          return subTs >= dayStartTimestampSec;
        });

        if (!matchingSub) continue;

        // Fetch submission code & language from GET /submission/{submissionId}
        const details = await fetchSubmissionDetails(
          matchingSub.id,
          matchingSub.lang
        );

        const solvedAtSec = Number(matchingSub.timestamp);
        const solvedAtDate =
          Number.isFinite(solvedAtSec) && solvedAtSec > 0
            ? new Date(solvedAtSec * 1000)
            : new Date();

        const points = getDifficultyPoints(challenge.slotDifficulty);

        // Save solution and update user's totalScore
        await db.insert(solutions).values({
          userId: user.id,
          challengeId: challenge.challengeId,
          solvedAt: solvedAtDate,
          language: details.language ?? matchingSub.lang ?? "unknown",
          code: details.code,
        });

        await db
          .update(users)
          .set({
            totalScore: sql`${users.totalScore} + ${points}`,
          })
          .where(eq(users.id, user.id));

        solvedSet.add(`${user.id}:${challenge.challengeId}`);
        summary.newSolutionsCount += 1;
        summary.newSolutions.push({
          username: user.username,
          displayName: user.displayName,
          problemTitle: challenge.title,
          difficulty: challenge.slotDifficulty,
          pointsAdded: points,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown API error";
      summary.errors.push(`${user.username}: ${message}`);
    }
  }

  return summary;
}

/**
 * Evaluates user streaks for a completed day (typically yesterdayUTC).
 * Min 1 solution on dateStr -> currentStreak += 1 (and update longestStreak).
 * 0 solutions on dateStr -> currentStreak = 0.
 */
export async function evaluateStreaksForDate(dateStr: string): Promise<{
  incremented: number;
  reset: number;
}> {
  await ensureDbInitialized();

  const dayChallenges = await db
    .select({ id: daily_challenges.id })
    .from(daily_challenges)
    .where(eq(daily_challenges.date, dateStr));

  const allUsers = await db.select().from(users);
  if (allUsers.length === 0 || dayChallenges.length === 0) {
    return { incremented: 0, reset: 0 };
  }

  const challengeIds = dayChallenges.map((c) => c.id);
  const daySolutions = await db
    .select()
    .from(solutions)
    .where(inArray(solutions.challengeId, challengeIds));

  const usersWithSolutions = new Set(daySolutions.map((s) => s.userId));

  let incremented = 0;
  let reset = 0;

  for (const user of allUsers) {
    if (usersWithSolutions.has(user.id)) {
      const nextStreak = user.currentStreak + 1;
      const nextLongest = Math.max(user.longestStreak, nextStreak);
      await db
        .update(users)
        .set({
          currentStreak: nextStreak,
          longestStreak: nextLongest,
        })
        .where(eq(users.id, user.id));
      incremented += 1;
    } else {
      await db
        .update(users)
        .set({
          currentStreak: 0,
        })
        .where(eq(users.id, user.id));
      reset += 1;
    }
  }

  return { incremented, reset };
}

/**
 * Evaluates badges from the `badges` table for a given date (e.g., yesterdayUTC or todayUTC)
 * and inserts newly unlocked entries into `user_badges`.
 */
export async function evaluateBadgesForDate(
  dateStr: string
): Promise<Array<{ userId: string; badgeCode: string }>> {
  await ensureDbInitialized();

  const allBadges = await db.select().from(badges);
  const allUsers = await db.select().from(users);
  if (allBadges.length === 0 || allUsers.length === 0) {
    return [];
  }

  const existingUserBadges = await db.select().from(user_badges);
  const ownedSet = new Set(
    existingUserBadges.map((ub) => `${ub.userId}:${ub.badgeId}`)
  );

  // Fetch all solutions joined with daily_challenges for comprehensive badge checks
  const allSolutions = await db
    .select({
      id: solutions.id,
      userId: solutions.userId,
      challengeId: solutions.challengeId,
      solvedAt: solutions.solvedAt,
      language: solutions.language,
      date: daily_challenges.date,
      difficulty: daily_challenges.difficulty,
    })
    .from(solutions)
    .innerJoin(
      daily_challenges,
      eq(solutions.challengeId, daily_challenges.id)
    );

  const dayChallenges = await db
    .select()
    .from(daily_challenges)
    .where(eq(daily_challenges.date, dateStr));

  const awarded: Array<{ userId: string; badgeCode: string }> = [];
  const now = new Date();

  for (const user of allUsers) {
    const userAllSolutions = allSolutions.filter((s) => s.userId === user.id);
    const userDaySolutions = userAllSolutions.filter(
      (s) => s.date === dateStr
    );

    for (const badge of allBadges) {
      if (ownedSet.has(`${user.id}:${badge.id}`)) {
        continue;
      }

      let qualifies = false;

      switch (badge.code) {
        case "FIRST_BLOOD": {
          qualifies = userAllSolutions.length >= 1;
          break;
        }
        case "PERFECTIONIST": {
          // Solved all 3 daily challenges on dateStr (or any single day in history)
          const solvedChallengeIdsOnDay = new Set(
            userDaySolutions.map((s) => s.challengeId)
          );
          if (dayChallenges.length >= 3 && solvedChallengeIdsOnDay.size >= 3) {
            qualifies = true;
          } else {
            const byDate = new Map<string, Set<number>>();
            for (const s of userAllSolutions) {
              const set = byDate.get(s.date) ?? new Set<number>();
              set.add(s.challengeId);
              byDate.set(s.date, set);
            }
            for (const set of byDate.values()) {
              if (set.size >= 3) {
                qualifies = true;
                break;
              }
            }
          }
          break;
        }
        case "EARLY_BIRD": {
          // Solved a problem between 04:00 and 08:00 UTC
          qualifies = userAllSolutions.some((s) => {
            const hour = new Date(s.solvedAt).getUTCHours();
            return hour >= 4 && hour < 8;
          });
          break;
        }
        case "NIGHT_OWL": {
          // Solved a problem between 22:00 and 03:59 UTC
          qualifies = userAllSolutions.some((s) => {
            const hour = new Date(s.solvedAt).getUTCHours();
            return hour >= 22 || hour < 4;
          });
          break;
        }
        case "STREAK_3": {
          qualifies = user.currentStreak >= 3 || user.longestStreak >= 3;
          break;
        }
        case "STREAK_7": {
          qualifies = user.currentStreak >= 7 || user.longestStreak >= 7;
          break;
        }
        case "STREAK_30": {
          qualifies = user.currentStreak >= 30 || user.longestStreak >= 30;
          break;
        }
        case "HARD_HITTER": {
          qualifies = userAllSolutions.some((s) => s.difficulty === "Hard");
          break;
        }
        case "POLYGLOT": {
          const langs = new Set(
            userAllSolutions
              .map((s) => s.language?.toLowerCase().trim())
              .filter((l): l is string => Boolean(l && l !== "unknown"))
          );
          qualifies = langs.size >= 3;
          break;
        }
        case "CENTURION": {
          qualifies = user.totalScore >= 100;
          break;
        }
        default: {
          // Custom admin-created badges can match score milestones like SCORE_50
          if (badge.code.startsWith("SCORE_")) {
            const target = Number(badge.code.replace("SCORE_", ""));
            if (Number.isFinite(target) && target > 0) {
              qualifies = user.totalScore >= target;
            }
          }
          break;
        }
      }

      if (qualifies) {
        await db.insert(user_badges).values({
          userId: user.id,
          badgeId: badge.id,
          earnedAt: now,
        });
        ownedSet.add(`${user.id}:${badge.id}`);
        awarded.push({ userId: user.id, badgeCode: badge.code });
      }
    }
  }

  return awarded;
}

/**
 * Draws 3 unique problems for `dateStr` (YYYY-MM-DD),
 * excluding all problemIds ever used in `daily_challenges`.
 *
 * Strategy (Option 2 - Full Top Interview 150 coverage):
 * 1. Tries to pick 1 unused Easy, 1 unused Medium, 1 unused Hard.
 * 2. When a difficulty pool runs out (e.g. Hard after 18 days or Easy after 40 days),
 *    substitutes the slot with an unused Medium problem (or any remaining unused problem),
 *    so all 150 problems are completed across 50 days without any repeats.
 * 3. Only after all 150 problems have been exhausted does it start a new cycle.
 */
export async function drawDailyChallengesForDate(dateStr: string): Promise<{
  alreadyExists: boolean;
  drawn: Array<{ difficulty: string; problemId: number; title: string }>;
}> {
  await ensureDbInitialized();

  const existingForDate = await db
    .select({
      id: daily_challenges.id,
      difficulty: daily_challenges.difficulty,
      problemId: daily_challenges.problemId,
      title: problems.title,
    })
    .from(daily_challenges)
    .innerJoin(problems, eq(daily_challenges.problemId, problems.id))
    .where(eq(daily_challenges.date, dateStr));

  if (existingForDate.length >= 3) {
    return {
      alreadyExists: true,
      drawn: existingForDate.map((e) => ({
        difficulty: e.difficulty,
        problemId: e.problemId,
        title: e.title,
      })),
    };
  }

  const allHistoricalChallenges = await db
    .select({ problemId: daily_challenges.problemId })
    .from(daily_challenges);

  const usedIds = new Set(allHistoricalChallenges.map((c) => c.problemId));
  const allProblems = await db.select().from(problems);

  if (allProblems.length === 0) {
    return { alreadyExists: false, drawn: [] };
  }

  const preferredTargets: Array<"Easy" | "Medium" | "Hard"> = [
    "Easy",
    "Medium",
    "Hard",
  ];
  const slotsNeeded = 3 - existingForDate.length;
  const targetsToFill = preferredTargets.slice(3 - slotsNeeded);

  const drawn: Array<{ difficulty: string; problemId: number; title: string }> =
    [];

  for (const targetDiff of targetsToFill) {
    // 1. Primary choice: unused problem of target difficulty
    let pool = allProblems.filter(
      (p) => p.difficulty === targetDiff && !usedIds.has(p.id)
    );

    // 2. Option 2 fallback: if target difficulty is exhausted, pick an unused Medium problem
    if (pool.length === 0) {
      pool = allProblems.filter(
        (p) => p.difficulty === "Medium" && !usedIds.has(p.id)
      );
    }

    // 3. Any remaining unused problem in database
    if (pool.length === 0) {
      pool = allProblems.filter((p) => !usedIds.has(p.id));
    }

    // 4. If all problems in the database have been used, stop and draw nothing
    if (pool.length === 0) {
      break;
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    const chosen = pool[randomIndex];
    usedIds.add(chosen.id);

    await db.insert(daily_challenges).values({
      problemId: chosen.id,
      date: dateStr,
      difficulty: chosen.difficulty,
    });

    drawn.push({
      difficulty: chosen.difficulty,
      problemId: chosen.id,
      title: chosen.title,
    });
  }

  return {
    alreadyExists: false,
    drawn,
  };
}
