// @vitest-environment node
import { describe, expect, it } from "vitest";

describe("server-side import", () => {
  it("imports without a DOM and exposes the logic", async () => {
    const mod = await import("../src/bjj-timer");
    expect(typeof mod.BjjTimerElement).toBe("function");
    expect(mod.totalSeconds({ roundSeconds: 300, restSeconds: 60, rounds: 6 })).toBe(2100);
    const logic = await import("../src/logic");
    expect(logic.matchSeconds("blue")).toBe(360);
  });
});
