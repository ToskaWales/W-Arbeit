import type Anthropic from "@anthropic-ai/sdk";
import { KOLLOQUIUM, PDF_MIN_BUDGET_CENTS, TOOLS, type ToolId } from "../config/tools";
import type { ModelId } from "../config/models";
import { kolloquiumPrompt, type Difficulty } from "../prompts/kolloquium";
import { SYSTEM_PROMPTS } from "../prompts";
import { MICRO_PER_CENT } from "./cost";
import { inspectPdf } from "./pdf";
import { buildUserMessage, InputError } from "./tool-input";

export interface ToolInput {
  fields: unknown;
  history?: unknown; // nur Kolloquium: bisheriger Gesprächsverlauf
  finish?: unknown; // nur Kolloquium: Gespräch beenden
  file?: File | null; // nur Quellenkritik: PDF
}

export interface PreparedRequest {
  model: ModelId;
  maxTokens: number;
  effort?: "low" | "medium" | "high";
  system: string;
  messages: Anthropic.MessageParam[];
  minBudgetMicro: number;
}

const clean = (s: string) => s.replace(/</g, "‹").replace(/>/g, "›").trim();

interface Turn {
  role: "assistant" | "user";
  content: string;
}

// Prüft den vom Browser geschickten Verlauf: abwechselnd Frage/Antwort, Längen und Anzahl begrenzt.
function parseHistory(raw: unknown): Turn[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new InputError("Ungültiger Gesprächsverlauf.");
  if (raw.length > KOLLOQUIUM.maxQuestions * 2) throw new InputError("Das Gespräch ist zu lang.");
  const turns: Turn[] = [];
  raw.forEach((t, i) => {
    const expected = i % 2 === 0 ? "assistant" : "user";
    if (typeof t !== "object" || t === null || (t as Turn).role !== expected || typeof (t as Turn).content !== "string") {
      throw new InputError("Ungültiger Gesprächsverlauf.");
    }
    const content = (t as Turn).content.trim();
    const limit = expected === "user" ? KOLLOQUIUM.maxAnswerChars : KOLLOQUIUM.maxQuestionChars;
    if (content === "") throw new InputError("Bitte gib eine Antwort ein.");
    if (content.length > limit) throw new InputError(`Eine Nachricht ist zu lang (maximal ${limit} Zeichen).`);
    turns.push({ role: expected, content });
  });
  if (turns.length % 2 === 1) throw new InputError("Bitte beantworte zuerst die Frage.");
  return turns;
}

export async function prepareRequest(toolId: unknown, input: ToolInput): Promise<PreparedRequest> {
  if (typeof toolId !== "string" || !Object.hasOwn(TOOLS, toolId)) throw new InputError("Unbekanntes Tool.");
  const id = toolId as ToolId;
  const tool = TOOLS[id];
  const base = {
    model: tool.model,
    maxTokens: tool.maxTokens,
    effort: tool.effort,
    minBudgetMicro: tool.minBudgetCents * MICRO_PER_CENT,
  };

  if (id === "kolloquium") {
    const setup = buildUserMessage(tool, input.fields);
    const difficulty = (input.fields as Record<string, string>).schwierigkeit.trim() as Difficulty; // von buildUserMessage geprüft
    const turns = parseHistory(input.history);
    const answered = turns.length / 2; // beantwortete Fragen
    if (turns.length === 0 && input.finish === true) throw new InputError("Das Gespräch hat noch nicht begonnen.");
    // Nach der letzten erlaubten Frage gibt es zwingend das Abschlussfeedback (Limit gilt serverseitig).
    const feedback = turns.length > 0 && (input.finish === true || answered >= KOLLOQUIUM.maxQuestions);
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: setup }];
    for (const t of turns) {
      messages.push({ role: t.role, content: t.role === "user" ? `<nutzereingabe>\n${clean(t.content)}\n</nutzereingabe>` : t.content });
    }
    return {
      ...base,
      maxTokens: feedback ? KOLLOQUIUM.feedbackMaxTokens : KOLLOQUIUM.questionMaxTokens,
      system: kolloquiumPrompt(difficulty, feedback ? "feedback" : "ask", KOLLOQUIUM.maxQuestions),
      messages,
    };
  }

  const system = SYSTEM_PROMPTS[id];

  if (id === "quellenkritik") {
    const text = (input.fields as Record<string, unknown> | null)?.text;
    const hasText = typeof text === "string" && text.trim() !== "";
    const file = input.file ?? null;
    if (file && hasText) throw new InputError("Bitte gib entweder ein PDF oder einen Text an, nicht beides.");
    if (!file && !hasText) throw new InputError("Bitte lade ein PDF hoch oder füge den Quellentext ein.");
    if (!file) return { ...base, system, messages: [{ role: "user", content: buildUserMessage(tool, input.fields) }] };

    const bytes = new Uint8Array(await file.arrayBuffer());
    await inspectPdf(bytes);
    // Das PDF selbst ist nur ein Dokument-Block; die Angabe zur Nutzung steht als Daten im Rahmen.
    const usage = buildUserMessage(tool, { ...(input.fields as object), text: "" });
    return {
      ...base,
      minBudgetMicro: PDF_MIN_BUDGET_CENTS * MICRO_PER_CENT,
      system,
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(bytes).toString("base64") } },
            { type: "text", text: usage },
          ],
        },
      ],
    };
  }

  return { ...base, system, messages: [{ role: "user", content: buildUserMessage(tool, input.fields) }] };
}
