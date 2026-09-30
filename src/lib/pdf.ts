import { PDFDocument } from "pdf-lib";
import { PDF_MAX_BYTES, PDF_MAX_PAGES } from "../config/tools";
import { InputError } from "./tool-input";

// Prüft Größe, Dateityp und Seitenzahl. Gibt die Seitenzahl zurück.
export async function inspectPdf(bytes: Uint8Array): Promise<number> {
  if (bytes.length === 0) throw new InputError("Die Datei ist leer.");
  if (bytes.length > PDF_MAX_BYTES) {
    throw new InputError(`Das PDF ist zu groß (maximal ${PDF_MAX_BYTES / 1024 / 1024} MB).`);
  }
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new InputError("Das ist keine PDF-Datei.");
  }
  let pages: number;
  try {
    pages = (await PDFDocument.load(bytes)).getPageCount();
  } catch {
    throw new InputError("Das PDF konnte nicht gelesen werden (beschädigt oder passwortgeschützt).");
  }
  if (pages > PDF_MAX_PAGES) {
    throw new InputError(`Das PDF hat ${pages} Seiten (maximal ${PDF_MAX_PAGES}). Lade nur die relevanten Seiten hoch.`);
  }
  return pages;
}
