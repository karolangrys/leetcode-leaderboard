import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import fs from "node:fs";
import path from "node:path";

const dbUrl = process.env.DATABASE_URL || "file:./data/db.sqlite";

// Ensure parent directory exists for local file: URLs
if (dbUrl.startsWith("file:")) {
  const filePath = dbUrl.replace(/^file:/, "");
  const dir = path.dirname(path.resolve(filePath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const client = createClient({
  url: dbUrl,
});

export const db = drizzle(client, { schema });

let initialized = false;

export async function ensureDbInitialized() {
  if (initialized) return;
  try {
    await client.executeMultiple(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        total_score INTEGER DEFAULT 0 NOT NULL,
        current_streak INTEGER DEFAULT 0 NOT NULL,
        longest_streak INTEGER DEFAULT 0 NOT NULL
      );

      CREATE TABLE IF NOT EXISTS problems (
        id INTEGER PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        title_slug TEXT NOT NULL UNIQUE,
        difficulty TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        difficulty TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS solutions (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        challenge_id INTEGER NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
        solved_at INTEGER NOT NULL,
        language TEXT,
        code TEXT
      );

      CREATE TABLE IF NOT EXISTS badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
        earned_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_state (
        id INTEGER PRIMARY KEY DEFAULT 1 NOT NULL,
        last_synced_at INTEGER
      );

      INSERT OR IGNORE INTO system_state (id, last_synced_at) VALUES (1, NULL);
    `);
    initialized = true;
  } catch (err) {
    console.error("Failed to initialize database tables:", err);
  }
}
