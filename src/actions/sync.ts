"use server";

import { revalidatePath } from "next/cache";
import { db, ensureDbInitialized } from "@/db";
import { system_state } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  syncSolutionsForDate,
  evaluateBadgesForDate,
  type SyncResultSummary,
} from "@/lib/sync-engine";
import { getTodayUtcDateString } from "@/lib/utils";
import { logger } from "@/lib/logger";

const COOLDOWN_SECONDS = 60;

export interface SyncActionResponse {
  success: boolean;
  error?: string;
  cooldownRemaining?: number;
  lastSyncedAt?: string | null;
  summary?: SyncResultSummary;
}

export async function syncLeaderboard(): Promise<SyncActionResponse> {
  await ensureDbInitialized();

  const now = new Date();
  logger.info("Action syncLeaderboard triggered", {
    timestamp: now.toISOString(),
  });

  // 1. Check Server-side Cooldown in system_state
  let [stateRow] = await db
    .select()
    .from(system_state)
    .where(eq(system_state.id, 1));

  if (!stateRow) {
    await db
      .insert(system_state)
      .values({ id: 1, lastSyncedAt: null })
      .onConflictDoNothing();
    [stateRow] = await db
      .select()
      .from(system_state)
      .where(eq(system_state.id, 1));
  }

  if (stateRow?.lastSyncedAt) {
    const elapsedSeconds = Math.floor(
      (now.getTime() - new Date(stateRow.lastSyncedAt).getTime()) / 1000
    );

    if (elapsedSeconds < COOLDOWN_SECONDS) {
      const remaining = Math.max(1, COOLDOWN_SECONDS - elapsedSeconds);
      logger.warn("Action syncLeaderboard rejected due to server cooldown", {
        elapsedSeconds,
        remainingSeconds: remaining,
      });
      return {
        success: false,
        error: `Synchronizacja jest na cooldownie. Spróbuj ponownie za ${remaining}s.`,
        cooldownRemaining: remaining,
        lastSyncedAt: new Date(stateRow.lastSyncedAt).toISOString(),
      };
    }
  }

  // 2. Lock cooldown immediately to prevent race conditions
  await db
    .update(system_state)
    .set({ lastSyncedAt: now })
    .where(eq(system_state.id, 1));

  // 3. Verify missing solutions for today (UTC)
  const todayUtc = getTodayUtcDateString(now);
  const summary = await syncSolutionsForDate(todayUtc);

  // Also evaluate badges for today if new solutions were found
  if (summary.newSolutionsCount > 0) {
    await evaluateBadgesForDate(todayUtc);
  }

  const finishedAt = new Date();
  await db
    .update(system_state)
    .set({ lastSyncedAt: finishedAt })
    .where(eq(system_state.id, 1));

  revalidatePath("/");

  logger.info("Action syncLeaderboard completed", {
    todayUtc,
    checkedUsers: summary.checkedUsers,
    newSolutionsCount: summary.newSolutionsCount,
    errors: summary.errors,
  });

  return {
    success: true,
    cooldownRemaining: COOLDOWN_SECONDS,
    lastSyncedAt: finishedAt.toISOString(),
    summary,
  };
}
