import type { ToolId } from "../config/tools";
import { FRAGESTELLUNG_PROMPT } from "./fragestellung";
import { QUELLENKRITIK_PROMPT } from "./quellenkritik";
import { ROTER_FADEN_PROMPT } from "./roter-faden";

// Das Kolloquium hat je nach Schwierigkeit und Phase einen eigenen Prompt (siehe kolloquium.ts).
export const SYSTEM_PROMPTS: Record<Exclude<ToolId, "kolloquium">, string> = {
  fragestellung: FRAGESTELLUNG_PROMPT,
  quellenkritik: QUELLENKRITIK_PROMPT,
  "roter-faden": ROTER_FADEN_PROMPT,
};
