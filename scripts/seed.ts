import "dotenv/config";
import { db, ensureDbInitialized } from "../src/db";
import { badges, problems, system_state } from "../src/db/schema";
import { INITIAL_BADGES, TOP_INTERVIEW_150 } from "../src/db/seed-data";
import { fetchProblemsFromApi, type ApiProblemItem } from "../src/lib/leetcode";
import { drawDailyChallengesForDate } from "../src/lib/sync-engine";
import { getTodayUtcDateString } from "../src/lib/utils";
import { notInArray, sql } from "drizzle-orm";

async function main() {
  console.log("🚀 Starting LeetSquad database seed (Top Interview 150)...");
  await ensureDbInitialized();

  // 1. Initialize system_state single row
  await db
    .insert(system_state)
    .values({ id: 1, lastSyncedAt: null })
    .onConflictDoNothing();
  console.log("✅ system_state initialized.");

  // 2. Seed initial badges
  for (const badge of INITIAL_BADGES) {
    await db
      .insert(badges)
      .values(badge)
      .onConflictDoUpdate({
        target: badges.code,
        set: {
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
        },
      });
  }
  console.log(`✅ Seeded ${INITIAL_BADGES.length} badges.`);

  // 3. Prepare Top Interview 150 problems
  const top150SlugMap = new Map<string, ApiProblemItem>(
    TOP_INTERVIEW_150.map((p) => [p.titleSlug, p])
  );

  try {
    const apiProblems = await fetchProblemsFromApi(3000);
    for (const apiProb of apiProblems) {
      if (top150SlugMap.has(apiProb.titleSlug)) {
        top150SlugMap.set(apiProb.titleSlug, apiProb);
      }
    }
    console.log(
      "📡 Synchronized Top Interview 150 metadata with local alfa-leetcode-api."
    );
  } catch {
    console.log(
      "📦 Using built-in Top Interview 150 problem set (https://leetcode.com/studyplan/top-interview-150/)."
    );
  }

  const problemItems = Array.from(top150SlugMap.values());
  const validIds = problemItems.map((p) => p.id);

  // Remove any previously seeded problems outside Top Interview 150
  await db.delete(problems).where(notInArray(problems.id, validIds));

  // Batch upsert all 150 problems
  const chunkSize = 50;
  for (let i = 0; i < problemItems.length; i += chunkSize) {
    const chunk = problemItems.slice(i, i + chunkSize);
    await db
      .insert(problems)
      .values(
        chunk.map((p) => ({
          id: p.id,
          title: p.title,
          titleSlug: p.titleSlug,
          difficulty: p.difficulty,
        }))
      )
      .onConflictDoUpdate({
        target: problems.id,
        set: {
          title: sql`excluded.title`,
          titleSlug: sql`excluded.title_slug`,
          difficulty: sql`excluded.difficulty`,
        },
      });
  }

  const easyCount = problemItems.filter((p) => p.difficulty === "Easy").length;
  const mediumCount = problemItems.filter(
    (p) => p.difficulty === "Medium"
  ).length;
  const hardCount = problemItems.filter((p) => p.difficulty === "Hard").length;

  console.log(
    `✅ Seeded ${problemItems.length} problems from Top Interview 150 (Easy: ${easyCount}, Medium: ${mediumCount}, Hard: ${hardCount}).`
  );

  // 4. Ensure today's 3 daily challenges are drawn from Top Interview 150
  const todayUtc = getTodayUtcDateString();
  const drawResult = await drawDailyChallengesForDate(todayUtc);
  if (drawResult.alreadyExists) {
    console.log(
      `ℹ️ Daily challenges for ${todayUtc} (${drawResult.drawn.map((d) => `[${d.difficulty}] #${d.problemId} ${d.title}`).join(", ")}) are ready.`
    );
  } else {
    console.log(
      `🎲 Drawn 3 daily challenges for ${todayUtc}:`,
      drawResult.drawn
        .map((d) => `[${d.difficulty}] #${d.problemId} ${d.title}`)
        .join(", ")
    );
  }

  console.log("🎉 Seed completed successfully!");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
