import type { ToolConfig } from "../config/tools";

export class InputError extends Error {}

// Spitze Klammern werden ersetzt, damit Eingaben den <nutzereingabe>-Rahmen nicht "schließen" können.
const clean = (s: string) => s.replace(/</g, "‹").replace(/>/g, "›").trim();

// Baut die Nachricht an die KI. Alles, was der Nutzer schreibt, steht als Daten im Rahmen <nutzereingabe>.
export function buildUserMessage(tool: ToolConfig, fields: unknown, extraLines: string[] = []): string {
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
    throw new InputError("Bitte fülle das Formular aus.");
  }
  const data = fields as Record<string, unknown>;
  const parts: string[] = [];
  for (const f of tool.fields) {
    const raw = data[f.key];
    const value = typeof raw === "string" ? clean(raw) : "";
    if (f.required && value === "") throw new InputError(`Bitte fülle das Feld „${f.label}“ aus.`);
    if (value && f.options && !f.options.includes(value)) {
      throw new InputError(`Ungültige Auswahl bei „${f.label}“.`);
    }
    if (value.length > f.maxChars) {
      throw new InputError(`„${f.label}“ ist zu lang (maximal ${f.maxChars} Zeichen).`);
    }
    if (value && !f.hidden) parts.push(`${f.label}: ${value}`);
  }
  return frame([...parts, ...extraLines]);
}

// Packt Zeilen in den Daten-Rahmen. Zeilen müssen vorher mit clean() bereinigt sein.
export function frame(lines: string[]): string {
  return `<nutzereingabe>\n${lines.join("\n")}\n</nutzereingabe>`;
}

export { clean };
