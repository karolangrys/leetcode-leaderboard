import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

const dbUrl = process.env.DATABASE_URL || "file:./data/db.sqlite";

if (dbUrl.startsWith("file:")) {
  const filePath = dbUrl.replace(/^file:/, "");
  const dir = path.dirname(path.resolve(filePath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: dbUrl,
  },
});
