import "dotenv/config";
import { db, ensureDbInitialized } from "../src/db";
import {
  solutions,
  user_badges,
  daily_challenges,
  users,
  badges,
  problems,
  system_state,
} from "../src/db/schema";
import { INITIAL_BADGES, TOP_INTERVIEW_150 } from "../src/db/seed-data";
import { drawDailyChallengesForDate } from "../src/lib/sync-engine";
import { getTodayUtcDateString } from "../src/lib/utils";

async function main() {
  console.log("🧹 Resetting LeetSquad database...");
  await ensureDbInitialized();

  // 1. Delete all records in dependency order
  await db.delete(solutions);
  await db.delete(user_badges);
  await db.delete(daily_challenges);
  await db.delete(users);
  await db.delete(badges);
  await db.delete(problems);
  await db.delete(system_state);

  // 2. Re-initialize system_state
  await db.insert(system_state).values({ id: 1, lastSyncedAt: null });

  // 3. Re-seed initial badges
  await db.insert(badges).values(INITIAL_BADGES);

  // 4. Re-seed Top Interview 150 problems
  const chunkSize = 50;
  for (let i = 0; i < TOP_INTERVIEW_150.length; i += chunkSize) {
    const chunk = TOP_INTERVIEW_150.slice(i, i + chunkSize);
    await db.insert(problems).values(
      chunk.map((p) => ({
        id: p.id,
        title: p.title,
        titleSlug: p.titleSlug,
        difficulty: p.difficulty,
      }))
    );
  }

  // 5. Draw 2 fresh daily challenges for today
  const todayUtc = getTodayUtcDateString();
  const drawResult = await drawDailyChallengesForDate(todayUtc);

  console.log(
    `✅ Database reset complete! Seeded ${INITIAL_BADGES.length} badges, ${TOP_INTERVIEW_150.length} problems, and drawn ${drawResult.drawn.length} daily challenges for ${todayUtc}:`,
    drawResult.drawn
      .map((d) => `[${d.difficulty}] #${d.problemId} ${d.title}`)
      .join(", ")
  );
}

main().catch((err) => {
  console.error("❌ Database reset failed:", err);
  process.exit(1);
});
