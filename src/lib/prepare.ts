import type Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODE, MODES, type Mode } from "../config/mode";
import { ABSCHLUSS_KAPITEL_MIN_BUDGET_CENTS, ABSCHLUSS_KAPITEL_MIN_CHARS, CHAT, CHAT_TOOLS, KOLLOQUIUM, PDF_MIN_BUDGET_CENTS, TOOLS, type ChatToolId, type ToolId } from "../config/tools";
import type { ModelId } from "../config/models";
import { kolloquiumPrompt, type Difficulty } from "../prompts/kolloquium";
import { SYSTEM_PROMPTS } from "../prompts";
import { chatPrompt } from "../prompts/chat";
import { schreibassistentPrompt } from "../prompts/schreibassistent";
import { MICRO_PER_CENT } from "./cost";
import { inspectPdf } from "./pdf";
import { buildUserMessage, clean, InputError } from "./tool-input";
import { ctxGliederung, ctxKapitelAuszuege, ctxQuellenTitel, ctxThema, ctxVollstaendig, kapitelCharCount } from "./work-context";
import type { Work } from "./work";

export interface ToolInput {
  mode?: unknown; // "sparring" (Standard) oder "schreiben"
  fields: unknown;
  history?: unknown; // nur Kolloquium: bisheriger Gesprächsverlauf
  finish?: unknown; // nur Kolloquium: Gespräch beenden
  file?: File | null; // nur Quellenkritik: PDF
  work?: Work | null; // vom SERVER geladen (nie vom Browser): die gespeicherte Seminararbeit
}

export interface PreparedRequest {
  model: ModelId;
  maxTokens: number;
  effort?: "low" | "medium" | "high";
  system: string;
  messages: Anthropic.MessageParam[];
  minBudgetMicro: number;
  webSearchMaxUses?: number; // gesetzt = Websuche erlaubt (nur Quellensuche)
}

interface Turn {
  role: "assistant" | "user";
  content: string;
}

interface HistoryLimits {
  maxUserTurns: number;
  maxUserChars: number;
  maxAssistantChars: number;
}
const KOLLOQUIUM_LIMITS: HistoryLimits = { maxUserTurns: KOLLOQUIUM.maxQuestions, maxUserChars: KOLLOQUIUM.maxAnswerChars, maxAssistantChars: KOLLOQUIUM.maxQuestionChars };
const CHAT_LIMITS: HistoryLimits = { maxUserTurns: CHAT.maxUserTurns, maxUserChars: CHAT.maxUserChars, maxAssistantChars: CHAT.maxAssistantChars };

// Prüft den vom Browser geschickten Verlauf: abwechselnd KI/Schüler, Längen und Anzahl begrenzt.
function parseHistory(raw: unknown, limits: HistoryLimits): Turn[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new InputError("Ungültiger Gesprächsverlauf.");
  if (raw.length > limits.maxUserTurns * 2) throw new InputError("Das Gespräch ist zu lang. Bestätige das Ergebnis oder starte neu.");
  const turns: Turn[] = [];
  raw.forEach((t, i) => {
    const expected = i % 2 === 0 ? "assistant" : "user";
    if (typeof t !== "object" || t === null || (t as Turn).role !== expected || typeof (t as Turn).content !== "string") {
      throw new InputError("Ungültiger Gesprächsverlauf.");
    }
    const content = (t as Turn).content.trim();
    const limit = expected === "user" ? limits.maxUserChars : limits.maxAssistantChars;
    if (content === "") throw new InputError("Bitte gib eine Antwort ein.");
    if (content.length > limit) throw new InputError(`Eine Nachricht ist zu lang (maximal ${limit} Zeichen).`);
    turns.push({ role: expected, content });
  });
  if (turns.length % 2 === 1) throw new InputError("Bitte beantworte zuerst die Frage.");
  return turns;
}

function parseMode(raw: unknown): Mode {
  if (raw === undefined || raw === null || raw === "") return DEFAULT_MODE;
  if (typeof raw === "string" && (MODES as readonly string[]).includes(raw)) return raw as Mode;
  throw new InputError("Ungültiger Modus.");
}

export async function prepareRequest(toolId: unknown, input: ToolInput): Promise<PreparedRequest> {
  if (typeof toolId !== "string" || !Object.hasOwn(TOOLS, toolId)) throw new InputError("Unbekanntes Tool.");
  const id = toolId as ToolId;
  const mode = parseMode(input.mode);
  const tool = TOOLS[id];
  // Gespräch: nach der ersten Antwort geht es im Chat weiter (Verlauf kommt vom Browser, wird aber streng geprüft).
  const isChat = (CHAT_TOOLS as readonly string[]).includes(id);
  const chatTurns = isChat ? parseHistory(input.history, CHAT_LIMITS) : [];
  if (!isChat && id !== "kolloquium" && Array.isArray(input.history) && input.history.length > 0) {
    throw new InputError("Dieses Tool hat keinen Gesprächsverlauf.");
  }
  const follow = chatTurns.length > 0;
  const chatify = (p: PreparedRequest): PreparedRequest => (follow ? withChat(p, id as ChatToolId, mode, chatTurns) : p);
  const base = {
    model: tool.model,
    maxTokens: tool.maxTokens,
    effort: tool.effort,
    minBudgetMicro: tool.minBudgetCents * MICRO_PER_CENT,
  };

  const work = input.work ?? null;
  const rawFields =
    typeof input.fields === "object" && input.fields !== null && !Array.isArray(input.fields)
      ? (input.fields as Record<string, unknown>)
      : null;

  if (id === "kolloquium") {
    if (!rawFields) throw new InputError("Bitte fülle das Formular aus.");
    // Kurzfassung aus dem Formular, sonst aus der gespeicherten Arbeit; ohne beides brauchen wir wenigstens Fragestellung und Gliederung.
    let kurz = typeof rawFields.kurzfassung === "string" ? rawFields.kurzfassung.trim() : "";
    if (!kurz && work?.kurzfassung.trim()) kurz = work.kurzfassung.trim();
    if (!kurz && !(work?.fragestellung.trim() && work.gliederung.trim())) {
      throw new InputError("Bitte gib eine Kurzfassung an oder speichere Fragestellung und Gliederung in deiner Seminararbeit.");
    }
    const fields: Record<string, unknown> = { ...rawFields, kurzfassung: kurz };
    const setup = buildUserMessage(tool, fields, [...ctxThema(work), ...ctxGliederung(work), ...ctxQuellenTitel(work, 15)]);
    const difficulty = String(fields.schwierigkeit).trim() as Difficulty; // von buildUserMessage geprüft
    const turns = parseHistory(input.history, KOLLOQUIUM_LIMITS);
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
      ...(!feedback && tool.askModel ? { model: tool.askModel, effort: undefined } : {}),
      maxTokens: feedback
        ? mode === "schreiben"
          ? KOLLOQUIUM.feedbackMaxTokensSchreiben
          : KOLLOQUIUM.feedbackMaxTokens
        : KOLLOQUIUM.questionMaxTokens,
      system: kolloquiumPrompt(difficulty, feedback ? "feedback" : "ask", KOLLOQUIUM.maxQuestions, mode),
      messages,
    };
  }

  if (id === "schreibassistent") {
    if (mode !== "schreiben") throw new InputError("Den Schreibassistenten gibt es nur im Schreibmodus.");
    if (!rawFields) throw new InputError("Bitte fülle das Formular aus.");
    const f: Record<string, unknown> = { ...rawFields };
    const kapitelId = typeof f.kapitelId === "string" ? f.kapitelId.trim() : "";
    const kapitel = kapitelId ? work?.kapitel.find((k) => k.id === kapitelId) : undefined;
    if (kapitelId && !kapitel) throw new InputError("Das gewählte Kapitel gibt es nicht mehr.");
    const aufgabe = typeof f.aufgabe === "string" ? f.aufgabe.trim() : "";
    const hasOwnText = typeof f.text === "string" && f.text.trim() !== "";
    // Beim Überarbeiten eines gewählten Kapitels dient dessen gespeicherter Text als Grundlage.
    if (aufgabe === "Überarbeiten" && kapitel && !hasOwnText && kapitel.text.trim()) {
      if (kapitel.text.length > TOOLS.schreibassistent.fields.find((x) => x.key === "text")!.maxChars) {
        throw new InputError("Das Kapitel ist zu lang für eine Überarbeitung auf einmal. Füge den Abschnitt ein, den du überarbeiten willst.");
      }
      f.text = kapitel.text;
    }
    const extra = [
      ...(kapitel ? [`Kapitel, für das der Text gedacht ist: ${clean(kapitel.titel) || "ohne Titel"}`] : []),
      ...ctxThema(work).filter((l) => !(l.startsWith("Fragestellung der Arbeit") && typeof f.fragestellung === "string" && f.fragestellung.trim())),
      ...ctxGliederung(work),
      ...ctxQuellenTitel(work, 20),
    ];
    const message = buildUserMessage(tool, f, extra); // prüft Auswahlfelder und Längen
    const hasContent = [f.inhalt, f.text].some((v) => typeof v === "string" && v.trim() !== "");
    if (!hasContent) throw new InputError("Bitte gib Stichpunkte oder einen Text an.");
    if (aufgabe === "Überarbeiten" && !(typeof f.text === "string" && f.text.trim())) {
      throw new InputError("Zum Überarbeiten brauche ich deinen vorhandenen Text.");
    }
    return chatify({ ...base, system: schreibassistentPrompt(aufgabe, String(f.laenge).trim()), messages: [{ role: "user", content: message }] });
  }

  if (id === "abschluss") {
    const kapitelId = typeof rawFields?.kapitelId === "string" ? rawFields.kapitelId.trim() : "";
    if (kapitelId) {
      // Nur ein Kapitel im Zusammenhang mit Fragestellung, Gliederung und Quellenliste prüfen
      const kapitel = work?.kapitel.find((k) => k.id === kapitelId);
      if (!work || !kapitel) throw new InputError("Das gewählte Kapitel gibt es nicht mehr.");
      if (kapitel.text.trim().length < ABSCHLUSS_KAPITEL_MIN_CHARS) {
        throw new InputError("Dieses Kapitel ist noch zu kurz für eine Prüfung (mindestens etwa 100 Zeichen).");
      }
      const fokus = typeof rawFields?.fokus === "string" && rawFields.fokus.trim() ? rawFields.fokus.trim() : "alles";
      const message = buildUserMessage(tool, { fokus }, [
        ...ctxThema(work),
        ...ctxGliederung(work),
        ...ctxQuellenTitel(work, 30),
        `Zu prüfen ist nur dieses Kapitel: „${clean(kapitel.titel) || "ohne Titel"}“`,
        clean(kapitel.text),
      ]);
      return chatify({
        ...base,
        minBudgetMicro: ABSCHLUSS_KAPITEL_MIN_BUDGET_CENTS * MICRO_PER_CENT,
        system: SYSTEM_PROMPTS[mode].abschluss,
        messages: [{ role: "user", content: message }],
      });
    }
    if (!work || kapitelCharCount(work) < 200) {
      throw new InputError("Für den Abschluss-Check brauche ich geschriebene Kapitel in deiner Seminararbeit (mindestens etwa 200 Zeichen).");
    }
    const fokus = typeof rawFields?.fokus === "string" && rawFields.fokus.trim() ? rawFields.fokus.trim() : "alles";
    // In Folgerunden liegt der Text der ganzen Arbeit nicht mehr bei (spart viele Tokens): Die erste Analyse genügt als Grundlage.
    const message = buildUserMessage(
      tool,
      { fokus },
      follow ? ["Die ganze Arbeit wurde bereits geprüft (siehe deine erste Antwort). Ihr Text liegt in dieser Gesprächsrunde nicht mehr vor."] : ctxVollstaendig(work),
    ); // prüft die Auswahl
    return chatify({ ...base, system: SYSTEM_PROMPTS[mode].abschluss, messages: [{ role: "user", content: message }] });
  }

  if (id === "quellensuche") {
    const message = buildUserMessage(tool, input.fields, [...ctxThema(work), ...ctxQuellenTitel(work, 30)]);
    return {
      ...base,
      webSearchMaxUses: tool.webSearchMaxUses,
      system: SYSTEM_PROMPTS[mode].quellensuche,
      messages: [{ role: "user", content: message }],
    };
  }

  const system = SYSTEM_PROMPTS[mode][id];

  if (id === "quellenkritik") {
    const text = (input.fields as Record<string, unknown> | null)?.text;
    const hasText = typeof text === "string" && text.trim() !== "";
    const file = input.file ?? null;
    if (file && hasText) throw new InputError("Bitte gib entweder ein PDF oder einen Text an, nicht beides.");
    if (!file && !hasText && !follow) throw new InputError("Bitte lade ein PDF hoch oder füge den Quellentext ein.");
    const ctx = ctxThema(work);
    if (!file) {
      // Folgerunde zu einem PDF: Das Dokument wird nicht erneut gesendet (spart Tokens), die erste Analyse genügt.
      const fields = hasText ? input.fields : { ...(input.fields as object), text: "(Die Quelle liegt in dieser Gesprächsrunde nicht mehr vor. Stütze dich auf deine erste Analyse.)" };
      return chatify({ ...base, system, messages: [{ role: "user", content: buildUserMessage(tool, fields, ctx) }] });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    await inspectPdf(bytes);
    // Das PDF selbst ist nur ein Dokument-Block; die Angabe zur Nutzung steht als Daten im Rahmen.
    const usage = buildUserMessage(tool, { ...(input.fields as object), text: "" }, ctx);
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

  // Rote-Faden-Check: auf Wunsch zusätzlich Anfänge der geschriebenen Kapitel prüfen
  const extra = id === "roter-faden" && rawFields?.mitTexten === "ja" ? ctxKapitelAuszuege(work) : [];
  return chatify({ ...base, system, messages: [{ role: "user", content: buildUserMessage(tool, input.fields, extra) }] });
}

// Hängt den Gesprächsverlauf an die erste Anfrage an (Verlauf endet immer mit einer Nachricht des Schülers).
function withChat(p: PreparedRequest, tool: ChatToolId, mode: Mode, turns: Turn[]): PreparedRequest {
  const users = turns.filter((t) => t.role === "user").length;
  const messages: Anthropic.MessageParam[] = [...p.messages];
  for (const t of turns) {
    messages.push({ role: t.role, content: t.role === "user" ? `<nutzereingabe>\n${clean(t.content)}\n</nutzereingabe>` : t.content });
  }
  return {
    ...p,
    messages,
    system: `${p.system}\n\n${chatPrompt(tool, mode, users >= CHAT.maxUserTurns)}`,
    minBudgetMicro: Math.min(p.minBudgetMicro, CHAT.followMinBudgetCents * MICRO_PER_CENT),
  };
}
