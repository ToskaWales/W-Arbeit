import { checkAccess } from "@/lib/access";
import { getAnthropic } from "@/lib/anthropic";
import { calculateCostMicroCents, microToCents } from "@/lib/cost";
import { prepareRequest, type ToolInput } from "@/lib/prepare";
import { getStore } from "@/lib/store";
import { InputError } from "@/lib/tool-input";
import { DAILY_REQUEST_LIMIT, PDF_MAX_BYTES } from "@/config/tools";

export const maxDuration = 60;

// Vercel erlaubt ca. 4,5 MB pro Anfrage; etwas Luft für die Formularfelder.
const MAX_BODY_BYTES = PDF_MAX_BYTES + 256 * 1024;

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

async function readBody(request: Request): Promise<{ tool: unknown; input: ToolInput }> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    let fields: unknown;
    try {
      fields = JSON.parse(String(form.get("fields") ?? "null"));
    } catch {
      throw new InputError("Ungültige Anfrage.");
    }
    return { tool: form.get("tool"), input: { fields, file: file instanceof File && file.size > 0 ? file : null } };
  }
  const body = await request.json();
  return { tool: body.tool, input: { fields: body.fields, history: body.history, finish: body.finish } };
}

export async function POST(request: Request) {
  const store = getStore();
  // Zuerst prüfen (Code steht im Header), dann erst den Inhalt einlesen.
  const access = await checkAccess(store, request.headers.get("x-access-code"), DAILY_REQUEST_LIMIT);
  if (!access.ok) return json(access.status, access.error);

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return json(413, "Die Datei ist zu groß.");
  }

  let prepared;
  try {
    const { tool, input } = await readBody(request);
    prepared = await prepareRequest(tool, input);
  } catch (err) {
    if (err instanceof InputError) return json(400, err.message);
    return json(400, "Ungültige Anfrage.");
  }

  const restMicro = access.record.budgetMicro - access.record.costMicro;
  if (restMicro < prepared.minBudgetMicro) {
    return json(402, `Für diese Anfrage braucht dein Budget mindestens ${microToCents(prepared.minBudgetMicro)} Cent. Dein Budget reicht nicht mehr aus.`);
  }

  const stream = getAnthropic().messages.stream({
    model: prepared.model,
    max_tokens: prepared.maxTokens,
    system: prepared.system,
    ...(prepared.effort ? { output_config: { effort: prepared.effort } } : {}),
    messages: prepared.messages,
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
      await store.addUsage(access.hash, calculateCostMicroCents(prepared.model, final.usage), Date.now());
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

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Restbudget-Cent": microToCents(restMicro).toFixed(2),
    },
  });
}
