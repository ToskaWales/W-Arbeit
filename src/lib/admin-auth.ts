import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "admin_session";
export const SESSION_SECONDS = 8 * 60 * 60;
export const MIN_PASSWORD_LENGTH = 12;

// Passwort ist nur brauchbar, wenn es gesetzt und lang genug ist. Sonst ist der Admin-Bereich gesperrt.
export function adminEnabled(password: string | undefined): password is string {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function passwordMatches(input: unknown, password: string): boolean {
  return typeof input === "string" && safeEqual(input, password);
}

// Schlüssel hängt am Passwort: Wird das Passwort geändert, sind alle alten Sitzungen ungültig.
function sign(payload: string, password: string): string {
  const key = createHash("sha256").update(`admin-session:${password}`).digest();
  return createHmac("sha256", key).update(payload).digest("hex");
}

export function createSessionToken(password: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + SESSION_SECONDS;
  return `${exp}.${sign(String(exp), password)}`;
}

export function verifySessionToken(token: string | undefined, password: string | undefined, now = Date.now()): boolean {
  if (!token || !adminEnabled(password)) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Math.floor(now / 1000)) return false;
  return safeEqual(sig, sign(exp, password));
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}
