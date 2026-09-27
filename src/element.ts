import {
  COUNTDOWN_SECONDS,
  DEFAULT_TIMER_CONFIG,
  REST_OPTIONS,
  ROUND_OPTIONS,
  ROUNDS_LIMITS,
  TIMER_PRESETS,
  countdownBeat,
  describeConfig,
  formatClockFace,
  formatDuration,
  nextPhaseStart,
  normalizeConfig,
  parseTimerParams,
  positionAt,
  totalSeconds,
  warningBeat,
  type TimerConfig,
  type TimerPhase,
  type TimerPosition,
} from "./rollTimer.js";
import { DIVISION_LABELS, IBJJF_MATCH_TIMES, matchSeconds, type MatchDivision } from "./matchTimes.js";
import { getTimerSounds, type TimerSounds } from "./audio.js";
import { styles } from "./styles.js";

export const CREDIT_URL =
  "https://grappleflows.com/timer?utm_source=github&utm_medium=referral&utm_campaign=bjj-timer&ref=github";
export const CREDIT_TEXT = "Free BJJ timer by Grapple Flows";

export type BjjTimerEventDetail = {
  phase: TimerPhase;
  /** 1-based round number. */
  round: number;
  rounds: number;
  /** Seconds left in the current phase. */
  remaining: number;
  /** Seconds since round one started (negative during the 3-2-1). */
  elapsed: number;
  running: boolean;
  config: TimerConfig;
};

export const BJJ_TIMER_EVENTS = [
  "bjj-timer:start",
  "bjj-timer:pause",
  "bjj-timer:resume",
  "bjj-timer:reset",
  "bjj-timer:skip",
  "bjj-timer:phase",
  "bjj-timer:round-start",
  "bjj-timer:rest-start",
  "bjj-timer:warning",
  "bjj-timer:tick",
  "bjj-timer:done",
  "bjj-timer:config-change",
] as const;

export type BjjTimerEventName = (typeof BJJ_TIMER_EVENTS)[number];

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockLike = { request: (type: "screen") => Promise<WakeLockSentinelLike> };

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
};

type Persisted = { v: 1; config: TimerConfig; warning: boolean; wake: boolean };

const CONFIG_ATTRIBUTES = ["rounds", "round", "rest", "preset", "belt", "division"];
const RING_RADIUS = 132;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const DEFAULT_SUPPORT =
  "Tap Start once to enable sound. On iPhone, turn off silent mode for speaker audio. Sounds play on time while this page is on screen.";

// SSR-safe base: importing the module in Node must not throw.
const HTMLElementBase = (typeof HTMLElement === "undefined" ? class {} : HTMLElement) as typeof HTMLElement;

const clock = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();

/** Seconds from an attribute: "300", "90.5" or "5:00". */
export function parseDuration(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const raw = value.trim();
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const match = /^(\d+):([0-5]?\d)$/.exec(raw);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

const parseCount = (value: string | null): number | null => {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Boolean-ish attribute that defaults on: absent, "", "on", "true" are on. */
const isOn = (value: string | null) => value === null || !/^(off|false|0|no)$/i.test(value.trim());

const sameConfig = (a: TimerConfig, b: TimerConfig) =>
  a.roundSeconds === b.roundSeconds && a.restSeconds === b.restSeconds && a.rounds === b.rounds;

/** Options for a select, always including the current value so a custom
 *  length (say 7:30) still shows up. */
const withCurrent = (options: number[], current: number) =>
  options.includes(current) ? options : [...options, current].sort((a, b) => a - b);

const isTypingTarget = (el: Element | null) =>
  !!el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);

const isActivatable = (el: Element | null) =>
  !!el && (isTypingTarget(el) || el.tagName === "BUTTON" || el.tagName === "A" || el.tagName === "SUMMARY");

const ICON_EXPAND =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
const ICON_COLLAPSE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

const matchOptions = () =>
  (Object.keys(DIVISION_LABELS) as MatchDivision[])
    .map(
      (division) =>
        `<optgroup label="${DIVISION_LABELS[division]}">${IBJJF_MATCH_TIMES.map((row) => {
          const seconds = division === "master-1" ? row.master1 : row.adult;
          return `<option value="${division}:${row.belt}">${row.label} belt, ${formatDuration(seconds)}</option>`;
        }).join("")}</optgroup>`,
    )
    .join("");

const template = () => `
<style>${styles}</style>
<section class="timer" part="timer" data-phase="ready" aria-label="BJJ round timer">
  <div class="face">
    <div class="ring-wrap">
      <svg class="ring" viewBox="0 0 288 288" aria-hidden="true">
        <circle class="ring-track" cx="144" cy="144" r="${RING_RADIUS}"></circle>
        <circle class="ring-progress" part="ring" cx="144" cy="144" r="${RING_RADIUS}"
          style="stroke-dasharray:${RING_CIRCUMFERENCE};stroke-dashoffset:0"></circle>
      </svg>
      <div class="face-inner">
        <p class="phase" part="phase">Ready</p>
        <div class="time" part="clock" role="timer" aria-atomic="true">05:00</div>
        <p class="round" part="round">Round 1 of 6</p>
      </div>
    </div>
  </div>

  <div class="presets" part="presets" role="group" aria-label="Presets">
    ${TIMER_PRESETS.map(
      (preset) => `<button type="button" class="preset" data-preset="${preset.key}" aria-pressed="false">
      <span class="preset-label">${escapeHtml(preset.label)}</span>
      <span class="preset-hint">${escapeHtml(preset.hint)}</span>
    </button>`,
    ).join("")}
  </div>

  <div class="settings" part="settings">
    <label class="field">Round<select data-field="round"></select></label>
    <label class="field">Rest<select data-field="rest"></select></label>
    <label class="field">Rounds<input data-field="rounds" type="number" inputmode="numeric" min="${ROUNDS_LIMITS.min}" max="${ROUNDS_LIMITS.max}" /></label>
  </div>

  <div class="match">
    <label class="field">IBJJF match time
      <select data-field="match"><option value="">Pick a belt</option>${matchOptions()}</select>
    </label>
  </div>

  <p class="summary" part="summary"></p>

  <div class="toggles">
    <label class="toggle"><input type="checkbox" data-field="warning" /> 10-second warning</label>
    <label class="toggle"><input type="checkbox" data-field="wake" /> Keep screen awake</label>
  </div>

  <div class="actions" part="actions">
    <button type="button" class="button primary" part="button start-button" data-action="toggle" aria-keyshortcuts="Space">Start</button>
    <button type="button" class="button" part="button" data-action="skip" aria-keyshortcuts="N">Skip</button>
    <button type="button" class="button" part="button" data-action="reset" aria-keyshortcuts="R">Reset</button>
  </div>

  <div class="extras">
    <button type="button" class="chip" part="fullscreen-button" data-action="fullscreen" aria-keyshortcuts="F" hidden></button>
  </div>

  <p class="support"><span data-support>${DEFAULT_SUPPORT}</span><span class="keys"> Keys: Space start/pause, N next, R reset, F fullscreen.</span></p>

  <div class="sr-only" role="status" aria-live="polite" data-live></div>
  <div class="credit" part="credit"><slot name="credit"></slot></div>
</section>
`;

/**
 * `<bjj-timer>`: a BJJ round timer with presets, rest periods, IBJJF match
 * times, a 10-second warning, audio cues, fullscreen, and screen wake lock.
 *
 * Timing is wall-clock based: elapsed = banked seconds + (now - run start),
 * and the phase is derived from elapsed time, never by counting ticks.
 */
export class BjjTimerElement extends HTMLElementBase {
  static get observedAttributes() {
    return [...CONFIG_ATTRIBUTES, "warning", "keep-awake", "muted", "no-credit", "global-keys"];
  }

  private _config: TimerConfig = normalizeConfig(DEFAULT_TIMER_CONFIG);
  private _running = false;
  private _starting = false;
  private _elapsedBase = 0;
  private _runStart: number | null = null;
  private _warning = true;
  private _wake = false;
  private _initialized = false;
  private _touched = { config: false, warning: false, wake: false };
  private _lastPhaseKey = "ready:1";
  private _beatKey: string | null = null;
  private _warnKey: string | null = null;
  private _warnEventKey: string | null = null;
  private _lastSecond: number | null = null;
  private _frame = 0;
  private _interval: ReturnType<typeof setInterval> | null = null;
  private _wakeLock: WakeLockSentinelLike | null = null;
  private _sounds: TimerSounds | null = null;
  private _optionsKey = "";
  private _root: ShadowRoot;
  private _childObserver: MutationObserver | null = null;
  private _els: {
    timer: HTMLElement;
    phase: HTMLElement;
    time: HTMLElement;
    round: HTMLElement;
    ring: SVGCircleElement;
    presets: HTMLButtonElement[];
    roundSelect: HTMLSelectElement;
    restSelect: HTMLSelectElement;
    roundsInput: HTMLInputElement;
    matchSelect: HTMLSelectElement;
    summary: HTMLElement;
    warning: HTMLInputElement;
    wake: HTMLInputElement;
    toggle: HTMLButtonElement;
    skip: HTMLButtonElement;
    fullscreen: HTMLButtonElement;
    support: HTMLElement;
    live: HTMLElement;
  };

  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._root.innerHTML = template();
    const $ = <T extends Element>(selector: string) => this._root.querySelector(selector) as T;
    this._els = {
      timer: $(".timer"),
      phase: $(".phase"),
      time: $(".time"),
      round: $(".round"),
      ring: $(".ring-progress"),
      presets: Array.from(this._root.querySelectorAll<HTMLButtonElement>("[data-preset]")),
      roundSelect: $('[data-field="round"]'),
      restSelect: $('[data-field="rest"]'),
      roundsInput: $('[data-field="rounds"]'),
      matchSelect: $('[data-field="match"]'),
      summary: $(".summary"),
      warning: $('[data-field="warning"]'),
      wake: $('[data-field="wake"]'),
      toggle: $('[data-action="toggle"]'),
      skip: $('[data-action="skip"]'),
      fullscreen: $('[data-action="fullscreen"]'),
      support: $("[data-support]"),
      live: $("[data-live]"),
    };
    this._bindControls();
  }

  // ---- Lifecycle -----------------------------------------------------------

  connectedCallback() {
    if (!this._initialized) {
      // Properties set before the element was defined shadow the accessors.
      for (const prop of ["config", "warning", "keepAwake", "muted"] as const) {
        if (Object.prototype.hasOwnProperty.call(this, prop)) {
          const value = (this as Record<string, unknown>)[prop];
          delete (this as Record<string, unknown>)[prop];
          (this as Record<string, unknown>)[prop] = value;
        }
      }
      // Precedence: API calls made before connecting, then a shared link
      // (url-params), then saved settings (persist), then attributes.
      const persisted = this._readPersisted();
      const fromUrl =
        this.hasAttribute("url-params") && typeof location !== "undefined" ? parseTimerParams(location.search) : null;
      if (!this._touched.config) {
        this._config = normalizeConfig(fromUrl ?? persisted?.config ?? this._configFromAttributes());
      }
      if (!this._touched.warning) this._warning = persisted?.warning ?? isOn(this.getAttribute("warning"));
      if (!this._touched.wake) this._wake = persisted?.wake ?? this.hasAttribute("keep-awake");
      this._initialized = true;
    }
    if (!this.hasAttribute("tabindex")) this.tabIndex = -1;
    this._ensureCredit();
    if (typeof MutationObserver !== "undefined") {
      this._childObserver ??= new MutationObserver(() => void this._dedupeCredit());
      this._childObserver.observe(this, { childList: true });
    }
    this._bindGlobalKeys();
    this.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("visibilitychange", this._onVisibility);
    document.addEventListener("fullscreenchange", this._onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", this._onFullscreenChange);
    if (!this.muted) this._sounds = getTimerSounds();
    if (this._running) {
      this._startLoop();
      void this._acquireWakeLock();
    }
    this._update();
  }

  disconnectedCallback() {
    this._childObserver?.disconnect();
    this._stopLoop();
    void this._releaseWakeLock();
    this.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keydown", this._onGlobalKeyDown);
    document.removeEventListener("visibilitychange", this._onVisibility);
    document.removeEventListener("fullscreenchange", this._onFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", this._onFullscreenChange);
  }

  attributeChangedCallback(name: string, oldValue: string | null, value: string | null) {
    if (!this._initialized || oldValue === value) return;
    if (CONFIG_ATTRIBUTES.includes(name)) {
      this.applyConfig(this._configFromAttributes());
      return;
    }
    switch (name) {
      case "warning":
        this.warning = isOn(value);
        break;
      case "keep-awake":
        this.keepAwake = value !== null;
        break;
      case "muted":
        if (value === null) this._sounds = getTimerSounds();
        break;
      case "no-credit":
        this._ensureCredit();
        break;
      case "global-keys":
        if (this.isConnected) this._bindGlobalKeys();
        break;
    }
  }

  // ---- Public API ------------------------------------------------------------

  /** Start, or resume after a pause. A fresh start runs a 3-2-1 first. */
  async start(): Promise<void> {
    if (this._running || this._starting) return;
    this._starting = true;
    try {
      await this._unlockAudio();
      if (this._running) return;
      const fresh = this.phase === "ready" || this.phase === "done";
      if (fresh) {
        this._elapsedBase = -COUNTDOWN_SECONDS;
        this._lastPhaseKey = `countdown:1`;
        this._clearBeatKeys();
      }
      this._runStart = clock();
      this._running = true;
      this._startLoop();
      this._announce(fresh ? "Get ready." : "Resumed.");
      this._emit(fresh ? "bjj-timer:start" : "bjj-timer:resume");
      this._update();
    } finally {
      this._starting = false;
    }
    await this._acquireWakeLock();
  }

  /** Pause and keep the place. */
  pause(): void {
    if (!this._running || this._runStart === null) return;
    this._elapsedBase += (clock() - this._runStart) / 1000;
    this._runStart = null;
    this._running = false;
    this._stopLoop();
    void this._releaseWakeLock();
    this._announce("Paused.");
    this._emit("bjj-timer:pause");
    this._update();
  }

  /** Start if stopped, pause if running. */
  toggle(): Promise<void> | void {
    return this._running ? this.pause() : this.start();
  }

  /** Back to Ready on round one. */
  reset(): void {
    this._resetState();
    this._announce("Reset.");
    this._emit("bjj-timer:reset");
    this._update();
  }

  /** Jump to the start of the next phase (next round or rest). */
  async skip(): Promise<void> {
    await this._unlockAudio();
    if (this.phase === "done") return;
    // Skipping the countdown lands just inside round one, not on "ready".
    const target = Math.max(nextPhaseStart(this._config, this.elapsed), 0.001);
    this._elapsedBase = target;
    if (this._running) this._runStart = clock();
    this._emit("bjj-timer:skip");
    this._update();
  }

  /** Load a setup and reset to Ready. */
  applyConfig(next: Partial<TimerConfig>): void {
    const normalized = normalizeConfig({ ...this._config, ...next });
    this._touched.config = true;
    this._resetState();
    this._config = normalized;
    this._persist();
    this._emit("bjj-timer:config-change");
    this._update();
  }

  /** Current setup. Setting it is the same as applyConfig(). */
  get config(): TimerConfig {
    return { ...this._config };
  }
  set config(value: Partial<TimerConfig>) {
    this.applyConfig(value);
  }

  get running(): boolean {
    return this._running;
  }

  /** Seconds since round one started. Negative during the 3-2-1. */
  get elapsed(): number {
    return this._elapsedBase + (this._running && this._runStart !== null ? (clock() - this._runStart) / 1000 : 0);
  }

  get phase(): TimerPhase {
    return this._position().phase;
  }

  get round(): number {
    return Math.min(this._position().round, this._config.rounds);
  }

  /** Seconds left in the current phase. */
  get remaining(): number {
    const position = this._position();
    return position.phase === "ready" ? this._config.roundSeconds : position.remaining;
  }

  /** Total session length in seconds (rounds plus the rests between them). */
  get totalSeconds(): number {
    return totalSeconds(this._config);
  }

  get warning(): boolean {
    return this._warning;
  }
  set warning(value: boolean) {
    this._warning = Boolean(value);
    this._touched.warning = true;
    this._persist();
    this._update();
  }

  get keepAwake(): boolean {
    return this._wake;
  }
  set keepAwake(value: boolean) {
    this._wake = Boolean(value);
    this._touched.wake = true;
    this._persist();
    if (this._wake) void this._acquireWakeLock();
    else void this._releaseWakeLock();
    this._update();
  }

  get muted(): boolean {
    return this.hasAttribute("muted");
  }
  set muted(value: boolean) {
    this.toggleAttribute("muted", Boolean(value));
  }

  /** Enter or leave fullscreen on this element (needs a user gesture). */
  async toggleFullscreen(): Promise<void> {
    const doc = document as FullscreenDocument;
    const el = this as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
    try {
      if ((doc.fullscreenElement ?? doc.webkitFullscreenElement) === this) {
        await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else {
        await el.webkitRequestFullscreen?.();
      }
    } catch {
      /* the browser refused (e.g. not a user gesture); nothing to undo */
    }
  }

  // ---- Timing --------------------------------------------------------------

  private _position(elapsed = this.elapsed): TimerPosition {
    // A running clock past the countdown is never "ready", even on the frame
    // round one starts.
    return positionAt(this._config, this._running && elapsed >= 0 ? Math.max(elapsed, 0.001) : elapsed);
  }

  private _startLoop() {
    this._stopLoop();
    // rAF drives the display while visible; a 1s interval keeps phase
    // transitions (and their sounds, where the browser allows) going when
    // frames are throttled in a background tab.
    if (typeof requestAnimationFrame === "function") {
      const loop = () => {
        this._update();
        if (this._running) this._frame = requestAnimationFrame(loop);
      };
      this._frame = requestAnimationFrame(loop);
    }
    this._interval = setInterval(() => this._update(), 1000);
  }

  private _stopLoop() {
    if (this._frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this._frame);
    this._frame = 0;
    if (this._interval !== null) clearInterval(this._interval);
    this._interval = null;
  }

  private _resetState() {
    this._running = false;
    this._runStart = null;
    this._elapsedBase = 0;
    this._lastPhaseKey = "ready:1";
    this._clearBeatKeys();
    this._stopLoop();
    void this._releaseWakeLock();
  }

  private _clearBeatKeys() {
    this._beatKey = null;
    this._warnKey = null;
    this._warnEventKey = null;
    this._lastSecond = null;
  }

  /** One pass: fire sounds and events for whatever changed, then paint. */
  private _update() {
    const position = this._position();
    const key = `${position.phase}:${position.round}`;

    if (key !== this._lastPhaseKey) {
      this._lastPhaseKey = key;
      // The go tone starts and stops every round.
      if (position.phase !== "ready" && position.phase !== "countdown") this._sfx?.bell();
      if (position.phase === "done") {
        this._running = false;
        this._runStart = null;
        this._elapsedBase = totalSeconds(this._config);
        this._stopLoop();
        void this._releaseWakeLock();
      }
      this._onPhaseChange(position);
    }

    if (this._running) {
      // 3, 2, 1 beeps into a round (opening countdown and the end of rests).
      const beat = countdownBeat(position);
      if (beat !== null) {
        const beatKey = `${key}:${beat}`;
        if (this._beatKey !== beatKey) {
          this._beatKey = beatKey;
          this._sfx?.countdown();
        }
      }
      // 10-second warning: a knock on 10, 9 and 8 seconds left.
      const warn =
        this._warning && position.phase === "work" ? warningBeat(position.remaining, position.phaseTotal) : null;
      if (warn !== null) {
        const warnKey = `${key}:${warn}`;
        if (this._warnKey !== warnKey) {
          this._warnKey = warnKey;
          this._sfx?.knock();
        }
        if (this._warnEventKey !== key) {
          this._warnEventKey = key;
          this._announce("10 seconds left.");
          this._emit("bjj-timer:warning");
        }
      }
      const second = Math.ceil(position.remaining);
      if (second !== this._lastSecond) {
        this._lastSecond = second;
        this._emit("bjj-timer:tick");
      }
    }

    this._render(position);
  }

  private _onPhaseChange(position: TimerPosition) {
    const { rounds } = this._config;
    this._emit("bjj-timer:phase");
    if (position.phase === "work") {
      this._announce(`Round ${position.round} of ${rounds}. Roll.`);
      this._emit("bjj-timer:round-start");
    } else if (position.phase === "rest") {
      this._announce(`Rest. ${formatDuration(position.remaining)}.`);
      this._emit("bjj-timer:rest-start");
    } else if (position.phase === "done") {
      this._announce(`Done. ${rounds} ${rounds === 1 ? "round" : "rounds"} complete.`);
      this._emit("bjj-timer:done");
    }
  }

  // ---- View ----------------------------------------------------------------

  private _render(position: TimerPosition) {
    const els = this._els;
    const config = this._config;
    const phase = position.phase;

    els.timer.dataset.phase = phase;
    els.timer.dataset.running = String(this._running);
    if (this.getAttribute("data-phase") !== phase) this.setAttribute("data-phase", phase);
    this.toggleAttribute("data-running", this._running);

    setText(
      els.phase,
      phase === "work"
        ? "Roll"
        : phase === "rest"
          ? "Rest"
          : phase === "countdown"
            ? "Get ready"
            : phase === "done"
              ? "Done"
              : "Ready",
    );
    setText(els.time, formatClockFace(phase === "ready" ? config.roundSeconds : position.remaining));
    setText(
      els.round,
      phase === "done"
        ? `${config.rounds} ${config.rounds === 1 ? "round" : "rounds"} complete`
        : `Round ${Math.min(position.round, config.rounds)} of ${config.rounds}`,
    );

    const fractionLeft =
      phase === "ready"
        ? 1
        : phase === "done"
          ? 0
          : position.phaseTotal > 0
            ? Math.max(0, Math.min(1, position.remaining / position.phaseTotal))
            : 1;
    const offset = String(RING_CIRCUMFERENCE * (1 - fractionLeft));
    if (els.ring.style.strokeDashoffset !== offset) els.ring.style.strokeDashoffset = offset;

    const midSession = phase !== "ready" && phase !== "done";
    setText(els.toggle, this._running ? "Pause" : midSession ? "Resume" : "Start");
    els.skip.disabled = phase === "done";

    for (const button of els.presets) {
      const preset = TIMER_PRESETS.find((p) => p.key === button.dataset.preset);
      button.disabled = this._running;
      button.setAttribute("aria-pressed", String(!!preset && sameConfig(preset.config, config)));
    }

    const optionsKey = `${config.roundSeconds}:${config.restSeconds}`;
    if (optionsKey !== this._optionsKey) {
      this._optionsKey = optionsKey;
      els.roundSelect.innerHTML = withCurrent(ROUND_OPTIONS, config.roundSeconds)
        .map((s) => `<option value="${s}">${formatDuration(s)}</option>`)
        .join("");
      els.restSelect.innerHTML = withCurrent(REST_OPTIONS, config.restSeconds)
        .map((s) => `<option value="${s}">${s === 0 ? "None" : formatDuration(s)}</option>`)
        .join("");
    }
    els.roundSelect.value = String(config.roundSeconds);
    els.restSelect.value = String(config.restSeconds);
    if (this._root.activeElement !== els.roundsInput) els.roundsInput.value = String(config.rounds);
    els.roundSelect.disabled = this._running;
    els.restSelect.disabled = this._running;
    els.roundsInput.disabled = this._running;
    els.matchSelect.disabled = this._running;

    // Keep the chosen belt showing while the timer still matches it.
    const [division, belt] = els.matchSelect.value.split(":");
    if (belt) {
      const seconds = matchSeconds(belt, division as MatchDivision);
      if (!(seconds && sameConfig(config, { roundSeconds: seconds, restSeconds: 0, rounds: 1 }))) {
        els.matchSelect.value = "";
      }
    }

    setText(els.summary, `${describeConfig(config)} · ${formatDuration(totalSeconds(config))} total`);
    els.warning.checked = this._warning;
    els.wake.checked = this._wake;

    const doc = typeof document === "undefined" ? null : (document as FullscreenDocument);
    const fullscreenSupported = !!doc && Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
    els.fullscreen.hidden = !fullscreenSupported;
    const fullscreenActive = this.hasAttribute("data-fullscreen");
    const label = fullscreenActive ? "Exit fullscreen" : "Fullscreen";
    if (els.fullscreen.dataset.label !== label) {
      els.fullscreen.dataset.label = label;
      els.fullscreen.innerHTML = `${fullscreenActive ? ICON_COLLAPSE : ICON_EXPAND}${label}`;
    }
  }

  private _bindControls() {
    const els = this._els;
    els.toggle.addEventListener("click", () => void this.toggle());
    els.skip.addEventListener("click", () => void this.skip());
    this._root.querySelector('[data-action="reset"]')?.addEventListener("click", () => this.reset());
    els.fullscreen.addEventListener("click", () => void this.toggleFullscreen());

    for (const button of els.presets) {
      button.addEventListener("click", () => {
        const preset = TIMER_PRESETS.find((p) => p.key === button.dataset.preset);
        if (!preset || this._running) return;
        this.applyConfig(preset.config);
        this._announce(`${preset.label}: ${describeConfig(preset.config)}.`);
      });
    }

    els.roundSelect.addEventListener("change", () => this._updateFromUi({ roundSeconds: Number(els.roundSelect.value) }));
    els.restSelect.addEventListener("change", () => this._updateFromUi({ restSeconds: Number(els.restSelect.value) }));
    els.roundsInput.addEventListener("input", () => {
      const raw = els.roundsInput.value;
      const value = Number(raw);
      if (raw !== "" && Number.isFinite(value)) this._updateFromUi({ rounds: value });
    });
    els.roundsInput.addEventListener("blur", () => {
      els.roundsInput.value = String(this._config.rounds);
    });

    els.matchSelect.addEventListener("change", () => {
      const [division, belt] = els.matchSelect.value.split(":");
      const seconds = belt ? matchSeconds(belt, division as MatchDivision) : null;
      if (!seconds) return;
      this.applyConfig({ roundSeconds: seconds, restSeconds: 0, rounds: 1 });
      this._announce(
        `Set to one ${formatDuration(seconds)} round for a ${belt} belt ${DIVISION_LABELS[division as MatchDivision].toLowerCase()} match.`,
      );
    });

    els.warning.addEventListener("change", () => {
      this.warning = els.warning.checked;
    });
    els.wake.addEventListener("change", () => {
      this.keepAwake = els.wake.checked;
    });
  }

  /** A settings change from the UI. A finished session starts over on a new
   *  setup; a paused one keeps its place. */
  private _updateFromUi(patch: Partial<TimerConfig>) {
    if (this.phase === "done") this._resetState();
    this._config = normalizeConfig({ ...this._config, ...patch });
    this._persist();
    this._emit("bjj-timer:config-change");
    this._update();
  }

  // ---- Attributes, credit, persistence -------------------------------------

  private _configFromAttributes(): TimerConfig {
    let base: TimerConfig = DEFAULT_TIMER_CONFIG;
    const preset = TIMER_PRESETS.find((p) => p.key === this.getAttribute("preset")?.trim().toLowerCase());
    if (preset) base = preset.config;
    const belt = this.getAttribute("belt");
    if (belt) {
      const division: MatchDivision = /master/i.test(this.getAttribute("division") ?? "") ? "master-1" : "adult";
      const seconds = matchSeconds(belt, division);
      if (seconds) base = { roundSeconds: seconds, restSeconds: 0, rounds: 1 };
    }
    return normalizeConfig({
      roundSeconds: parseDuration(this.getAttribute("round")) ?? base.roundSeconds,
      restSeconds: parseDuration(this.getAttribute("rest")) ?? base.restSeconds,
      rounds: parseCount(this.getAttribute("rounds")) ?? base.rounds,
    });
  }

  /** The credit link lives in the light DOM so crawlers and readers see it.
   *  A link the page already provides with slot="credit" is used as is. */
  private _ensureCredit() {
    if (this._dedupeCredit()) return;
    const link = document.createElement("a");
    link.slot = "credit";
    link.href = CREDIT_URL;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = CREDIT_TEXT;
    link.setAttribute("data-bjj-timer-credit", "");
    this.append(link);
  }

  /** Drops the built-in link when it is hidden or the page supplies its own.
   *  Returns true when no built-in link should be added. The parser can
   *  connect the element before its children arrive, so this also runs when
   *  children change. It never re-adds a link someone removed. */
  private _dedupeCredit(): boolean {
    const children = Array.from(this.children);
    const auto = children.find((child) => child.hasAttribute("data-bjj-timer-credit"));
    const own = children.some((child) => child.getAttribute("slot") === "credit" && child !== auto);
    if (this.hasAttribute("no-credit") || own) {
      auto?.remove();
      return true;
    }
    return Boolean(auto);
  }

  private _storageKey(): string | null {
    const value = this.getAttribute("persist");
    if (value === null) return null;
    return `bjj-timer:${value.trim() || "default"}`;
  }

  private _readPersisted(): Persisted | null {
    const key = this._storageKey();
    if (!key) return null;
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Persisted) : null;
      return parsed && parsed.v === 1 && parsed.config ? parsed : null;
    } catch {
      return null;
    }
  }

  private _persist() {
    const key = this._storageKey();
    if (!key || !this._initialized) return;
    try {
      const payload: Persisted = { v: 1, config: this._config, warning: this._warning, wake: this._wake };
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      /* storage unavailable */
    }
  }

  // ---- Side effects ----------------------------------------------------------

  private async _unlockAudio() {
    if (this.muted) return;
    this._sounds ??= getTimerSounds();
    try {
      await this._sounds.unlock();
    } catch {
      /* sound is best effort */
    }
  }

  private async _acquireWakeLock() {
    if (!this._wake || !this._running || this._wakeLock) return;
    const wakeLock = (typeof navigator === "undefined" ? undefined : (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock);
    if (!wakeLock) {
      this._setSupport("This browser does not support keeping the screen awake.");
      return;
    }
    try {
      this._wakeLock = await wakeLock.request("screen");
      this._setSupport("Screen wake lock is on while the timer runs.");
    } catch {
      this._setSupport("This browser blocked keeping the screen awake.");
    }
  }

  private async _releaseWakeLock() {
    const lock = this._wakeLock;
    this._wakeLock = null;
    if (!lock) return;
    try {
      await lock.release();
    } catch {
      /* already released */
    }
  }

  private get _sfx(): TimerSounds | null {
    return this.muted ? null : this._sounds;
  }

  private _setSupport(text: string) {
    setText(this._els.support, text);
  }

  private _announce(text: string) {
    // Clear then set so a repeated message is read again.
    this._els.live.textContent = "";
    this._els.live.textContent = text;
  }

  private _emit(name: BjjTimerEventName) {
    const position = this._position();
    const detail: BjjTimerEventDetail = {
      phase: position.phase,
      round: Math.min(position.round, this._config.rounds),
      rounds: this._config.rounds,
      remaining: position.phase === "ready" ? this._config.roundSeconds : position.remaining,
      elapsed: this.elapsed,
      running: this._running,
      config: { ...this._config },
    };
    this.dispatchEvent(new CustomEvent<BjjTimerEventDetail>(name, { detail, bubbles: true, composed: true }));
  }

  // ---- Listeners -------------------------------------------------------------

  private _bindGlobalKeys() {
    window.removeEventListener("keydown", this._onGlobalKeyDown);
    if (this.hasAttribute("global-keys")) window.addEventListener("keydown", this._onGlobalKeyDown);
  }

  private _onKeyDown = (event: KeyboardEvent) => {
    if (this.hasAttribute("global-keys")) return; // the window listener handles it
    this._handleKey(event);
  };

  private _onGlobalKeyDown = (event: KeyboardEvent) => {
    this._handleKey(event);
  };

  private _handleKey(event: KeyboardEvent) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = (event.composedPath?.()[0] ?? event.target) as Element | null;
    if (isTypingTarget(target)) return;
    const key = event.key.toLowerCase();
    if (key === " " || key === "spacebar") {
      // A focused button already handles Space itself.
      if (isActivatable(target)) return;
      event.preventDefault();
      void this.toggle();
    } else if (key === "r") {
      this.reset();
    } else if (key === "n") {
      void this.skip();
    } else if (key === "f") {
      void this.toggleFullscreen();
    }
  }

  private _onVisibility = () => {
    if (document.visibilityState !== "visible") return;
    this._update();
    if (this._running) {
      // The browser drops the wake lock when the page is hidden.
      this._wakeLock = null;
      void this._acquireWakeLock();
    }
  };

  private _onFullscreenChange = () => {
    const doc = document as FullscreenDocument;
    const current = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
    this.toggleAttribute("data-fullscreen", current === this);
    this._update();
  };
}

function setText(el: Element, text: string) {
  if (el.textContent !== text) el.textContent = text;
}

/** Register the element. Safe to call more than once. */
export function defineBjjTimer(tagName = "bjj-timer"): void {
  if (typeof customElements === "undefined" || customElements.get(tagName)) return;
  customElements.define(tagName, tagName === "bjj-timer" ? BjjTimerElement : class extends BjjTimerElement {});
}

declare global {
  interface HTMLElementTagNameMap {
    "bjj-timer": BjjTimerElement;
  }
  interface HTMLElementEventMap {
    "bjj-timer:start": CustomEvent<BjjTimerEventDetail>;
    "bjj-timer:pause": CustomEvent<BjjTimerEventDetail>;
    "bjj-timer:resume": CustomEvent<BjjTimerEventDetail>;
    "bjj-timer:reset": CustomEvent<BjjTimerEventDetail>;
    "bjj-timer:skip": CustomEvent<BjjTimerEventDetail>;
    "bjj-timer:phase": CustomEvent<BjjTimerEventDetail>;
    "bjj-timer:round-start": CustomEvent<BjjTimerEventDetail>;
    "bjj-timer:rest-start": CustomEvent<BjjTimerEventDetail>;
    "bjj-timer:warning": CustomEvent<BjjTimerEventDetail>;
    "bjj-timer:tick": CustomEvent<BjjTimerEventDetail>;
    "bjj-timer:done": CustomEvent<BjjTimerEventDetail>;
    "bjj-timer:config-change": CustomEvent<BjjTimerEventDetail>;
  }
}
