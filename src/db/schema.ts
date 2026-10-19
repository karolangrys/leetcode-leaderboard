import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  totalScore: integer("total_score").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
});

export const problems = sqliteTable("problems", {
  id: integer("id").primaryKey(), // frontendQuestionId
  title: text("title").notNull(),
  titleSlug: text("title_slug").notNull().unique(),
  difficulty: text("difficulty").notNull(), // 'Easy' | 'Medium' | 'Hard'
});

export const daily_challenges = sqliteTable("daily_challenges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  problemId: integer("problem_id")
    .notNull()
    .references(() => problems.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD (UTC)
  difficulty: text("difficulty").notNull(), // 'Easy' | 'Medium' | 'Hard' slot
});

export const solutions = sqliteTable("solutions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  challengeId: integer("challenge_id")
    .notNull()
    .references(() => daily_challenges.id, { onDelete: "cascade" }),
  solvedAt: integer("solved_at", { mode: "timestamp" }).notNull(),
  language: text("language"),
  code: text("code"),
});

export const badges = sqliteTable("badges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
});

export const user_badges = sqliteTable("user_badges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  badgeId: integer("badge_id")
    .notNull()
    .references(() => badges.id, { onDelete: "cascade" }),
  earnedAt: integer("earned_at", { mode: "timestamp" }).notNull(),
});

export const system_state = sqliteTable("system_state", {
  id: integer("id").primaryKey().default(1),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
});

// Aliases for convenient camelCase imports
export const dailyChallenges = daily_challenges;
export const userBadges = user_badges;
export const systemState = system_state;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Problem = typeof problems.$inferSelect;
export type DailyChallenge = typeof daily_challenges.$inferSelect;
export type Solution = typeof solutions.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type UserBadge = typeof user_badges.$inferSelect;
export type SystemState = typeof system_state.$inferSelect;
