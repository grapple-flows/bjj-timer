import { describe, expect, it } from "vitest";
import {
  describeConfig,
  formatDuration,
  countdownBeat,
  warningBeat,
  nextPhaseStart,
  parseTimerParams,
  positionAt,
  timerConfigToParams,
  totalSeconds,
} from "../src/rollTimer";

const config = { roundSeconds: 300, restSeconds: 60, rounds: 3 };

describe("positionAt", () => {
  it("walks work, rest, work, ..., done", () => {
    expect(positionAt(config, 0).phase).toBe("ready");
    expect(positionAt(config, 10)).toMatchObject({ phase: "work", round: 1, remaining: 290 });
    expect(positionAt(config, 305)).toMatchObject({ phase: "rest", round: 1, remaining: 55 });
    expect(positionAt(config, 360)).toMatchObject({ phase: "work", round: 2, remaining: 300 });
    // No rest after the last round.
    expect(totalSeconds(config)).toBe(3 * 300 + 2 * 60);
    expect(positionAt(config, 1019)).toMatchObject({ phase: "work", round: 3, remaining: 1 });
    expect(positionAt(config, 1020)).toMatchObject({ phase: "done", round: 3, remaining: 0 });
  });

  it("stays right across a long gap (locked phone)", () => {
    // 700s after start: round 2 ended at 660, rest runs to 720.
    expect(positionAt(config, 700)).toMatchObject({ phase: "rest", round: 2, remaining: 20 });
  });

  it("handles zero rest", () => {
    const noRest = { roundSeconds: 60, restSeconds: 0, rounds: 2 };
    expect(positionAt(noRest, 61)).toMatchObject({ phase: "work", round: 2 });
    expect(positionAt(noRest, 120).phase).toBe("done");
  });
});

describe("countdown", () => {
  it("runs 3-2-1 before round one", () => {
    expect(positionAt(config, -3)).toMatchObject({ phase: "countdown", round: 1, remaining: 3 });
    expect(positionAt(config, -0.5)).toMatchObject({ phase: "countdown", remaining: 0.5 });
    expect(nextPhaseStart(config, -2)).toBe(0);
  });

  it("beeps on 3, 2 and 1 into a round, never during a round", () => {
    const beats = [-3, -2.5, -2, -1.2, -1, -0.1].map((t) => countdownBeat(positionAt(config, t)));
    expect(beats).toEqual([3, 3, 2, 2, 1, 1]);
    expect(countdownBeat(positionAt(config, 10))).toBeNull();
    // Rest 300..360: beats in the last three seconds only.
    expect(countdownBeat(positionAt(config, 330))).toBeNull();
    expect(countdownBeat(positionAt(config, 357))).toBe(3);
    expect(countdownBeat(positionAt(config, 359.5))).toBe(1);
  });

  it("skips the rest countdown when the rest is too short to hold it", () => {
    const shortRest = { roundSeconds: 60, restSeconds: 3, rounds: 2 };
    expect(countdownBeat(positionAt(shortRest, 61))).toBeNull();
  });
});

describe("warningBeat", () => {
  it("knocks on 10, 9 and 8 seconds left, one per second", () => {
    expect([10, 9.5, 9, 8.2, 8, 7].map((r) => warningBeat(r, 300))).toEqual([10, 10, 9, 9, 8, null]);
    expect(warningBeat(10.5, 300)).toBeNull();
  });

  it("stays quiet in phases too short to hold it", () => {
    expect(warningBeat(10, 10)).toBeNull();
    expect(warningBeat(9, 11)).toBeNull();
  });
});

describe("nextPhaseStart", () => {
  it("jumps to the next boundary", () => {
    expect(nextPhaseStart(config, 0)).toBe(300);
    expect(nextPhaseStart(config, 310)).toBe(360);
    expect(nextPhaseStart(config, 1000)).toBe(1020);
  });
});

describe("URL params", () => {
  it("round-trips a config", () => {
    const params = new URLSearchParams(timerConfigToParams(config)).toString();
    expect(parseTimerParams(`?${params}`)).toEqual(config);
  });

  it("clamps and ignores junk", () => {
    expect(parseTimerParams("?round=5&rest=-4&rounds=99")).toEqual({
      roundSeconds: 10,
      restSeconds: 0,
      rounds: 30,
    });
    expect(parseTimerParams("?round=abc")).toBeNull();
    expect(parseTimerParams("?utm_source=blog")).toBeNull();
  });
});

describe("copy helpers", () => {
  it("formats durations and summaries", () => {
    expect(formatDuration(75)).toBe("1:15");
    expect(describeConfig(config)).toBe("3 × 5:00 rounds, 1:00 rest");
    expect(describeConfig({ roundSeconds: 600, restSeconds: 60, rounds: 1 })).toBe("1 × 10:00 round");
  });
});
