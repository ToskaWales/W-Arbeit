import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { getLegalInfo, hasPlaceholders } from "../src/config/legal";

const SRC = path.resolve(import.meta.dirname, "../src");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const files = walk(SRC);
const rel = (f: string) => path.relative(SRC, f).replaceAll(path.sep, "/");
const read = (f: string) => fs.readFileSync(f, "utf8");
const routes = files.filter((f) => f.endsWith("/route.ts") && rel(f).startsWith("app/api/"));

describe("Checkliste: Jede Route prüft den Zugang", () => {
  // Neue Routen müssen hier bewusst eingeordnet werden.
  const NUTZER = ["app/api/claude/route.ts", "app/api/session/route.ts", "app/api/work/route.ts"]; // prüfen den Zugangscode
  const ADMIN = ["app/api/admin/codes/route.ts", "app/api/admin/codes/[hash]/route.ts", "app/api/admin/codes/[hash]/work/route.ts"]; // prüfen den Admin-Login
  const OFFEN = ["app/api/admin/login/route.ts", "app/api/admin/logout/route.ts"]; // Login prüft das Passwort, Logout löscht nur das Cookie

  it("kennt alle API-Routen", () => {
    expect(routes.map(rel).sort()).toEqual([...NUTZER, ...ADMIN, ...OFFEN].sort());
  });
  it("Nutzer-Routen prüfen den Zugangscode", () => {
    for (const r of NUTZER) expect(read(path.join(SRC, r))).toMatch(/checkAccess\(|lookupCode\(|authenticateUser\(/);
    expect(read(path.join(SRC, "lib/user-auth.ts"))).toContain("lookupCode(");
  });
  it("jeder Admin-Endpunkt ruft requireAdmin auf, bevor er etwas tut", () => {
    for (const r of ADMIN) {
      const src = read(path.join(SRC, r));
      const handlers = src.match(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g) ?? [];
      const guards = src.match(/requireAdmin\(request\)/g) ?? [];
      expect(handlers.length).toBeGreaterThan(0);
      expect(guards.length).toBe(handlers.length);
    }
  });
  it("der Login prüft das Passwort und begrenzt Versuche", () => {
    const src = read(path.join(SRC, "app/api/admin/login/route.ts"));
    expect(src).toContain("passwordMatches(");
    expect(src).toContain("bumpCounter(");
  });
});

describe("Checkliste: Keine Geheimnisse im Browser-Code", () => {
  const client = files.filter((f) => /\.(ts|tsx)$/.test(f) && read(f).trimStart().startsWith('"use client"'));
  it("gibt es Client-Dateien", () => expect(client.length).toBeGreaterThan(3));
  it("Client-Dateien erwähnen keine Schlüssel und importieren keinen Server-Code", () => {
    for (const f of client) {
      const src = read(f);
      expect(src, rel(f)).not.toMatch(/ANTHROPIC|ADMIN_PASSWORD|KV_REST|UPSTASH_REDIS|LEGAL_/);
      expect(src, rel(f)).not.toMatch(/@\/lib\/(anthropic|store|admin-auth|admin-guard|access|codes|cost)|@\/config\/pricing|@anthropic-ai|@upstash|node:crypto/);
    }
  });
  it("der API-Key wird nur in der Server-Datei anthropic.ts behandelt", () => {
    const users = files.filter((f) => read(f).includes("ANTHROPIC_API_KEY")).map(rel);
    expect(users).toEqual(["lib/anthropic.ts"]); // nur ein Kommentar dort; das SDK liest den Key selbst aus der Umgebung
    expect(read(path.join(SRC, "lib/anthropic.ts"))).toContain('import "server-only"');
  });
  it(".env-Dateien sind ignoriert, .env.example ist erlaubt", () => {
    const ignore = fs.readFileSync(path.resolve(SRC, "../.gitignore"), "utf8");
    expect(ignore).toMatch(/^\.env\*$/m);
    expect(ignore).toMatch(/^!\.env\.example$/m);
    expect(fs.existsSync(path.resolve(SRC, "../.env.example"))).toBe(true);
    expect(fs.readFileSync(path.resolve(SRC, "../.env.example"), "utf8")).toContain("WORK_ENCRYPTION_KEY=");
  });
});

describe("Sicherheits-Header", () => {
  it("setzt die Header für alle Seiten", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*")!;
    const keys = all.headers.map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining(["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy"]));
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe("Betreiberangaben (Impressum/Datenschutz)", () => {
  const full = { LEGAL_NAME: "Max Muster", LEGAL_ADDRESS: "Musterstr. 1|80331 München", LEGAL_EMAIL: "a@b.de", UPSTASH_REGION: "Frankfurt" };
  it("zeigt Platzhalter, solange etwas fehlt", () => {
    expect(hasPlaceholders(getLegalInfo({}))).toBe(true);
    expect(hasPlaceholders(getLegalInfo({ ...full, LEGAL_EMAIL: " " }))).toBe(true);
  });
  it("ist vollständig, wenn alles gesetzt ist; Telefon ist freiwillig", () => {
    const info = getLegalInfo(full);
    expect(hasPlaceholders(info)).toBe(false);
    expect(info.addressLines).toEqual(["Musterstr. 1", "80331 München"]);
    expect(info.phone).toBeNull();
  });
});
