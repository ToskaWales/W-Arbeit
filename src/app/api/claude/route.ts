import { checkAccess } from "@/lib/access";
import { getAnthropic } from "@/lib/anthropic";
import { calculateCostMicroCents, microToCents } from "@/lib/cost";
import { getStore } from "@/lib/store";
import { DAILY_REQUEST_LIMIT, TOOLS, type ToolId } from "@/config/tools";
import { SYSTEM_PROMPTS } from "@/prompts";

export const maxDuration = 60;

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  let body: { code?: unknown; tool?: unknown; input?: unknown };
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

  if (typeof body.input !== "string" || body.input.trim() === "") return json(400, "Bitte gib etwas ein.");
  if (body.input.length > tool.maxInputChars) {
    return json(413, `Die Eingabe ist zu lang (maximal ${tool.maxInputChars} Zeichen).`);
  }

  const stream = getAnthropic().messages.stream({
    model: tool.model,
    max_tokens: tool.maxTokens,
    system: SYSTEM_PROMPTS[toolId],
    ...(tool.effort ? { output_config: { effort: tool.effort } } : {}),
    // Nutzereingabe als Daten markieren (Schutz vor Prompt Injection).
    messages: [{ role: "user", content: `<nutzereingabe>\n${body.input}\n</nutzereingabe>` }],
  });

  const encoder = new TextEncoder();
  const body$ = new ReadableStream({
    async start(controller) {
      let open = true;
      stream.on("text", (text) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          open = false; // Browser hat die Verbindung beendet; wir buchen trotzdem die Kosten.
        }
      });
      try {
        const final = await stream.finalMessage();
        // Usage steht am Ende des Streams: jetzt Kosten buchen.
        await store.addUsage(access.hash, calculateCostMicroCents(tool.model, final.usage), Date.now());
      } catch (err) {
        console.error("Claude-Anfrage fehlgeschlagen:", err instanceof Error ? err.message : err);
        if (open) controller.error(err);
        return;
      }
      if (open) controller.close();
    },
  });

  const restCent = microToCents(access.record.budgetMicro - access.record.costMicro);
  return new Response(body$, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Restbudget-Cent": restCent.toFixed(2),
    },
  });
}
