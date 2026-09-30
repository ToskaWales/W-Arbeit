import type { Metadata } from "next";
import { getLegalInfo } from "@/config/legal";

export const metadata: Metadata = { title: "Datenschutzerklärung" };
export const dynamic = "force-dynamic";

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-5 text-lg font-semibold">{children}</h2>;
}

export default function Datenschutz() {
  const l = getLegalInfo();
  return (
    <main className="space-y-3 leading-relaxed">
      <h1 className="text-2xl font-semibold">Datenschutzerklärung</h1>
      <p>
        Hier erfährst du, welche Daten der W-Seminar-Helfer verarbeitet. Kurz gesagt: Deine <strong>Seminararbeit</strong> speichern wir nur, wenn du sie selbst im Bereich „Meine Seminararbeit“ ablegst, und zwar verschlüsselt. Die Antworten der KI, Gesprächsverläufe im Kolloquium und hochgeladene PDFs speichern wir <strong>nicht</strong>.
      </p>

      <H>1. Verantwortlicher</H>
      <p>
        {l.name}, {l.addressLines.join(", ")}, E-Mail: {l.email}
      </p>

      <H>2. Was der Dienst macht</H>
      <p>
        Der W-Seminar-Helfer bietet Schülerinnen und Schülern feste Werkzeuge, mit denen sie Hilfe für ihre W-Seminararbeit von einer KI bekommen (Fragestellungs-Check, Quellenkritik, Rote-Faden-Check, Kolloquiums-Simulator). Die KI arbeitet je nach gewähltem Modus als Sparringspartner (sie fragt und kritisiert) oder als Schreibhilfe (sie formuliert auch aus). Ob und wie du KI-Hilfe in einer Schularbeit nutzen darfst und angeben musst, regelt deine Schule.
      </p>

      <H>3. Welche Daten wir verarbeiten</H>
      <p><strong>a) Zugangscode und Nutzungsdaten.</strong> Für jeden Zugangscode speichern wir nur: einen Hash des Codes (nicht den Code selbst), den vom Betreiber vergebenen Namen, das Budget, die bisherigen Kosten, die Anzahl der Anfragen sowie die Zeitpunkte der Erstellung und der letzten Nutzung. Zweck ist die Zugangskontrolle und die Begrenzung der Kosten. Rechtsgrundlage: Art. 6 Abs. 1 lit. b und f DSGVO (Bereitstellung des Dienstes, berechtigtes Interesse an Kostenkontrolle und Missbrauchsschutz).</p>
      <p><strong>b) Deine gespeicherte Seminararbeit.</strong> Im Bereich „Meine Seminararbeit“ kannst du Fach, Thema, Fragestellung, Kurzfassung, Gliederung, Kapiteltexte, deine Quellenliste (mit Links, Notizen und Bewertungen), offene Punkte und deinen Fortschritt ablegen. Wir speichern diese Angaben verschlüsselt (AES-256) in unserer Datenbank. Sie sind nur mit deinem Zugangscode abrufbar. Wir lesen sie nicht und werten sie nicht aus. Sie bleiben gespeichert, bis du sie unter „Meine Seminararbeit“ löschst oder wir sie auf deinen Wunsch löschen, spätestens aber 400 Tage nach der letzten Änderung. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des Dienstes). Wer den Zugangscode kennt, kann die Arbeit lesen, gib ihn deshalb nicht weiter.</p>
      <p><strong>c) Eingaben und Antworten.</strong> Was du in die Formulare eingibst (auch hochgeladene PDFs und der Gesprächsverlauf im Kolloquium), wird zusammen mit den Teilen deiner Seminararbeit, die das jeweilige Werkzeug braucht (zum Beispiel Fragestellung, Gliederung oder Kapitel), zur Erzeugung der Antwort an die KI-Firma Anthropic übermittelt. Die Antworten der KI, PDFs und den Gesprächsverlauf speichern wir nicht. Der Gesprächsverlauf im Kolloquium liegt nur in deinem Browser und ist weg, wenn du die Seite neu lädst. Ergebnisse gelangen nur in deine Seminararbeit, wenn du sie mit „Übernehmen“ oder „Speichern“ selbst dort ablegst. <strong>Bitte gib keine Namen, Schulnamen oder andere persönliche Daten ein.</strong></p>
      <p><strong>d) Quellensuche.</strong> Bei der Quellensuche formuliert die KI Suchanfragen aus deinem Thema und deinem Suchauftrag. Diese Anfragen führt Anthropic über einen Suchdienst aus. Die Suchergebnisse siehst du in der Antwort.</p>
      <p><strong>e) Technische Zugriffsdaten.</strong> Beim Aufruf der Seite verarbeitet unser Hoster (Vercel) technisch notwendige Daten wie IP-Adresse, Zeitpunkt und aufgerufene Adresse in Server-Protokollen. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (sicherer und stabiler Betrieb).</p>
      <p><strong>f) Missbrauchsschutz.</strong> Um das Erraten von Codes zu bremsen, zählen wir fehlgeschlagene Anmeldungen pro Anschluss. Dafür speichern wir nur einen Hash der IP-Adresse für höchstens 15 Minuten, nicht die IP-Adresse selbst.</p>
      <p><strong>g) Speicher im Browser.</strong> Damit du angemeldet bleibst, speichert dein Browser deinen Zugangscode lokal (Local Storage). Das ist technisch notwendig. Wir setzen keine Cookies zu Werbung oder Reichweitenmessung und nutzen keine Tracking-Dienste. Mit „Abmelden“ löschst du den Code aus deinem Browser. Für die Verwaltungsseite gibt es ein technisch notwendiges Anmelde-Cookie, das nur der Betreiber nutzt.</p>

      <H>4. Empfänger und Übermittlung in Drittländer</H>
      <ul className="list-disc space-y-1 pl-6">
        <li>Vercel Inc. (USA): Hosting der Webseite.</li>
        <li>Upstash (Region der Datenbank: {l.redisRegion}): Speicherung der Zugangsdaten und Zähler aus Punkt 3 a und f sowie der verschlüsselten Seminararbeit aus Punkt 3 b.</li>
        <li>Anthropic PBC (USA): Verarbeitung der Eingaben zur Erzeugung der KI-Antworten. Es gelten zusätzlich die Datenschutzbestimmungen von Anthropic (anthropic.com/privacy).</li>
      </ul>
      <p>Bei Anbietern in den USA erfolgt die Übermittlung auf Grundlage der von der EU anerkannten Mechanismen (zum Beispiel Standardvertragsklauseln oder Zertifizierung nach dem EU-US Data Privacy Framework).</p>

      <H>5. Speicherdauer</H>
      <p>Die Daten aus Punkt 3 a bleiben gespeichert, solange der Dienst betrieben wird, und werden auf Wunsch früher gelöscht. Die Seminararbeit aus Punkt 3 b löschst du selbst jederzeit unter „Meine Seminararbeit“ oder wir löschen sie auf Anfrage; sonst verfällt sie 400 Tage nach der letzten Änderung. Server-Protokolle löscht der Hoster nach seinen üblichen Fristen. Hashes aus Punkt 3 f verfallen nach 15 Minuten.</p>

      <H>6. Kinder und Jugendliche</H>
      <p>Der Dienst richtet sich an Schülerinnen und Schüler. Die Zugangscodes werden vom Betreiber persönlich ausgegeben. Bitte sprich mit deinen Eltern oder deiner Lehrkraft, wenn du unsicher bist, ob du den Dienst nutzen möchtest.</p>

      <H>7. Deine Rechte</H>
      <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Deine Seminararbeit kannst du dir außerdem als Datei sichern und selbst löschen. Für alles andere schreib an die E-Mail-Adresse oben. Außerdem kannst du dich bei einer Datenschutzaufsichtsbehörde beschweren, in Bayern beim Bayerischen Landesamt für Datenschutzaufsicht (lda.bayern.de).</p>
    </main>
  );
}
