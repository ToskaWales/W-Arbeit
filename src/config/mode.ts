// Sparring: die KI fragt und kritisiert. Schreiben: die KI formuliert auch aus.
export const MODES = ["sparring", "schreiben"] as const;
export type Mode = (typeof MODES)[number];
export const DEFAULT_MODE: Mode = "sparring";
export const MODE_LABELS: Record<Mode, string> = { sparring: "Sparring", schreiben: "Schreiben" };
