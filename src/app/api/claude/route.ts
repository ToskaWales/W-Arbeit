import { checkAccess } from "@/lib/access";
import { getAnthropic } from "@/lib/anthropic";
import { calculateCostMicroCents, microToCents } from "@/lib/cost";
import { prepareRequest, type ToolInput } from "@/lib/prepare";
import { BLOCKED_MESSAGE, BUSY_MESSAGE, UNAVAILABLE_MESSAGE, clientKey, isBlocked, recordFailure } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";
import { InputError } from "@/lib/tool-input";
import { META_MARKER, searchHits } from "@/lib/meta";
import { loadWork } from "@/lib/work-store";
import type { Work } from "@/lib/work";
import { DAILY_REQUEST_LIMIT, PDF_MAX_BYTES, TOOLS, type ToolId } from "@/config/tools";

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
    return {
      tool: form.get("tool"),
      input: { mode: form.get("mode"), fields, file: file instanceof File && file.size > 0 ? file : null },
    };
  }
  const body = await request.json();
  return { tool: body.tool, input: { mode: body.mode, fields: body.fields, history: body.history, finish: body.finish } };
}

export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    console.error("Unerwarteter Fehler:", err instanceof Error ? err.message : err);
    return json(500, UNAVAILABLE_MESSAGE);
  }
}

async function handle(request: Request) {
  const store = getStore();
  const client = clientKey(request);
  if (await isBlocked(store, "claude", client)) return json(429, BLOCKED_MESSAGE);

  // Zuerst prüfen (Code steht im Header), dann erst den Inhalt einlesen.
  const code = request.headers.get("x-access-code");
  const access = await checkAccess(store, code, DAILY_REQUEST_LIMIT);
  if (!access.ok) {
    if (access.status === 401 && code?.trim()) await recordFailure(store, "claude", client); // Raten bremsen
    return json(access.status, access.error);
  }

  // Immer nur eine Anfrage pro Code gleichzeitig: verhindert, dass parallele Anfragen das Budget überziehen.
  if (!(await store.tryLock(access.hash, 75))) return json(429, BUSY_MESSAGE);
  const unlock = () => store.unlock(access.hash).catch(() => {});
  try {
    return await run(request, access, unlock);
  } catch (err) {
    await unlock();
    throw err;
  }
}

async function run(
  request: Request,
  access: Extract<Awaited<ReturnType<typeof checkAccess>>, { ok: true }>,
  unlock: () => Promise<void>,
) {
  const store = getStore();

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    await unlock();
    return json(413, "Die Datei ist zu groß.");
  }

  let prepared;
  try {
    const { tool, input } = await readBody(request);
    // Die gespeicherte Arbeit lädt der Server selbst (der Browser schickt sie nicht mit und kann sie nicht fälschen).
    let work: Work | null = null;
    let workFailed = false;
    if (typeof tool === "string" && Object.hasOwn(TOOLS, tool) && TOOLS[tool as ToolId].usesWork) {
      try {
        work = await loadWork(store, access.hash);
      } catch (err) {
        workFailed = true;
        console.error("Seminararbeit konnte nicht geladen werden:", err instanceof Error ? err.message : err);
      }
    }
    if (workFailed && tool === "abschluss") {
      await unlock();
      return json(503, "Deine Seminararbeit kann gerade nicht geladen werden. Bitte versuche es später noch einmal.");
    }
    prepared = await prepareRequest(tool, { ...input, work });
  } catch (err) {
    await unlock();
    if (err instanceof InputError) return json(400, err.message);
    return json(400, "Ungültige Anfrage.");
  }

  const restMicro = access.record.budgetMicro - access.record.chargedMicro;
  if (restMicro < prepared.minBudgetMicro) {
    await unlock();
    return json(402, `Für diese Anfrage braucht dein Budget mindestens ${microToCents(prepared.minBudgetMicro)} Cent. Dein Budget reicht nicht mehr aus.`);
  }

  const stream = getAnthropic().messages.stream({
    model: prepared.model,
    max_tokens: prepared.maxTokens,
    system: prepared.system,
    ...(prepared.effort ? { output_config: { effort: prepared.effort } } : {}),
    messages: prepared.messages,
    ...(prepared.webSearchMaxUses
      ? {
          tools: [
            {
              type: "web_search_20250305" as const,
              name: "web_search" as const,
              max_uses: prepared.webSearchMaxUses,
              user_location: { type: "approximate" as const, country: "DE", timezone: "Europe/Berlin" },
            },
          ],
        }
      : {}),
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
      try {
        await store.addUsage(access.hash, calculateCostMicroCents(prepared.model, final.usage), Date.now());
      } finally {
        await unlock();
      }
      if (final.stop_reason === "max_tokens") send("\n\n[Die Antwort wurde wegen des Längenlimits gekürzt.]");
      if (final.stop_reason === "pause_turn") send("\n\n[Die Suche wurde unterbrochen. Bitte versuche es noch einmal.]");
      if (final.stop_reason === "refusal") send("\n\n[Die KI konnte diese Anfrage nicht beantworten. Formuliere sie anders oder wähle einen anderen Ausschnitt.]");
      if (prepared.webSearchMaxUses) send(META_MARKER + JSON.stringify({ quellen: searchHits(final.content) }));
      if (open) controller.close();
    })
    .catch(async (err) => {
      console.error("Claude-Anfrage fehlgeschlagen:", err instanceof Error ? err.message : err);
      await unlock();
      if (open) controller.error(err);
    });

  const failure = await first;
  if (failure) {
    console.error("Claude nicht erreichbar:", failure.message);
    await unlock();
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
