import type { ToolId } from "../config/tools";
import { TEST_PROMPT } from "./test";

export const SYSTEM_PROMPTS: Record<ToolId, string> = {
  test: TEST_PROMPT,
};
