import type Anthropic from "@anthropic-ai/sdk";

// Trenner zwischen Antworttext und Zusatzdaten (echte Suchtreffer). Der Browser schneidet alles ab dem Trenner ab.
export const META_MARKER = "\u001eMETA\u001e";

export interface Treffer {
  titel: string;
  url: string;
  alter: string;
}

// Echte Treffer aus den Suchergebnissen (nicht aus dem Text der KI), damit nur wirklich gefundene Links angeboten werden.
export function searchHits(content: Anthropic.ContentBlock[] | undefined): Treffer[] {
  const seen = new Set<string>();
  const hits: Treffer[] = [];
  for (const block of content ?? []) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const r of block.content) {
      if (!/^https?:\/\//i.test(r.url) || seen.has(r.url)) continue;
      seen.add(r.url);
      hits.push({ titel: (r.title ?? "").slice(0, 300), url: r.url.slice(0, 500), alter: r.page_age ?? "" });
    }
  }
  return hits.slice(0, 15);
}

// Trennt die Antwort vom angehängten Zusatzteil (auch während des Streamens, wenn er noch unvollständig ist).
export function splitMeta(full: string): { text: string; treffer: Treffer[] } {
  const i = full.indexOf(META_MARKER);
  if (i < 0) return { text: full, treffer: [] };
  const text = full.slice(0, i).trimEnd();
  try {
    const meta = JSON.parse(full.slice(i + META_MARKER.length)) as { quellen?: Treffer[] };
    return { text, treffer: Array.isArray(meta.quellen) ? meta.quellen : [] };
  } catch {
    return { text, treffer: [] };
  }
}
