import type { ToolId } from "../config/tools";
import { FRAGESTELLUNG_PROMPT } from "./fragestellung";

export const SYSTEM_PROMPTS: Record<ToolId, string> = {
  fragestellung: FRAGESTELLUNG_PROMPT,
};
