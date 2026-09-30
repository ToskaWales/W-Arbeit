import { createHash, randomInt } from "node:crypto";

// Ohne 0/O/1/I/l, damit sich Codes gut abtippen lassen.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 12;

export function hashCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function normalizeName(name: unknown): string {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Ein Code braucht zwingend einen Namen.");
  }
  return name.trim().slice(0, 80);
}
