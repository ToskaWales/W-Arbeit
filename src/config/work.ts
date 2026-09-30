// Grenzen für die gespeicherte Seminararbeit. Gelten auf dem Server und im Formular.
export const WORK_LIMITS = {
  fach: 100,
  thema: 300,
  zeitraum: 100,
  fragestellung: 600,
  kurzfassung: 3000,
  gliederung: 4000,
  maxKapitel: 25,
  kapitelTitel: 150,
  kapitelText: 30000,
  maxQuellen: 40,
  quelleTitel: 300,
  quelleUrl: 500,
  quelleNotiz: 500,
  quelleBewertung: 2500,
  maxPunkte: 60,
  punktText: 600,
  gesamt: 120000, // Zeichen insgesamt (grob 30.000 Wörter Reserve, deutlich mehr als eine W-Seminararbeit)
};

// Wie lange die Arbeit ohne Änderung aufbewahrt wird (Redis-Ablaufzeit, wird bei jedem Speichern erneuert).
export const WORK_TTL_SECONDS = 60 * 60 * 24 * 400;

// Höchstzahl Schreibvorgänge pro Code und Stunde (Schutz vor Endlosschleifen im Browser).
export const WORK_WRITES_PER_HOUR = 300;
