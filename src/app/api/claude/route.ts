import { checkAccess } from "@/lib/access";
import { getAnthropic } from "@/lib/anthropic";
import { calculateCostMicroCents, microToCents } from "@/lib/cost";
import { getStore } from "@/lib/store";
import { buildUserMessage, InputError } from "@/lib/tool-input";
import { DAILY_REQUEST_LIMIT, TOOLS, type ToolId } from "@/config/tools";
import { SYSTEM_PROMPTS } from "@/prompts";

export const maxDuration = 60;

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  let body: { code?: unknown; tool?: unknown; fields?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, "Ungültige Anfrage.");
  }

  const store = getStore();
  // Zuerst prüfen, dann erst irgendetwas anderes tun.
  const access = await checkAccess(store, body.code, DAILY_REQUEST_LIMIT);
  if (!access.ok) return json(access.status, access.error);

  const toolId = body.tool as ToolId;
  if (typeof toolId !== "string" || !Object.hasOwn(TOOLS, toolId)) return json(400, "Unbekanntes Tool.");
  const tool = TOOLS[toolId];

  let userMessage: string;
  try {
    userMessage = buildUserMessage(tool, body.fields);
  } catch (err) {
    if (err instanceof InputError) return json(400, err.message);
    throw err;
  }

  const stream = getAnthropic().messages.stream({
    model: tool.model,
    max_tokens: tool.maxTokens,
    system: SYSTEM_PROMPTS[toolId],
    ...(tool.effort ? { output_config: { effort: tool.effort } } : {}),
    messages: [{ role: "user", content: userMessage }],
  });

  const encoder = new TextEncoder();
  let open = true;
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const readable = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      open = false; // Browser hat die Verbindung beendet; wir buchen trotzdem die Kosten.
    },
  });
  const send = (text: string) => {
    if (!open) return;
    try {
      controller.enqueue(encoder.encode(text));
    } catch {
      open = false;
    }
  };

  stream.on("text", send);

  // Auf das erste Lebenszeichen warten: So können wir einen Fehler noch sauber als Fehlermeldung schicken,
  // statt dass die Verbindung mitten in einer "erfolgreichen" Antwort abreißt.
  const first = new Promise<Error | null>((resolve) => {
    stream.once("text", () => resolve(null));
    stream.once("end", () => resolve(null));
    stream.once("error", (e) => resolve(e));
  });

  stream
    .finalMessage()
    .then(async (final) => {
      // Usage steht am Ende des Streams: jetzt Kosten buchen.
      await store.addUsage(access.hash, calculateCostMicroCents(tool.model, final.usage), Date.now());
      if (final.stop_reason === "max_tokens") send("\n\n[Die Antwort wurde wegen des Längenlimits gekürzt.]");
      if (open) controller.close();
    })
    .catch((err) => {
      console.error("Claude-Anfrage fehlgeschlagen:", err instanceof Error ? err.message : err);
      if (open) controller.error(err);
    });

  const failure = await first;
  if (failure) {
    console.error("Claude nicht erreichbar:", failure.message);
    return json(502, "Die KI ist gerade nicht erreichbar. Bitte versuche es in ein paar Minuten noch einmal.");
  }

  const restCent = microToCents(access.record.budgetMicro - access.record.costMicro);
  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Restbudget-Cent": restCent.toFixed(2),
    },
  });
}
