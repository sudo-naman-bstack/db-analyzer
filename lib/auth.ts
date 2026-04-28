export const COOKIE_NAME = "dba_auth";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

let cachedToken: string | null = null;
let cachedFor: string | null = null;

export async function expectedToken(password: string): Promise<string> {
  if (cachedToken && cachedFor === password) return cachedToken;
  const data = new TextEncoder().encode(`${password}|dealblocker-dashboard|v1`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  cachedToken = hex;
  cachedFor = password;
  return hex;
}

export async function verifyAuthCookie(cookieValue: string | undefined): Promise<boolean> {
  const password = process.env.APP_PASSWORD;
  if (!password) return true; // unset = no auth (local dev)
  if (!cookieValue) return false;
  const expected = await expectedToken(password);
  return cookieValue === expected;
}
