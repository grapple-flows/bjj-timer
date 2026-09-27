// IBJJF regulation match times by belt, as used by the Grapple Flows timer
// (https://grappleflows.com/timer). Source: IBJJF Rules Book
// (https://ibjjf.com/books-videos). Juvenile (16 to 17) runs 5:00, and
// Master 2 and older divisions are shorter. Confirm against the current
// rulebook for your event.

export type Belt = "white" | "blue" | "purple" | "brown" | "black";
export type MatchDivision = "adult" | "master-1";

export type MatchTime = {
  belt: Belt;
  label: string;
  /** Adult division match length, in seconds. */
  adult: number;
  /** Master 1 division match length, in seconds. */
  master1: number;
};

export const IBJJF_MATCH_TIMES: readonly MatchTime[] = [
  { belt: "white", label: "White", adult: 300, master1: 300 },
  { belt: "blue", label: "Blue", adult: 360, master1: 360 },
  { belt: "purple", label: "Purple", adult: 420, master1: 360 },
  { belt: "brown", label: "Brown", adult: 480, master1: 360 },
  { belt: "black", label: "Black", adult: 600, master1: 360 },
];

export const MATCH_TIMES_SOURCE = {
  name: "IBJJF Rules Book",
  url: "https://ibjjf.com/books-videos",
  note: "Juvenile (16 to 17) runs 5:00. Master 2 and older divisions are shorter. Always confirm against the current IBJJF rulebook for your event.",
} as const;

export const DIVISION_LABELS: Record<MatchDivision, string> = {
  adult: "Adult",
  "master-1": "Master 1",
};

/** Match length in seconds for a belt and division, or null if the belt is
 *  not one of the five adult belts. */
export function matchSeconds(belt: string, division: MatchDivision = "adult"): number | null {
  const row = IBJJF_MATCH_TIMES.find((entry) => entry.belt === belt.trim().toLowerCase());
  if (!row) return null;
  return division === "master-1" ? row.master1 : row.adult;
}
