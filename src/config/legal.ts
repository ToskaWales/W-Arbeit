// Angaben zum Betreiber für Impressum und Datenschutzerklärung.
// Sie stehen bewusst NICHT im Code, sondern in Umgebungsvariablen (lokal .env.local, auf Vercel unter Settings).
export const PLACEHOLDER = "[BITTE AUSFÜLLEN]";

export interface LegalInfo {
  name: string;
  addressLines: string[];
  email: string;
  phone: string | null;
  redisRegion: string;
}

export function getLegalInfo(env: Record<string, string | undefined> = process.env): LegalInfo {
  const get = (key: string) => env[key]?.trim() || PLACEHOLDER;
  return {
    name: get("LEGAL_NAME"),
    // Zeilen der Anschrift mit | trennen, z. B. "Musterstraße 1|80331 München"
    addressLines: get("LEGAL_ADDRESS").split("|").map((l) => l.trim()).filter(Boolean),
    email: get("LEGAL_EMAIL"),
    phone: env.LEGAL_PHONE?.trim() || null, // freiwillig
    redisRegion: get("UPSTASH_REGION"),
  };
}

export function hasPlaceholders(info: LegalInfo): boolean {
  return [info.name, info.email, info.redisRegion, ...info.addressLines].some((v) => v.includes(PLACEHOLDER));
}
