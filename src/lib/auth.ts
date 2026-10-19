export const ADMIN_COOKIE_NAME = "leetsquad_admin_session";

export async function getExpectedAdminToken(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const encoder = new TextEncoder();
  const data = encoder.encode(`leetsquad-auth:${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyAdminToken(
  token: string | undefined
): Promise<boolean> {
  if (!token) return false;
  const expected = await getExpectedAdminToken();
  return token === expected;
}
