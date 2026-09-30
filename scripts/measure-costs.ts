// Misst Tokens und Kosten pro Tool mit festen Beispieleingaben (ECHTE Anfragen, kostet ein paar Cent).
// Nutzung: npm run measure            (aktuelle Konfiguration)
//          npm run measure -- --vergleich   (zusätzlich Haiku als Vergleich)
// Die Antworten landen in /tmp/measure-out/, damit du die Qualität selbst lesen kannst.
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import { calculateCostMicroCents } from "../src/lib/cost";
import { prepareRequest } from "../src/lib/prepare";

const client = new Anthropic();
const KOLL = { kurzfassung: "Meine Arbeit untersucht, wie stark die Hyperinflation 1923 das Vertrauen der Mittelschicht in die Weimarer Republik beschädigt hat. Ich habe Zeitungsberichte und Tagebücher ausgewertet und komme zu dem Ergebnis, dass der Vertrauensverlust vor allem bei Sparern messbar war.", schwierigkeit: "normal" };
const cases: Array<[string, string, object]> = [
  ["fragestellung", "sparring", { fields: { fach: "Geschichte", thema: "Die Weimarer Republik", fragestellung: "Warum scheiterte die Weimarer Republik?", zeitraum: "5 Monate" } }],
  ["roter-faden", "sparring", { fields: { fragestellung: "Inwiefern trug die Wirtschaftskrise zum Scheitern der Weimarer Republik bei?", gliederung: "1 Einleitung\n2 Die Revolution 1918\n3 Die Hyperinflation 1923\n4 Kunst und Kultur der Zwanziger\n5 Die Weltwirtschaftskrise 1929\n6 Fazit" } }],
  ["quellenkritik", "sparring", { fields: { verwendung: "Beleg für sinkende Weizenerträge in Bayern", text: "Klimawandel und Landwirtschaft in Bayern. Herausgeber: Verband für nachhaltige Landwirtschaft e.V. Stand März 2012. Die Erträge von Weizen werden bis 2050 um 20 Prozent sinken. Die Angabe stammt aus einer Umfrage unter 40 Mitgliedsbetrieben. Wir fordern daher höhere Subventionen für unsere Mitglieder." } }],
  ["kolloquium", "sparring", { fields: KOLL, history: [] }],
  ["kolloquium-feedback", "sparring", { fields: KOLL, finish: true, history: [{ role: "assistant", content: "Woran genau hast du den messbaren Vertrauensverlust festgemacht?" }, { role: "user", content: "Ich habe Zeitungen gelesen, da stand viel drin über Sparer." }] }],
  ["schreibassistent", "schreiben", { fields: { aufgabe: "Einleitung", laenge: "mittel", fragestellung: "Wie stark hat die Hyperinflation 1923 das Vertrauen der Mittelschicht in die Weimarer Republik beschädigt?", inhalt: "- Hyperinflation 1923 machte Ersparnisse wertlos\n- Sparer besonders betroffen\n- ich werte Zeitungsberichte und Tagebücher aus\n- Aufbau: Hintergrund, Quellenanalyse, Fazit", text: "" } }],
];
const ALL: Array<{ name: string; model?: string; thinking?: object }> = [
  { name: "A-basis" },
  { name: "B-ohneDenken", thinking: { type: "between_tools" } },
  { name: "C-haiku", model: "claude-haiku-4-5-20251001" },
];

const variants = ALL.filter((v) => v.name === "A-basis" || (process.argv.includes("--vergleich") && v.name === "C-haiku"));
async function main() {
  fs.mkdirSync("/tmp/measure-out", { recursive: true });
  const only = process.argv.slice(2).find((a) => !a.startsWith("--"));
  console.log("tool | variante | in | out | sichtbare Zeichen | Kosten(Cent)");
  for (const [name, mode, input] of cases) {
    if (only && !name.startsWith(only)) continue;
    const tool = name.startsWith("kolloquium") ? "kolloquium" : name;
    const p = await prepareRequest(tool, { ...input, mode } as never);
    for (const v of variants) {
      const model = (v.model ?? p.model) as never;
      const params: Record<string, unknown> = { model, max_tokens: p.maxTokens, system: p.system, messages: p.messages };
      if (!v.model && p.effort) params.output_config = { effort: p.effort };
      if (v.thinking && !v.model) params.thinking = v.thinking;
      try {
        const r = await client.messages.create(params as never) as Anthropic.Message;
        const text = r.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
        const cost = calculateCostMicroCents(model, r.usage) / 1e6;
        fs.writeFileSync(`/tmp/measure-out/${name}__${v.name}.txt`, text);
        console.log(`${name} | ${v.name} | ${r.usage.input_tokens} | ${r.usage.output_tokens} | ${text.length} | ${cost.toFixed(2)}${r.stop_reason === "max_tokens" ? " (GEKÜRZT)" : ""}`);
      } catch (e) {
        console.log(`${name} | ${v.name} | FEHLER: ${(e as Error).message.slice(0, 120)}`);
      }
    }
  }
}
main();
