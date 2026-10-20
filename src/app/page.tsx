import Link from "next/link";
import { db, ensureDbInitialized } from "@/db";
import {
  users,
  problems,
  daily_challenges,
  solutions,
  badges,
  user_badges,
  system_state,
} from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { getTodayUtcDateString } from "@/lib/utils";
import { drawDailyChallengesForDate } from "@/lib/sync-engine";
import {
  DailyChallenges,
  type DailyChallengeItem,
} from "@/components/daily-challenges";
import {
  DailyStatus,
  type DailyStatusChallenge,
  type DailyStatusSolution,
} from "@/components/daily-status";
import { Leaderboard, type LeaderboardEntry } from "@/components/leaderboard";
import { WallOfFame, type EarnedBadgeItem } from "@/components/wall-of-fame";
import { Code2, Shield, Award, Flame } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureDbInitialized();

  const now = new Date();
  const todayUtc = getTodayUtcDateString(now);

  // Ensure today's 3 daily challenges are drawn if problems exist in DB
  await drawDailyChallengesForDate(todayUtc);

  // Fetch today's daily challenges joined with problems
  const todayChallengesRaw = await db
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
    .where(eq(daily_challenges.date, todayUtc));

  // Fetch all users, badges, user_badges, system_state, problems count, and used problems
  const [
    allUsers,
    allBadges,
    earnedBadgesRaw,
    stateRows,
    allProblemsRows,
    usedProblemsRows,
  ] = await Promise.all([
    db.select().from(users).orderBy(desc(users.totalScore)),
    db.select().from(badges),
    db
      .select({
        id: user_badges.id,
        userId: user_badges.userId,
        userDisplayName: users.displayName,
        username: users.username,
        badgeId: badges.id,
        badgeCode: badges.code,
        badgeName: badges.name,
        badgeDescription: badges.description,
        badgeIcon: badges.icon,
        earnedAt: user_badges.earnedAt,
      })
      .from(user_badges)
      .innerJoin(users, eq(user_badges.userId, users.id))
      .innerJoin(badges, eq(user_badges.badgeId, badges.id))
      .orderBy(desc(user_badges.earnedAt)),
    db.select().from(system_state).where(eq(system_state.id, 1)),
    db.select({ id: problems.id }).from(problems),
    db.select({ problemId: daily_challenges.problemId }).from(daily_challenges),
  ]);

  const usedProblemIdsSet = new Set(usedProblemsRows.map((r) => r.problemId));
  const totalProblemsCount = allProblemsRows.length;
  const remainingProblemsCount = allProblemsRows.filter(
    (p) => !usedProblemIdsSet.has(p.id)
  ).length;

  // Fetch solutions for today's challenges
  const challengeIds = todayChallengesRaw.map((c) => c.challengeId);
  const todaySolutionsRaw =
    challengeIds.length > 0
      ? await db
          .select()
          .from(solutions)
          .where(inArray(solutions.challengeId, challengeIds))
      : [];

  // Map data for components
  const solvedCountByChallenge = new Map<number, number>();
  for (const sol of todaySolutionsRaw) {
    solvedCountByChallenge.set(
      sol.challengeId,
      (solvedCountByChallenge.get(sol.challengeId) ?? 0) + 1
    );
  }

  const dailyChallengeItems: DailyChallengeItem[] = todayChallengesRaw.map(
    (c) => ({
      ...c,
      solvedCount: solvedCountByChallenge.get(c.challengeId) ?? 0,
      totalUsers: allUsers.length,
    })
  );

  const statusChallenges: DailyStatusChallenge[] = todayChallengesRaw.map(
    (c) => ({
      challengeId: c.challengeId,
      slotDifficulty: c.slotDifficulty,
      problemId: c.problemId,
      title: c.title,
      titleSlug: c.titleSlug,
    })
  );

  const statusSolutions: DailyStatusSolution[] = todaySolutionsRaw.map((s) => ({
    solutionId: s.id,
    userId: s.userId,
    challengeId: s.challengeId,
    solvedAt: new Date(s.solvedAt).toISOString(),
    language: s.language,
    code: s.code,
  }));

  const badgeCountByUser = new Map<string, number>();
  for (const eb of earnedBadgesRaw) {
    badgeCountByUser.set(
      eb.userId,
      (badgeCountByUser.get(eb.userId) ?? 0) + 1
    );
  }

  const leaderboardEntries: LeaderboardEntry[] = allUsers.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    totalScore: u.totalScore,
    currentStreak: u.currentStreak,
    longestStreak: u.longestStreak,
    badgesCount: badgeCountByUser.get(u.id) ?? 0,
  }));

  const earnedBadgeItems: EarnedBadgeItem[] = earnedBadgesRaw.map((eb) => ({
    ...eb,
    earnedAt: new Date(eb.earnedAt).toISOString(),
  }));

  const lastSyncedDate = stateRows[0]?.lastSyncedAt
    ? new Date(stateRows[0].lastSyncedAt)
    : null;
  const lastSyncedIso = lastSyncedDate ? lastSyncedDate.toISOString() : null;

  let initialCooldownSeconds = 0;
  if (lastSyncedDate) {
    const elapsed = Math.floor(
      (now.getTime() - lastSyncedDate.getTime()) / 1000
    );
    if (elapsed < 60) {
      initialCooldownSeconds = Math.max(0, 60 - elapsed);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header Navigation */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
              <Code2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight">
                  LeetSquad
                </span>
                <span className="hidden rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-400 sm:inline-flex items-center gap-1">
                  <Flame className="size-3" /> Squad Tracker
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Codzienny trening algorytmów • 2 zadania dziennie (Easy + Medium/Hard) • Ciągły ranking
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <a
              href="#wall-of-fame"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Award className="size-3.5 text-purple-400" />
              <span className="hidden sm:inline">Wall of Fame</span>
            </a>
            <Link
              href="/admin"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Shield className="size-3.5 text-primary" />
              <span>Admin</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8">
        {/* 1. Dzisiejsze Wyzwania (3 Cards: Easy, Medium, Hard) */}
        <DailyChallenges
          date={todayUtc}
          challenges={dailyChallengeItems}
          remainingProblemsCount={remainingProblemsCount}
          totalProblemsCount={totalProblemsCount}
        />

        {/* 2. Daily Status Table (with 60s Sync Cooldown & Code Sharing Modal) */}
        <DailyStatus
          users={allUsers}
          challenges={statusChallenges}
          solutions={statusSolutions}
          initialLastSyncedAt={lastSyncedIso}
          initialCooldownSeconds={initialCooldownSeconds}
        />

        {/* 3. Global Leaderboard */}
        <Leaderboard entries={leaderboardEntries} />

        {/* 4. Wall of Fame (Odznaki) */}
        <WallOfFame earnedBadges={earnedBadgeItems} allBadges={allBadges} />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            <strong>LeetSquad</strong> — Monolityczny tracker wyzwań LeetCode
          </span>
          <span className="font-mono text-[11px]">
            Punktacja: Easy (+1) • Medium (+2) • Hard (+3)
          </span>
        </div>
      </footer>
    </div>
  );
}
