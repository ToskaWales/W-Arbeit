import Link from "next/link";
import { TOOL_CARDS } from "@/config/tool-cards";

export default function Home() {
  return (
    <main>
      <h1 className="mb-1 text-2xl font-semibold">Womit möchtest du üben?</h1>
      <p className="mb-5 text-zinc-600">Wähle ein Tool. Bitte gib keine Namen oder Schulnamen ein.</p>
      <section className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950" aria-label="Hinweis zur KI-Nutzung">
        <h2 className="mb-1 font-semibold">Wichtig für deine Seminararbeit</h2>
        <p>
          Die Tools helfen dir beim Denken, sie schreiben nichts für deine Arbeit. In deiner Seminararbeit erklärst du, dass du sie selbstständig verfasst und alle Hilfsmittel angegeben hast. Wenn du diese Seite benutzt hast, gib das ehrlich an. Frag deine Lehrkraft, wie ihr das an deiner Schule handhabt.
        </p>
      </section>
      <ul className="grid gap-3">
        {TOOL_CARDS.map((t) => (
          <li key={t.id}>
            {t.href ? (
              <Link href={t.href} className="block rounded-lg border border-zinc-300 bg-white p-4 active:bg-zinc-50">
                <h2 className="font-semibold">{t.title}</h2>
                <p className="text-sm text-zinc-600">{t.description}</p>
              </Link>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-zinc-500">
                <h2 className="font-semibold">{t.title} <span className="text-xs font-normal">(kommt bald)</span></h2>
                <p className="text-sm">{t.description}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
