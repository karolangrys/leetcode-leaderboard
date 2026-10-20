"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db, ensureDbInitialized } from "@/db";
import {
  users,
  badges,
  problems,
  solutions,
  user_badges,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ADMIN_COOKIE_NAME,
  getExpectedAdminToken,
  verifyAdminToken,
} from "@/lib/auth";
import {
  drawDailyChallengesForDate,
  evaluateBadgesForDate,
} from "@/lib/sync-engine";
import { getTodayUtcDateString } from "@/lib/utils";
import { logger } from "@/lib/logger";

async function requireAdminAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const valid = await verifyAdminToken(token);
  if (!valid) {
    logger.warn("Unauthorized admin action attempt");
    throw new Error("Brak uprawnień administratora.");
  }
}

export async function loginAdmin(
  password: string
): Promise<{ success: boolean; error?: string }> {
  const expectedPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (!password || password !== expectedPassword) {
    logger.warn("Failed admin login attempt (invalid password)");
    return {
      success: false,
      error: "Nieprawidłowe hasło administratora.",
    };
  }

  const token = await getExpectedAdminToken();
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  logger.info("Admin logged in successfully");
  return { success: true };
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  logger.info("Admin logged out");
}

export async function addUserAction(input: {
  username: string;
  displayName: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminAuth();
    await ensureDbInitialized();

    const username = input.username.trim();
    const displayName = input.displayName.trim();

    if (!username || !displayName) {
      return {
        success: false,
        error: "Nazwa użytkownika LeetCode oraz nazwa wyświetlana są wymagane.",
      };
    }

    await db.insert(users).values({
      username,
      displayName,
      totalScore: 0,
      currentStreak: 0,
      longestStreak: 0,
    });

    logger.info("Admin added new user", { username, displayName });
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Błąd podczas dodawania użytkownika.";
    logger.error("Failed to add user", {
      username: input.username,
      error: msg,
    });
    if (msg.includes("UNIQUE")) {
      return {
        success: false,
        error: "Użytkownik o takim nicku LeetCode już istnieje w bazie.",
      };
    }
    return { success: false, error: msg };
  }
}

export async function deleteUserAction(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminAuth();
    await ensureDbInitialized();

    await db.delete(solutions).where(eq(solutions.userId, userId));
    await db.delete(user_badges).where(eq(user_badges.userId, userId));
    await db.delete(users).where(eq(users.id, userId));

    logger.info("Admin deleted user and cascaded records", { userId });
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Nie udało się usunąć użytkownika.";
    logger.error("Failed to delete user", { userId, error: msg });
    return {
      success: false,
      error: msg,
    };
  }
}

export async function saveBadgeAction(input: {
  id?: number;
  code: string;
  name: string;
  description: string;
  icon: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminAuth();
    await ensureDbInitialized();

    const code = input.code.trim().toUpperCase().replace(/\s+/g, "_");
    const name = input.name.trim();
    const description = input.description.trim();
    const icon = input.icon.trim() || "🏅";

    if (!code || !name || !description) {
      return {
        success: false,
        error: "Kod, nazwa oraz opis odznaki są wymagane.",
      };
    }

    if (input.id) {
      await db
        .update(badges)
        .set({ code, name, description, icon })
        .where(eq(badges.id, input.id));
      logger.info("Admin updated badge", { id: input.id, code, name });
    } else {
      await db.insert(badges).values({
        code,
        name,
        description,
        icon,
      });
      logger.info("Admin created badge", { code, name });
    }

    await evaluateBadgesForDate(getTodayUtcDateString());

    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Błąd podczas zapisu odznaki.";
    logger.error("Failed to save badge", { code: input.code, error: msg });
    if (msg.includes("UNIQUE")) {
      return {
        success: false,
        error: "Odznaka o podanym kodzie (code) już istnieje.",
      };
    }
    return { success: false, error: msg };
  }
}

export async function deleteBadgeAction(
  badgeId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminAuth();
    await ensureDbInitialized();

    await db.delete(user_badges).where(eq(user_badges.badgeId, badgeId));
    await db.delete(badges).where(eq(badges.id, badgeId));

    logger.info("Admin deleted badge", { badgeId });
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Nie udało się usunąć odznaki.";
    logger.error("Failed to delete badge", { badgeId, error: msg });
    return {
      success: false,
      error: msg,
    };
  }
}

export async function triggerManualDailyDrawAction(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    await requireAdminAuth();
    const todayUtc = getTodayUtcDateString();
    logger.info("Admin triggered manual daily draw", { todayUtc });
    const res = await drawDailyChallengesForDate(todayUtc);
    revalidatePath("/");
    revalidatePath("/admin");
    if (res.alreadyExists) {
      return {
        success: true,
        message: `Wyzwania na dzień ${todayUtc} są już wylosowane.`,
      };
    }
    if (res.drawn.length === 0) {
      return {
        success: false,
        error:
          "Koniec zadań w puli! Wszystkie zadania zostały już użyte. Dodaj nowe zadania poniżej, aby móc kontynuować losowania.",
      };
    }
    return {
      success: true,
      message: `Wylosowano ${res.drawn.length} nowe wyzwania na dzień ${todayUtc}!`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Błąd losowania zadań.";
    logger.error("Failed manual daily draw", { error: msg });
    return {
      success: false,
      error: msg,
    };
  }
}

export async function addProblemAction(input: {
  id: number;
  title: string;
  titleSlug: string;
  difficulty: "Easy" | "Medium" | "Hard";
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminAuth();
    await ensureDbInitialized();

    const id = Number(input.id);
    const title = input.title.trim();
    const titleSlug = input.titleSlug
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\/leetcode\.com\/problems\//, "")
      .replace(/\/.*$/, "");
    const difficulty = input.difficulty;

    if (!Number.isInteger(id) || id <= 0 || !title || !titleSlug) {
      return {
        success: false,
        error: "Podaj poprawne ID (liczba dodatnia), tytuł oraz slug zadania.",
      };
    }

    await db.insert(problems).values({
      id,
      title,
      titleSlug,
      difficulty,
    });

    logger.info("Admin added new problem to pool", {
      id,
      title,
      titleSlug,
      difficulty,
    });

    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Błąd podczas dodawania zadania.";
    logger.error("Failed to add problem", { id: input.id, error: msg });
    if (msg.includes("UNIQUE")) {
      return {
        success: false,
        error: "Zadanie o takim numerze ID lub slugu już istnieje w bazie.",
      };
    }
    return { success: false, error: msg };
  }
}
