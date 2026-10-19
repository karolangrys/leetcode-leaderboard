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

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
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

  return list
    .map((item: unknown) => {
      const rec = item as Record<string, unknown>;
      return {
        id: String(rec.id ?? ""),
        title: String(rec.title ?? ""),
        titleSlug: String(rec.titleSlug ?? ""),
        timestamp: String(rec.timestamp ?? "0"),
        statusDisplay: rec.statusDisplay ? String(rec.statusDisplay) : "Accepted",
        lang: rec.lang ? String(rec.lang) : undefined,
      };
    })
    .filter((s) => s.id && s.titleSlug);
}

/**
 * Fetches full submission code & language by submissionId
 * Endpoint: GET /submission/{submissionId}
 */
export async function fetchSubmissionDetails(
  submissionId: string,
  fallbackLang?: string
): Promise<SubmissionDetail> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/submission/${encodeURIComponent(submissionId)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
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

    return {
      code: rawCode,
      language: rawLang,
    };
  } catch (err) {
    console.warn(`Could not fetch submission details for ${submissionId}:`, err);
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

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
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
    if (paid) continue; // Skip premium-only problems so everyone in the squad can solve them

    const rawId = Number(
      rec.questionFrontendId ?? rec.frontendQuestionId ?? rec.questionId ?? rec.id
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

    if (Number.isInteger(rawId) && rawId > 0 && title && titleSlug && difficulty) {
      parsed.push({
        id: rawId,
        title,
        titleSlug,
        difficulty,
        paidOnly: false,
      });
    }
  }

  return parsed;
}
