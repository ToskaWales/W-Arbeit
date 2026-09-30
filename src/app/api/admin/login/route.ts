import {
  adminEnabled,
  createSessionToken,
  passwordMatches,
  SESSION_COOKIE,
  SESSION_SECONDS,
} from "@/lib/admin-auth";
import { clientKey } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";

const MAX_ATTEMPTS = 10; // pro IP und 15 Minuten

export async function POST(request: Request) {
  const password = process.env.ADMIN_PASSWORD;
  if (!adminEnabled(password)) {
    return Response.json({ error: "Admin-Bereich ist nicht eingerichtet." }, { status: 503 });
  }

  const attempts = await getStore().bumpCounter(`adminlogin:${clientKey(request)}`, 15 * 60);
  if (attempts > MAX_ATTEMPTS) {
    return Response.json({ error: "Zu viele Versuche. Warte 15 Minuten." }, { status: 429 });
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  if (!passwordMatches(body.password, password)) {
    return Response.json({ error: "Falsches Passwort." }, { status: 401 });
  }

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `${SESSION_COOKIE}=${createSessionToken(password)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`,
    },
  });
}
