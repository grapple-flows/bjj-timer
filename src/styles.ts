// Shadow DOM styles for <bjj-timer>. Every public knob is a --bjj-timer-*
// custom property; the private --_* properties resolve them to defaults so
// theme="dark" can swap defaults without overriding a page's own values.

export const styles: string = /* css */ `
:host {
  --_bg: var(--bjj-timer-bg, #f5f3ef);
  --_surface: var(--bjj-timer-surface, #ffffff);
  --_text: var(--bjj-timer-text, #18181b);
  --_muted: var(--bjj-timer-muted, #71717a);
  --_line: var(--bjj-timer-line, #d4d4d8);
  --_line-soft: var(--bjj-timer-line-soft, #e7e5e4);
  --_track: var(--bjj-timer-track, rgba(24, 24, 27, 0.07));
  --_idle: var(--bjj-timer-idle-color, rgba(24, 24, 27, 0.18));
  --_work: var(--bjj-timer-work-color, #7e0986);
  --_rest: var(--bjj-timer-rest-color, #0e7490);
  --_countdown: var(--bjj-timer-countdown-color, #b45309);
  --_done: var(--bjj-timer-done-color, #15803d);
  --_on-accent: var(--bjj-timer-on-accent, #ffffff);
  --_font: var(--bjj-timer-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  --_mono: var(--bjj-timer-mono-font, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  --_radius: var(--bjj-timer-radius, 12px);
  --_control-radius: var(--bjj-timer-control-radius, 999px);
  --_max: var(--bjj-timer-max-width, 760px);

  display: block;
  container-type: inline-size;
  font-family: var(--_font);
  color: var(--_text);
  -webkit-tap-highlight-color: transparent;
}

:host([theme="dark"]) {
  --_bg: var(--bjj-timer-bg, #111113);
  --_surface: var(--bjj-timer-surface, #1c1c1f);
  --_text: var(--bjj-timer-text, #f4f4f5);
  --_muted: var(--bjj-timer-muted, #a1a1aa);
  --_line: var(--bjj-timer-line, #3f3f46);
  --_line-soft: var(--bjj-timer-line-soft, #2e2e33);
  --_track: var(--bjj-timer-track, rgba(255, 255, 255, 0.08));
  --_idle: var(--bjj-timer-idle-color, rgba(255, 255, 255, 0.22));
  --_work: var(--bjj-timer-work-color, #c04acb);
  --_rest: var(--bjj-timer-rest-color, #22a3c4);
  --_countdown: var(--bjj-timer-countdown-color, #e0852b);
  --_done: var(--bjj-timer-done-color, #2fb463);
}

@media (prefers-color-scheme: dark) {
  :host([theme="auto"]) {
    --_bg: var(--bjj-timer-bg, #111113);
    --_surface: var(--bjj-timer-surface, #1c1c1f);
    --_text: var(--bjj-timer-text, #f4f4f5);
    --_muted: var(--bjj-timer-muted, #a1a1aa);
    --_line: var(--bjj-timer-line, #3f3f46);
    --_line-soft: var(--bjj-timer-line-soft, #2e2e33);
    --_track: var(--bjj-timer-track, rgba(255, 255, 255, 0.08));
    --_idle: var(--bjj-timer-idle-color, rgba(255, 255, 255, 0.22));
    --_work: var(--bjj-timer-work-color, #c04acb);
    --_rest: var(--bjj-timer-rest-color, #22a3c4);
    --_countdown: var(--bjj-timer-countdown-color, #e0852b);
    --_done: var(--bjj-timer-done-color, #2fb463);
  }
}

:host([hidden]) { display: none; }
:host(:focus) { outline: none; }
[hidden] { display: none !important; }

*, *::before, *::after { box-sizing: border-box; }

.timer {
  --accent: var(--_work);
  position: relative;
  color: var(--_text);
  background:
    radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 60%),
    var(--_bg);
  border-radius: var(--bjj-timer-outer-radius, 0);
  overflow: hidden;
  transition: background 600ms ease;
}
.timer[data-phase="countdown"] { --accent: var(--_countdown); }
.timer[data-phase="rest"] { --accent: var(--_rest); }
.timer[data-phase="done"] { --accent: var(--_done); }

/* ---- Progress ring and clock ------------------------------------------ */
.face {
  display: grid;
  place-items: center;
  padding: 32px 16px 24px;
}

.ring-wrap {
  position: relative;
  width: min(82cqi, 320px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
}

.ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
  filter: drop-shadow(0 6px 20px color-mix(in srgb, var(--accent) 18%, transparent));
}

.ring-track { fill: none; stroke: var(--_track); stroke-width: 10; }

.ring-progress {
  fill: none;
  stroke: var(--accent);
  stroke-width: 12;
  stroke-linecap: round;
  transition: stroke-dashoffset 280ms linear, stroke 500ms ease;
}
.timer[data-phase="ready"] .ring-progress { stroke: var(--_idle); }

.face-inner {
  position: relative;
  display: grid;
  place-items: center;
  gap: 6px;
  text-align: center;
}

.phase, .round {
  margin: 0;
  font-family: var(--_mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--_muted);
}
.phase {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.22em;
  color: var(--accent);
}
.timer[data-phase="ready"] .phase { color: var(--_muted); }

.time {
  font-family: var(--_mono);
  font-size: clamp(2.75rem, 15cqi, 5.25rem);
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.timer[data-phase="done"] .time { color: var(--accent); }

/* ---- Controls --------------------------------------------------------- */
.presets, .settings, .match, .toggles, .actions, .extras, .summary, .support {
  width: min(100% - 32px, var(--_max));
  margin-inline: auto;
}

.presets {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.preset {
  display: grid;
  gap: 2px;
  min-height: 52px;
  padding: 8px 10px;
  border: 1px solid var(--_line-soft);
  border-radius: 10px;
  background: var(--_surface);
  color: var(--_text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 180ms ease, background 180ms ease;
}
.preset:hover:not(:disabled) { border-color: var(--_line); }
.preset[aria-pressed="true"] {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--_surface));
}
.preset:disabled { opacity: 0.5; cursor: default; }
.preset-label { font-size: 14px; font-weight: 700; }
.preset-hint { font-family: var(--_mono); font-size: 11px; color: var(--_muted); }

.settings, .toggles, .actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding-top: 16px;
}
.toggles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.match { padding-top: 12px; }

.field {
  display: grid;
  gap: 8px;
  font-family: var(--_mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--_muted);
}

select, input[type="number"] {
  width: 100%;
  min-height: 46px;
  padding: 0 14px;
  border: 1px solid var(--_line);
  border-radius: var(--_control-radius);
  background: var(--_surface);
  color: var(--_text);
  font: 15px var(--_font);
  letter-spacing: normal;
  text-transform: none;
  appearance: none;
  -webkit-appearance: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
select {
  padding-right: 34px;
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: calc(100% - 19px) 50%, calc(100% - 14px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}
select:focus, input[type="number"]:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}
select:disabled, input:disabled { opacity: 0.55; }

.summary {
  margin-top: 10px;
  margin-bottom: 0;
  font-family: var(--_mono);
  font-size: 12px;
  color: var(--_muted);
  text-align: center;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 16px;
  border: 1px solid var(--_line-soft);
  border-radius: var(--_radius);
  background: var(--_surface);
  font-size: 14px;
  color: var(--_text);
  cursor: pointer;
  transition: border-color 160ms ease;
}
.toggle:hover { border-color: var(--_line); }
.toggle input { width: 18px; height: 18px; margin: 0; accent-color: var(--accent); cursor: pointer; }

.actions { padding-bottom: 16px; }

.button {
  min-height: 50px;
  padding: 0 16px;
  border: 1px solid var(--_line);
  border-radius: var(--_control-radius);
  background: var(--_surface);
  color: var(--_text);
  font: 700 15px var(--_font);
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease;
}
.button:hover:not(:disabled) { border-color: var(--_muted); }
.button:active:not(:disabled) { transform: translateY(1px) scale(0.99); }
.button:disabled { opacity: 0.45; cursor: default; }
.button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--_on-accent);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 32%, transparent);
}

.extras {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--_line-soft);
  border-radius: var(--_control-radius);
  background: var(--_surface);
  color: var(--_text);
  font: 600 14px var(--_font);
  cursor: pointer;
}
.chip:hover { border-color: var(--_line); }
.chip svg { width: 17px; height: 17px; }

button:focus-visible, select:focus-visible, input:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 45%, transparent);
  outline-offset: 2px;
}

.support {
  margin-top: 14px;
  margin-bottom: 0;
  padding-bottom: 12px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--_muted);
}
.keys { display: none; }
@media (hover: hover) and (pointer: fine) {
  .keys { display: inline; }
}

.credit {
  padding: 12px 16px 14px;
  text-align: center;
  font-size: 12px;
  color: var(--_muted);
}
::slotted(a) {
  color: var(--_muted);
  text-decoration: underline;
  text-underline-offset: 2px;
}
:host([no-credit]) .credit { display: none; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ---- Narrow containers ------------------------------------------------ */
@container (max-width: 560px) {
  .presets { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .settings { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .toggles, .actions { grid-template-columns: 1fr; }
  .actions { grid-template-columns: 2fr 1fr 1fr; gap: 8px; }
}
@container (max-width: 400px) {
  .preset { padding: 8px; }
  .preset-hint { font-size: 10px; letter-spacing: -0.02em; }
  select, input[type="number"] { padding-left: 12px; }
}
@container (max-width: 300px) {
  .settings, .actions { grid-template-columns: 1fr; }
}

/* ---- Minimal: clock and buttons only ---------------------------------- */
:host([minimal]) .presets,
:host([minimal]) .settings,
:host([minimal]) .match,
:host([minimal]) .summary,
:host([minimal]) .toggles,
:host([minimal]) .support { display: none; }

/* ---- Fullscreen (gym TV): the clock and the main buttons -------------- */
:host([data-fullscreen]) { width: 100vw; height: 100vh; height: 100dvh; }
:host([data-fullscreen]) .timer {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  border-radius: 0;
}
:host([data-fullscreen]) .presets,
:host([data-fullscreen]) .settings,
:host([data-fullscreen]) .match,
:host([data-fullscreen]) .summary,
:host([data-fullscreen]) .toggles,
:host([data-fullscreen]) .support { display: none; }
:host([data-fullscreen]) .face { padding: 16px; }
:host([data-fullscreen]) .ring-wrap { width: min(78vh, 90vw); }
:host([data-fullscreen]) .time { font-size: min(20vh, 22vw); }
:host([data-fullscreen]) .phase { font-size: min(3.4vh, 28px); }
:host([data-fullscreen]) .round { font-size: min(2.6vh, 20px); }
:host([data-fullscreen]) .actions { max-width: 560px; }

@media (prefers-reduced-motion: reduce) {
  .timer, .ring-progress, .button, .preset, .toggle, select, input {
    transition: none;
  }
  .button:active:not(:disabled) { transform: none; }
}
`;
