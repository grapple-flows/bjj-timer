// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BjjTimerElement, CREDIT_TEXT, CREDIT_URL, parseDuration } from "../src/bjj-timer";
import type { BjjTimerEventDetail } from "../src/element";

const mount = (html: string): BjjTimerElement => {
  document.body.innerHTML = html;
  return document.body.querySelector("bjj-timer") as BjjTimerElement;
};

const shadowText = (el: BjjTimerElement, selector: string) =>
  el.shadowRoot?.querySelector(selector)?.textContent?.trim();

const record = (el: BjjTimerElement) => {
  const log: { type: string; detail: BjjTimerEventDetail }[] = [];
  for (const type of [
    "bjj-timer:start",
    "bjj-timer:pause",
    "bjj-timer:resume",
    "bjj-timer:reset",
    "bjj-timer:round-start",
    "bjj-timer:rest-start",
    "bjj-timer:warning",
    "bjj-timer:done",
  ]) {
    el.addEventListener(type, (event) => log.push({ type, detail: (event as CustomEvent<BjjTimerEventDetail>).detail }));
  }
  return log;
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance", "requestAnimationFrame", "cancelAnimationFrame"],
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("<bjj-timer>", () => {
  it("registers and renders the default setup", () => {
    expect(customElements.get("bjj-timer")).toBe(BjjTimerElement);
    const el = mount("<bjj-timer></bjj-timer>");
    expect(el.shadowRoot).toBeTruthy();
    expect(el.config).toEqual({ roundSeconds: 300, restSeconds: 60, rounds: 6 });
    expect(shadowText(el, ".time")).toBe("05:00");
    expect(shadowText(el, ".phase")).toBe("Ready");
    expect(shadowText(el, ".round")).toBe("Round 1 of 6");
    expect(shadowText(el, ".summary")).toBe("6 × 5:00 rounds, 1:00 rest · 35:00 total");
    expect(el.getAttribute("data-phase")).toBe("ready");
  });

  it("reads rounds, round, rest, preset, belt and warning attributes", () => {
    expect(mount('<bjj-timer rounds="3" round="2:30" rest="20"></bjj-timer>').config).toEqual({
      roundSeconds: 150,
      restSeconds: 20,
      rounds: 3,
    });
    expect(mount('<bjj-timer preset="drilling"></bjj-timer>').config).toEqual({
      roundSeconds: 60,
      restSeconds: 10,
      rounds: 10,
    });
    expect(mount('<bjj-timer preset="comp-prep" rounds="3"></bjj-timer>').config.rounds).toBe(3);
    expect(mount('<bjj-timer belt="purple"></bjj-timer>').config).toEqual({ roundSeconds: 420, restSeconds: 0, rounds: 1 });
    expect(mount('<bjj-timer belt="black" division="master-1"></bjj-timer>').config.roundSeconds).toBe(360);
    expect(mount("<bjj-timer></bjj-timer>").warning).toBe(true);
    expect(mount('<bjj-timer warning="off"></bjj-timer>').warning).toBe(false);
  });

  it("applies attribute changes after connecting", () => {
    const el = mount("<bjj-timer></bjj-timer>");
    el.setAttribute("preset", "positional");
    expect(el.config).toEqual({ roundSeconds: 120, restSeconds: 15, rounds: 8 });
    expect(shadowText(el, ".time")).toBe("02:00");
    const pressed = el.shadowRoot!.querySelector('[data-preset="positional"]')!.getAttribute("aria-pressed");
    expect(pressed).toBe("true");
  });

  it("puts the credit link in the light DOM, and can hide it", () => {
    const el = mount("<bjj-timer></bjj-timer>");
    const link = el.querySelector("a[slot=credit]") as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.parentElement).toBe(el);
    expect(link.getAttribute("href")).toBe(CREDIT_URL);
    expect(link.textContent).toBe(CREDIT_TEXT);
    expect(document.body.innerHTML).toContain("https://grappleflows.com/timer?utm_source=github");

    el.setAttribute("no-credit", "");
    expect(el.querySelector("a[slot=credit]")).toBeNull();

    const hidden = mount("<bjj-timer no-credit></bjj-timer>");
    expect(hidden.querySelector("a")).toBeNull();
  });

  it("keeps a credit link the page wrote itself", async () => {
    const el = mount(`<bjj-timer><a slot="credit" href="${CREDIT_URL}">${CREDIT_TEXT}</a></bjj-timer>`);
    await vi.advanceTimersByTimeAsync(0); // children can arrive after connect
    expect(el.querySelectorAll("a[slot=credit]").length).toBe(1);
    expect(el.querySelector("[data-bjj-timer-credit]")).toBeNull();
  });

  it("counts down 3-2-1, runs rounds and rests, and finishes", async () => {
    const el = mount('<bjj-timer rounds="2" round="20" rest="5"></bjj-timer>');
    const log = record(el);

    await el.start();
    expect(el.running).toBe(true);
    expect(el.phase).toBe("countdown");
    expect(shadowText(el, ".phase")).toBe("Get ready");
    expect(shadowText(el, "[data-live]")).toBe("Get ready.");

    await vi.advanceTimersByTimeAsync(3_100);
    expect(el.phase).toBe("work");
    expect(el.round).toBe(1);
    expect(shadowText(el, "[data-live]")).toBe("Round 1 of 2. Roll.");

    await vi.advanceTimersByTimeAsync(20_000);
    expect(el.phase).toBe("rest");

    await vi.advanceTimersByTimeAsync(5_000);
    expect(el.phase).toBe("work");
    expect(el.round).toBe(2);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(el.phase).toBe("done");
    expect(el.running).toBe(false);
    expect(shadowText(el, ".round")).toBe("2 rounds complete");

    expect(log.map((entry) => entry.type)).toEqual([
      "bjj-timer:start",
      "bjj-timer:round-start",
      "bjj-timer:warning",
      "bjj-timer:rest-start",
      "bjj-timer:round-start",
      "bjj-timer:warning",
      "bjj-timer:done",
    ]);
    expect(log[1].detail).toMatchObject({ phase: "work", round: 1, rounds: 2 });
    expect(log[4].detail).toMatchObject({ phase: "work", round: 2 });
  });

  it("skips the 10-second warning when it is turned off", async () => {
    const el = mount('<bjj-timer rounds="1" round="20" warning="off"></bjj-timer>');
    const log = record(el);
    await el.start();
    await vi.advanceTimersByTimeAsync(24_000);
    expect(log.map((entry) => entry.type)).toEqual(["bjj-timer:start", "bjj-timer:round-start", "bjj-timer:done"]);
  });

  it("pauses without losing its place and resumes", async () => {
    const el = mount('<bjj-timer rounds="1" round="60"></bjj-timer>');
    await el.start();
    await vi.advanceTimersByTimeAsync(13_000); // 3s countdown + 10s of the round
    el.pause();
    expect(el.remaining).toBeCloseTo(50, 1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(el.remaining).toBeCloseTo(50, 1);
    expect(shadowText(el, ".time")).toBe("00:50");
    expect(shadowText(el, '[data-action="toggle"]')).toBe("Resume");
    await el.start();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(el.remaining).toBeCloseTo(45, 1);
  });

  it("stays accurate when ticks are throttled", async () => {
    const el = mount('<bjj-timer rounds="3" round="60" rest="30"></bjj-timer>');
    await el.start();
    // Move the clock without letting any timer fire, like a locked phone.
    const now = performance.now();
    vi.spyOn(performance, "now").mockReturnValue(now + 100_000);
    // 100s after Start: 3s countdown, 60s round one, 30s rest, 7s into round two.
    expect(el.phase).toBe("work");
    expect(el.round).toBe(2);
    expect(el.remaining).toBeCloseTo(53, 1);
  });

  it("resets to Ready", async () => {
    const el = mount('<bjj-timer rounds="2" round="30"></bjj-timer>');
    const log = record(el);
    await el.start();
    await vi.advanceTimersByTimeAsync(8_000);
    el.reset();
    expect(el.running).toBe(false);
    expect(el.phase).toBe("ready");
    expect(shadowText(el, ".time")).toBe("00:30");
    expect(log[log.length - 1]?.type).toBe("bjj-timer:reset");
  });

  it("skips to the next phase", async () => {
    const el = mount('<bjj-timer rounds="2" round="30" rest="15"></bjj-timer>');
    await el.start();
    await el.skip(); // countdown -> round one
    expect(el.phase).toBe("work");
    await el.skip(); // round one -> rest
    expect(el.phase).toBe("rest");
    expect(el.remaining).toBeCloseTo(15, 1);
  });

  it("has labelled controls and a polite live region", () => {
    const el = mount("<bjj-timer></bjj-timer>");
    const root = el.shadowRoot!;
    expect(root.querySelector('[role="status"][aria-live="polite"]')).toBeTruthy();
    expect(root.querySelector('[role="timer"]')).toBeTruthy();
    for (const button of Array.from(root.querySelectorAll("button:not([hidden])"))) {
      expect(button.textContent?.trim().length).toBeGreaterThan(0);
    }
    for (const control of Array.from(root.querySelectorAll("select, input"))) {
      expect(control.closest("label")).toBeTruthy();
    }
  });

  it("applies a belt's IBJJF match time from the picker", () => {
    const el = mount("<bjj-timer></bjj-timer>");
    const select = el.shadowRoot!.querySelector('[data-field="match"]') as HTMLSelectElement;
    select.value = "adult:brown";
    select.dispatchEvent(new Event("change"));
    expect(el.config).toEqual({ roundSeconds: 480, restSeconds: 0, rounds: 1 });
    expect(shadowText(el, "[data-live]")).toBe("Set to one 8:00 round for a brown belt adult match.");
  });

  it("responds to keyboard shortcuts when focused", async () => {
    const el = mount('<bjj-timer round="60"></bjj-timer>');
    el.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);
    expect(el.running).toBe(true);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "r", bubbles: true }));
    expect(el.running).toBe(false);
    expect(el.phase).toBe("ready");
  });

  it("keeps config set through the API before connecting", () => {
    const el = document.createElement("bjj-timer");
    el.config = { roundSeconds: 240, restSeconds: 30, rounds: 4 };
    el.setAttribute("rounds", "9");
    document.body.append(el);
    expect(el.config).toEqual({ roundSeconds: 240, restSeconds: 30, rounds: 4 });
  });

  it("remembers settings with persist", () => {
    const first = mount('<bjj-timer persist="gym"></bjj-timer>');
    first.applyConfig({ roundSeconds: 420 });
    const second = mount('<bjj-timer persist="gym"></bjj-timer>');
    expect(second.config.roundSeconds).toBe(420);
    window.localStorage.clear();
  });
});

describe("parseDuration", () => {
  it("reads seconds and m:ss", () => {
    expect(parseDuration("300")).toBe(300);
    expect(parseDuration("5:00")).toBe(300);
    expect(parseDuration("1:5")).toBe(65);
    expect(parseDuration("5m")).toBeNull();
    expect(parseDuration(null)).toBeNull();
  });
});
