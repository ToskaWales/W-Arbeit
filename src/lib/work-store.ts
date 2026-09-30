import { WORK_TTL_SECONDS } from "../config/work";
import { decrypt, encrypt, getEncryptionKey } from "./crypto";
import type { CodeStore } from "./store/types";
import { emptyWork, type Work } from "./work";

const blobKey = (hash: string) => `work:${hash}`;

export class VersionConflict extends Error {
  constructor(public current: Work) {
    super("Version veraltet");
  }
}

// Lädt die Arbeit eines Codes (entschlüsselt). Gibt es noch keine, kommt eine leere zurück.
export async function loadWork(store: CodeStore, hash: string, key = getEncryptionKey()): Promise<Work> {
  const blob = await store.getBlob(blobKey(hash));
  if (!blob) return emptyWork();
  return JSON.parse(decrypt(blob, key, hash)) as Work;
}

// Speichert verschlüsselt. Ist expectedVersion nicht die aktuelle, wird nichts überschrieben (zwei offene Fenster).
export async function saveWork(store: CodeStore, hash: string, work: Work, expectedVersion: number, key = getEncryptionKey(), now = Date.now()): Promise<Work> {
  const current = await loadWork(store, hash, key);
  if (current.version !== expectedVersion) throw new VersionConflict(current);
  const saved: Work = { ...work, version: current.version + 1, updatedAt: now };
  await store.setBlob(blobKey(hash), encrypt(JSON.stringify(saved), key, hash), WORK_TTL_SECONDS);
  return saved;
}

export async function deleteWork(store: CodeStore, hash: string): Promise<void> {
  await store.deleteBlob(blobKey(hash));
}
