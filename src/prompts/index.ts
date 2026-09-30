import type { Mode } from "../config/mode";
import type { ToolId } from "../config/tools";
import { ABSCHLUSS_PROMPT, ABSCHLUSS_SCHREIBEN_PROMPT } from "./abschluss";
import { FRAGESTELLUNG_PROMPT, FRAGESTELLUNG_SCHREIBEN_PROMPT } from "./fragestellung";
import { QUELLENSUCHE_PROMPT } from "./quellensuche";
import { QUELLENKRITIK_PROMPT, QUELLENKRITIK_SCHREIBEN_PROMPT } from "./quellenkritik";
import { ROTER_FADEN_PROMPT, ROTER_FADEN_SCHREIBEN_PROMPT } from "./roter-faden";

type FixedTool = Exclude<ToolId, "kolloquium" | "schreibassistent">;

// Kolloquium und Schreibassistent bauen ihren Prompt je nach Auswahl selbst (siehe kolloquium.ts, schreibassistent.ts).
export const SYSTEM_PROMPTS: Record<Mode, Record<FixedTool, string>> = {
  sparring: {
    fragestellung: FRAGESTELLUNG_PROMPT,
    quellenkritik: QUELLENKRITIK_PROMPT,
    "roter-faden": ROTER_FADEN_PROMPT,
    abschluss: ABSCHLUSS_PROMPT,
    quellensuche: QUELLENSUCHE_PROMPT,
  },
  schreiben: {
    fragestellung: FRAGESTELLUNG_SCHREIBEN_PROMPT,
    quellenkritik: QUELLENKRITIK_SCHREIBEN_PROMPT,
    "roter-faden": ROTER_FADEN_SCHREIBEN_PROMPT,
    abschluss: ABSCHLUSS_SCHREIBEN_PROMPT,
    quellensuche: QUELLENSUCHE_PROMPT,
  },
};
