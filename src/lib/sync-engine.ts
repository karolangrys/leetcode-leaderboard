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
import { logger } from "@/lib/logger";

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

  logger.info("Starting syncSolutionsForDate", { dateStr });

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
    logger.warn("No daily challenges found for date", { dateStr });
    return summary;
  }

  logger.info("Loaded daily challenges for sync", {
    dateStr,
    challenges: challengesWithProblems.map((c) => ({
      challengeId: c.challengeId,
      problemId: c.problemId,
      titleSlug: c.titleSlug,
      difficulty: c.slotDifficulty,
    })),
  });

  const challengeIds = challengesWithProblems.map((c) => c.challengeId);

  // 2. Fetch all users and existing solutions for these challenges
  const allUsers = await db.select().from(users);
  if (allUsers.length === 0) {
    logger.info("No users in database to sync", { dateStr });
    return summary;
  }

  const existingSolutions = await db
    .select()
    .from(solutions)
    .where(inArray(solutions.challengeId, challengeIds));

  const solvedSet = new Set(
    existingSolutions.map((s) => `${s.userId}:${s.challengeId}`)
  );

  // Start of dateStr in UTC (unix seconds) - allow a 14-hour grace buffer before UTC midnight for timezone flexibility
  const dayStartTimestampSec =
    Math.floor(new Date(`${dateStr}T00:00:00.000Z`).getTime() / 1000) -
    14 * 3600;

  // 3. For each user missing at least one challenge from dateStr, query the LeetCode API
  for (const user of allUsers) {
    const missingChallenges = challengesWithProblems.filter(
      (c) => !solvedSet.has(`${user.id}:${c.challengeId}`)
    );

    if (missingChallenges.length === 0) {
      logger.info("User already solved all challenges for date", {
        username: user.username,
        dateStr,
      });
      continue;
    }

    summary.checkedUsers += 1;

    logger.info("Checking missing challenges for user", {
      username: user.username,
      missingSlugs: missingChallenges.map((c) => c.titleSlug),
      dayStartUtc: new Date(dayStartTimestampSec * 1000).toISOString(),
    });

    try {
      const acSubmissions = await fetchUserAcSubmissions(user.username, 25);

      for (const challenge of missingChallenges) {
        const slugMatches = acSubmissions.filter(
          (sub) =>
            sub.titleSlug.toLowerCase() === challenge.titleSlug.toLowerCase()
        );

        if (slugMatches.length === 0) {
          logger.info("No AC submission found for challenge slug", {
            username: user.username,
            challengeSlug: challenge.titleSlug,
          });
          continue;
        }

        // Check if any matching submission is within the day window
        const matchingSub = slugMatches.find((sub) => {
          const subTs = Number(sub.timestamp);
          if (!Number.isFinite(subTs) || subTs <= 0) return true;
          return subTs >= dayStartTimestampSec;
        });

        if (!matchingSub) {
          const latestSubTs = Number(slugMatches[0].timestamp);
          logger.warn(
            "Found AC submission for challenge slug, but timestamp is older than challenge day window",
            {
              username: user.username,
              challengeSlug: challenge.titleSlug,
              submissionTimestamp: slugMatches[0].timestamp,
              submissionDateUtc: Number.isFinite(latestSubTs)
                ? new Date(latestSubTs * 1000).toISOString()
                : "unknown",
              requiredAfterUtc: new Date(
                dayStartTimestampSec * 1000
              ).toISOString(),
            }
          );
          continue;
        }

        logger.info("Matched AC submission for daily challenge!", {
          username: user.username,
          challengeSlug: challenge.titleSlug,
          submissionId: matchingSub.id || null,
          lang: matchingSub.lang || null,
          timestamp: matchingSub.timestamp,
        });

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

        logger.info("Saved new solution and updated user score", {
          username: user.username,
          problemTitle: challenge.title,
          difficulty: challenge.slotDifficulty,
          pointsAdded: points,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown API error";
      logger.error("Error syncing user submissions", {
        username: user.username,
        error: message,
      });
      summary.errors.push(`${user.username}: ${message}`);
    }
  }

  logger.info("Finished syncSolutionsForDate", {
    dateStr,
    checkedUsers: summary.checkedUsers,
    newSolutionsCount: summary.newSolutionsCount,
    errorsCount: summary.errors.length,
  });

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
  logger.info("Evaluating streaks for date", { dateStr });

  const dayChallenges = await db
    .select({ id: daily_challenges.id })
    .from(daily_challenges)
    .where(eq(daily_challenges.date, dateStr));

  const allUsers = await db.select().from(users);
  if (allUsers.length === 0 || dayChallenges.length === 0) {
    logger.info("Skipping streak evaluation (no users or challenges)", {
      dateStr,
      usersCount: allUsers.length,
      challengesCount: dayChallenges.length,
    });
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

  logger.info("Completed streak evaluation", { dateStr, incremented, reset });
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
  logger.info("Evaluating badges for date", { dateStr });

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
          const solvedChallengeIdsOnDay = new Set(
            userDaySolutions.map((s) => s.challengeId)
          );
          if (
            dayChallenges.length >= 2 &&
            solvedChallengeIdsOnDay.size >= dayChallenges.length
          ) {
            qualifies = true;
          } else {
            const byDate = new Map<string, Set<number>>();
            for (const s of userAllSolutions) {
              const set = byDate.get(s.date) ?? new Set<number>();
              set.add(s.challengeId);
              byDate.set(s.date, set);
            }
            for (const set of byDate.values()) {
              if (set.size >= 2) {
                qualifies = true;
                break;
              }
            }
          }
          break;
        }
        case "EARLY_BIRD": {
          qualifies = userAllSolutions.some((s) => {
            const hour = new Date(s.solvedAt).getUTCHours();
            return hour >= 4 && hour < 8;
          });
          break;
        }
        case "NIGHT_OWL": {
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
        logger.info("Awarded badge to user", {
          username: user.username,
          badgeCode: badge.code,
        });
      }
    }
  }

  return awarded;
}

/**
 * Draws 2 unique problems for `dateStr` (YYYY-MM-DD):
 * - Slot 1: Easy (fallback to Medium/Hard when Easy pool is exhausted)
 * - Slot 2: Medium or Hard (fallback to any unused problem if exhausted)
 * Excludes all problemIds ever used in `daily_challenges`.
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

  if (existingForDate.length >= 2) {
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
    logger.warn("Cannot draw daily challenges: problems table is empty", {
      dateStr,
    });
    return { alreadyExists: false, drawn: [] };
  }

  const preferredSlots: Array<"EASY" | "MEDIUM_OR_HARD"> = [
    "EASY",
    "MEDIUM_OR_HARD",
  ];
  const slotsNeeded = 2 - existingForDate.length;
  const slotsToFill = preferredSlots.slice(2 - slotsNeeded);

  const drawn: Array<{ difficulty: string; problemId: number; title: string }> =
    [];

  for (const slotType of slotsToFill) {
    let pool =
      slotType === "EASY"
        ? allProblems.filter(
            (p) => p.difficulty === "Easy" && !usedIds.has(p.id)
          )
        : allProblems.filter(
            (p) =>
              (p.difficulty === "Medium" || p.difficulty === "Hard") &&
              !usedIds.has(p.id)
          );

    // Fallback: if preferred difficulty pool is exhausted, pick any remaining unused problem
    if (pool.length === 0) {
      pool = allProblems.filter((p) => !usedIds.has(p.id));
    }

    // If all problems in the database have been used, stop and draw nothing
    if (pool.length === 0) {
      logger.warn("All problems in pool have been exhausted!", { dateStr });
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

  logger.info("Drawn daily challenges for date", {
    dateStr,
    drawnCount: drawn.length,
    drawn,
  });

  return {
    alreadyExists: false,
    drawn,
  };
}
