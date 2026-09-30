import { PDFDocument } from "pdf-lib";

export async function makePdf(pages: number): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage();
  const bytes = await doc.save();
  return new Uint8Array(bytes); // eigene Kopie mit normalem ArrayBuffer
}
