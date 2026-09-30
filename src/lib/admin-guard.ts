import { readCookie, SESSION_COOKIE, verifySessionToken } from "./admin-auth";

// Jeder Admin-Endpunkt ruft das als Erstes auf. Gibt eine Fehlerantwort zurück oder null, wenn alles passt.
export function requireAdmin(request: Request): Response | null {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!verifySessionToken(token, process.env.ADMIN_PASSWORD)) {
    return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  return null;
}
