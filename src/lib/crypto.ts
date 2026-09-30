import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class EncryptionConfigError extends Error {}

// Der Schlüssel kommt aus WORK_ENCRYPTION_KEY (32 Zufallsbytes, base64). Erzeugen: openssl rand -base64 32
export function getEncryptionKey(value: string | undefined = process.env.WORK_ENCRYPTION_KEY): Buffer {
  if (!value) throw new EncryptionConfigError("WORK_ENCRYPTION_KEY fehlt.");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new EncryptionConfigError("WORK_ENCRYPTION_KEY muss 32 Byte (base64) lang sein.");
  return key;
}

// AES-256-GCM. aad bindet den Inhalt an den Besitzer (Code-Hash): Ein vertauschter Datensatz lässt sich nicht entschlüsseln.
export function encrypt(plain: string, key: Buffer, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return "v1." + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64url");
}

export function decrypt(blob: string, key: Buffer, aad: string): string {
  if (!blob.startsWith("v1.")) throw new Error("Unbekanntes Format.");
  const raw = Buffer.from(blob.slice(3), "base64url");
  if (raw.length < 28) throw new Error("Beschädigte Daten.");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
