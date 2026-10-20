import { logger } from "@/lib/logger";

export interface AcSubmissionItem {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string; // Unix timestamp in seconds as string
  statusDisplay?: string;
  lang?: string;
}

export interface SubmissionDetail {
  code: string | null;
  language: string | null;
}

export interface ApiProblemItem {
  id: number;
  title: string;
  titleSlug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  paidOnly?: boolean;
}

function getBaseUrl(): string {
  return (process.env.LEETCODE_API_URL || "http://localhost:3001").replace(
    /\/+$/,
    ""
  );
}

/**
 * Fetches recent Accepted submissions for a given LeetCode username
 * Endpoint: GET /{username}/acSubmission
 */
export async function fetchUserAcSubmissions(
  username: string,
  limit = 20
): Promise<AcSubmissionItem[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/${encodeURIComponent(username)}/acSubmission?limit=${limit}`;

  logger.info("Fetching user AC submissions from LeetCode API", {
    username,
    url,
    limit,
  });

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      logger.error("LeetCode API returned non-OK status for acSubmission", {
        username,
        url,
        status: res.status,
        statusText: res.statusText,
        responseBody: bodyText.slice(0, 500),
      });
      throw new Error(
        `LeetCode API error (${res.status}) while fetching acSubmission for ${username}`
      );
    }

    const data = await res.json();
    const list: unknown[] = Array.isArray(data?.submission)
      ? data.submission
      : Array.isArray(data?.recentAcSubmissionList)
        ? data.recentAcSubmissionList
        : Array.isArray(data)
          ? data
          : [];

    // Note: alfa-leetcode-api /{username}/acSubmission often omits `id` in recentAcSubmissionList,
    // so we must NOT filter out items that lack `id`!
    const parsed = list
      .map((item: unknown) => {
        const rec = item as Record<string, unknown>;
        return {
          id: rec.id ? String(rec.id) : "",
          title: String(rec.title ?? ""),
          titleSlug: String(rec.titleSlug ?? "").trim(),
          timestamp: String(rec.timestamp ?? "0"),
          statusDisplay: rec.statusDisplay
            ? String(rec.statusDisplay)
            : "Accepted",
          lang: rec.lang ? String(rec.lang) : undefined,
        };
      })
      .filter((s) => Boolean(s.titleSlug));

    logger.info("Parsed user AC submissions from LeetCode API", {
      username,
      rawCount: list.length,
      parsedCount: parsed.length,
      recentSlugs: parsed.slice(0, 10).map((s) => ({
        slug: s.titleSlug,
        id: s.id || null,
        lang: s.lang || null,
        timestamp: s.timestamp,
      })),
    });

    return parsed;
  } catch (err) {
    logger.error("Failed to fetch user AC submissions", {
      username,
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Fetches full submission code & language by submissionId
 * Endpoint: GET /submission/{submissionId}
 */
export async function fetchSubmissionDetails(
  submissionId: string,
  fallbackLang?: string
): Promise<SubmissionDetail> {
  if (!submissionId) {
    logger.info(
      "Skipping /submission/{id} fetch because submissionId was not provided by acSubmission endpoint",
      { fallbackLang: fallbackLang ?? null }
    );
    return {
      code: null,
      language: fallbackLang ?? null,
    };
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/submission/${encodeURIComponent(submissionId)}`;

  logger.info("Fetching submission details from LeetCode API", {
    submissionId,
    url,
  });

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      logger.warn("LeetCode API returned non-OK status for submission details", {
        submissionId,
        url,
        status: res.status,
        responseBody: bodyText.slice(0, 300),
      });
      return {
        code: null,
        language: fallbackLang ?? null,
      };
    }

    const data = await res.json();
    const details =
      data?.submissionDetails ?? data?.data?.submissionDetails ?? data ?? {};

    const rawCode =
      typeof details?.code === "string"
        ? details.code
        : typeof data?.code === "string"
          ? data.code
          : null;

    const rawLang =
      typeof details?.lang === "string"
        ? details.lang
        : typeof details?.lang?.name === "string"
          ? details.lang.name
          : typeof details?.lang?.verboseName === "string"
            ? details.lang.verboseName
            : typeof data?.lang === "string"
              ? data.lang
              : fallbackLang ?? null;

    logger.info("Fetched submission details result", {
      submissionId,
      hasCode: Boolean(rawCode),
      language: rawLang,
    });

    return {
      code: rawCode,
      language: rawLang,
    };
  } catch (err) {
    logger.warn("Could not fetch submission details", {
      submissionId,
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      code: null,
      language: fallbackLang ?? null,
    };
  }
}

/**
 * Fetches problems list from alfa-leetcode-api
 * Endpoint: GET /problems?limit=3000
 */
export async function fetchProblemsFromApi(
  limit = 3000
): Promise<ApiProblemItem[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/problems?limit=${limit}`;

  logger.info("Fetching problems list from LeetCode API", { url, limit });

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      logger.error("LeetCode API error on /problems", {
        url,
        status: res.status,
      });
      throw new Error(`LeetCode API error (${res.status}) on /problems`);
    }

    const data = await res.json();
    const rawList: unknown[] = Array.isArray(data?.problemsetQuestionList)
      ? data.problemsetQuestionList
      : Array.isArray(data?.questions)
        ? data.questions
        : Array.isArray(data)
          ? data
          : [];

    const parsed: ApiProblemItem[] = [];

    for (const item of rawList) {
      const rec = item as Record<string, unknown>;
      const paid = Boolean(rec.isPaidOnly ?? rec.paidOnly ?? false);
      if (paid) continue;

      const rawId = Number(
        rec.questionFrontendId ??
          rec.frontendQuestionId ??
          rec.questionId ??
          rec.id
      );
      const title = String(rec.title ?? "").trim();
      const titleSlug = String(rec.titleSlug ?? "").trim();
      const diffRaw = String(rec.difficulty ?? "").trim();

      const difficulty: "Easy" | "Medium" | "Hard" | null =
        diffRaw.toLowerCase() === "easy"
          ? "Easy"
          : diffRaw.toLowerCase() === "medium"
            ? "Medium"
            : diffRaw.toLowerCase() === "hard"
              ? "Hard"
              : null;

      if (
        Number.isInteger(rawId) &&
        rawId > 0 &&
        title &&
        titleSlug &&
        difficulty
      ) {
        parsed.push({
          id: rawId,
          title,
          titleSlug,
          difficulty,
          paidOnly: false,
        });
      }
    }

    logger.info("Fetched problems list from LeetCode API", {
      rawCount: rawList.length,
      parsedFreeCount: parsed.length,
    });

    return parsed;
  } catch (err) {
    logger.error("Error fetching problems from LeetCode API", {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
