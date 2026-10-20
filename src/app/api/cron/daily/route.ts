import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, ensureDbInitialized } from "@/db";
import { system_state } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  syncSolutionsForDate,
  evaluateStreaksForDate,
  evaluateBadgesForDate,
  drawDailyChallengesForDate,
} from "@/lib/sync-engine";
import {
  getTodayUtcDateString,
  getYesterdayUtcDateString,
} from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  logger.info("Received POST /api/cron/daily request");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    logger.warn("Unauthorized POST /api/cron/daily attempt");
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing CRON_SECRET" },
      { status: 401 }
    );
  }

  try {
    await ensureDbInitialized();

    const now = new Date();
    const yesterdayUtc = getYesterdayUtcDateString(now);
    const todayUtc = getTodayUtcDateString(now);

    logger.info("Executing daily cron job steps", {
      yesterdayUtc,
      todayUtc,
    });

    // 1. Failsafe Sync for yesterday (for late submissions before midnight UTC)
    const failsafeSync = await syncSolutionsForDate(yesterdayUtc);

    // 2. Streak Evaluation for yesterday
    const streakEvaluation = await evaluateStreaksForDate(yesterdayUtc);

    // 3. Badge Evaluation for yesterday
    const badgeAwarded = await evaluateBadgesForDate(yesterdayUtc);

    // 4. Draw 3 new Daily Challenges (Easy, Medium, Hard) for today, excluding past IDs
    const dailyDraw = await drawDailyChallengesForDate(todayUtc);

    // Update lastSyncedAt
    await db
      .update(system_state)
      .set({ lastSyncedAt: new Date() })
      .where(eq(system_state.id, 1));

    revalidatePath("/");

    logger.info("Daily cron job completed successfully", {
      yesterdayUtc,
      todayUtc,
      newSolutionsYesterday: failsafeSync.newSolutionsCount,
      streakEvaluation,
      badgesAwardedCount: badgeAwarded.length,
      dailyDrawCount: dailyDraw.drawn.length,
    });

    return NextResponse.json({
      ok: true,
      executedAt: now.toISOString(),
      yesterdayUtc,
      todayUtc,
      steps: {
        failsafeSync,
        streakEvaluation,
        badgeAwarded,
        dailyDraw,
      },
    });
  } catch (err) {
    logger.error("Daily cron job failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
