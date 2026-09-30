import type { Metadata } from "next";
import { getLegalInfo } from "@/config/legal";

export const metadata: Metadata = { title: "Impressum" };
export const dynamic = "force-dynamic";

export default function Impressum() {
  const l = getLegalInfo();
  return (
    <main className="space-y-3 leading-relaxed">
      <h1 className="text-2xl font-semibold">Impressum</h1>
      <h2 className="mt-4 text-lg font-semibold">Angaben gemäß § 5 DDG</h2>
      <p>
        {l.name}
        {l.addressLines.map((line) => (
          <span key={line} className="block">{line}</span>
        ))}
      </p>
      <h2 className="mt-4 text-lg font-semibold">Kontakt</h2>
      <p>
        E-Mail: {l.email}
        {l.phone && <span className="block">Telefon: {l.phone}</span>}
      </p>
      <h2 className="mt-4 text-lg font-semibold">Verantwortlich für den Inhalt</h2>
      <p>
        {l.name}, Anschrift wie oben.
      </p>
      <h2 className="mt-4 text-lg font-semibold">Hinweis zur KI</h2>
      <p>
        Die Antworten auf dieser Seite werden von einer künstlichen Intelligenz erzeugt und können Fehler enthalten. Sie ersetzen keine Beratung durch deine Lehrkraft.
      </p>
    </main>
  );
}
