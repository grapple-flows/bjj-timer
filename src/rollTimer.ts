// Pure, dependency-free round-timer logic. The same logic runs the hosted
// timer at https://grappleflows.com/timer.
//
// The timer is driven by elapsed wall-clock time, not by counting animation
// frames. Given a config and "seconds since Start" we can always say which
// round we are in and how much is left. That keeps the clock correct when a
// phone locks or the tab is backgrounded (frames stop, time does not), and it
// makes Skip a simple jump to the next phase boundary.

export type TimerPhase = "ready" | "countdown" | "work" | "rest" | "done";

/** Seconds of 3-2-1 before round one. The session clock starts at
 *  -COUNTDOWN_SECONDS, so the countdown is just negative elapsed time. */
export const COUNTDOWN_SECONDS = 3;

export type TimerConfig = {
  roundSeconds: number;
  restSeconds: number;
  rounds: number;
};

export type TimerPosition = {
  phase: TimerPhase;
  /** 1-based round number (clamped to `rounds` once done). */
  round: number;
  /** Seconds left in the current phase. */
  remaining: number;
  /** Full length of the current phase, for progress rings. */
  phaseTotal: number;
  /** Elapsed seconds at which the current phase ends. */
  phaseEndsAt: number;
};

export const ROUND_LIMITS = { min: 10, max: 60 * 60 };
export const REST_LIMITS = { min: 0, max: 15 * 60 };
export const ROUNDS_LIMITS = { min: 1, max: 30 };

export const DEFAULT_TIMER_CONFIG: TimerConfig = {
  roundSeconds: 300,
  restSeconds: 60,
  rounds: 6,
};

export type TimerPreset = {
  key: string;
  label: string;
  hint: string;
  config: TimerConfig;
};

/** Common gym setups. Labels are what a coach would call out on the mat. */
export const TIMER_PRESETS: TimerPreset[] = [
  {
    key: "open-mat",
    label: "Open mat",
    hint: "6 × 5:00, 1:00 rest",
    config: { roundSeconds: 300, restSeconds: 60, rounds: 6 },
  },
  {
    key: "comp-prep",
    label: "Comp prep",
    hint: "5 × 6:00, 0:30 rest",
    config: { roundSeconds: 360, restSeconds: 30, rounds: 5 },
  },
  {
    key: "positional",
    label: "Positional",
    hint: "8 × 2:00, 0:15 rest",
    config: { roundSeconds: 120, restSeconds: 15, rounds: 8 },
  },
  {
    key: "drilling",
    label: "Drilling",
    hint: "10 × 1:00, 0:10 rest",
    config: { roundSeconds: 60, restSeconds: 10, rounds: 10 },
  },
];

export const ROUND_OPTIONS = [60, 90, 120, 180, 240, 300, 360, 420, 480, 600, 900, 1200];
export const REST_OPTIONS = [0, 10, 15, 20, 30, 45, 60, 90, 120, 180];

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

export function normalizeConfig(config: TimerConfig): TimerConfig {
  return {
    roundSeconds: clampInt(config.roundSeconds || ROUND_LIMITS.min, ROUND_LIMITS.min, ROUND_LIMITS.max),
    restSeconds: clampInt(config.restSeconds || 0, REST_LIMITS.min, REST_LIMITS.max),
    rounds: clampInt(config.rounds || 1, ROUNDS_LIMITS.min, ROUNDS_LIMITS.max),
  };
}

/** Total session length: every round plus the rests between them (no rest
 *  after the last round). */
export function totalSeconds(config: TimerConfig): number {
  const c = normalizeConfig(config);
  return c.rounds * c.roundSeconds + (c.rounds - 1) * c.restSeconds;
}

/** Where the session is `elapsed` seconds after round one starts. Negative
 *  elapsed is the 3-2-1 countdown before it. */
export function positionAt(config: TimerConfig, elapsed: number): TimerPosition {
  const c = normalizeConfig(config);
  if (elapsed < 0) {
    return {
      phase: "countdown",
      round: 1,
      remaining: -elapsed,
      phaseTotal: COUNTDOWN_SECONDS,
      phaseEndsAt: 0,
    };
  }
  if (elapsed === 0) {
    return {
      phase: "ready",
      round: 1,
      remaining: c.roundSeconds,
      phaseTotal: c.roundSeconds,
      phaseEndsAt: c.roundSeconds,
    };
  }

  const cycle = c.roundSeconds + c.restSeconds;
  const total = totalSeconds(c);
  if (elapsed >= total) {
    return { phase: "done", round: c.rounds, remaining: 0, phaseTotal: c.roundSeconds, phaseEndsAt: total };
  }

  const index = Math.floor(elapsed / cycle);
  const intoCycle = elapsed - index * cycle;
  const round = index + 1;
  if (intoCycle < c.roundSeconds) {
    const phaseEndsAt = index * cycle + c.roundSeconds;
    return {
      phase: "work",
      round,
      remaining: phaseEndsAt - elapsed,
      phaseTotal: c.roundSeconds,
      phaseEndsAt,
    };
  }
  const phaseEndsAt = (index + 1) * cycle;
  return {
    phase: "rest",
    round,
    remaining: phaseEndsAt - elapsed,
    phaseTotal: c.restSeconds,
    phaseEndsAt,
  };
}

/** Elapsed time at the start of the phase after the one at `elapsed`. */
export function nextPhaseStart(config: TimerConfig, elapsed: number): number {
  if (elapsed < 0) return 0;
  const position = positionAt(config, Math.max(elapsed, 0.001));
  return position.phase === "done" ? totalSeconds(config) : position.phaseEndsAt;
}

export const formatDuration = (seconds: number): string => {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
};

export const formatClockFace = (seconds: number): string => {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

/** Read a timer setup from a query string (`?round=300&rest=60&rounds=6`).
 *  Returns null when none of the params are present so callers can keep
 *  their own defaults. Out-of-range values are clamped, junk is ignored. */
export function parseTimerParams(search: string): TimerConfig | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const read = (key: string): number | null => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  const round = read("round");
  const rest = read("rest");
  const rounds = read("rounds");
  if (round === null && rest === null && rounds === null) return null;
  return normalizeConfig({
    roundSeconds: round ?? DEFAULT_TIMER_CONFIG.roundSeconds,
    restSeconds: rest ?? DEFAULT_TIMER_CONFIG.restSeconds,
    rounds: rounds ?? DEFAULT_TIMER_CONFIG.rounds,
  });
}

export function timerConfigToParams(config: TimerConfig): Record<string, string> {
  const c = normalizeConfig(config);
  return {
    round: String(c.roundSeconds),
    rest: String(c.restSeconds),
    rounds: String(c.rounds),
  };
}

/** Plain-language summary, e.g. "6 × 5:00 rounds, 1:00 rest". */
export function describeConfig(config: TimerConfig): string {
  const c = normalizeConfig(config);
  const rounds = `${c.rounds} × ${formatDuration(c.roundSeconds)} ${c.rounds === 1 ? "round" : "rounds"}`;
  return c.restSeconds > 0 && c.rounds > 1 ? `${rounds}, ${formatDuration(c.restSeconds)} rest` : rounds;
}

/** The countdown second (3, 2 or 1) to beep for, or null. Beeps lead into a
 *  round: during the opening countdown, and in the last three seconds of a
 *  rest that is long enough to hold them. */
export function countdownBeat(position: TimerPosition): number | null {
  const leadsIntoRound =
    position.phase === "countdown" ||
    (position.phase === "rest" && position.phaseTotal > COUNTDOWN_SECONDS);
  if (!leadsIntoRound || position.remaining <= 0) return null;
  const beat = Math.ceil(position.remaining - 1e-9);
  return beat >= 1 && beat <= COUNTDOWN_SECONDS ? beat : null;
}

/** The 10-second warning beat (10, 9 or 8 seconds left), or null. One wood
 *  hit per second, the same tempo as the countdown. Skipped for phases too
 *  short to hold it without landing on the start signal. */
export function warningBeat(remaining: number, phaseTotal: number): number | null {
  if (phaseTotal <= 11 || remaining <= 0) return null;
  const beat = Math.ceil(remaining - 1e-9);
  return beat >= 8 && beat <= 10 ? beat : null;
}
