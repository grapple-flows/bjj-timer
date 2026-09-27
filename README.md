# bjj-timer

A free BJJ round timer web component with IBJJF match times, rest periods, a 10-second warning, audio cues, fullscreen for a gym TV, and screen wake lock. One script tag, no framework, no dependencies.

Made by [Grapple Flows](https://grappleflows.com). Use it hosted at [grappleflows.com/timer](https://grappleflows.com/timer), or put it on your own site.

![bjj-timer web component running a 5:00 round with round and rest presets, IBJJF match times, and fullscreen controls](https://raw.githubusercontent.com/GrappleFlows/bjj-timer/main/docs/screenshot.png)

## Quick start

Add two lines to any HTML page:

```html
<script src="https://cdn.jsdelivr.net/npm/bjj-timer/dist/bjj-timer.min.js"></script>
<bjj-timer></bjj-timer>
```

That gives you the full timer: presets, round and rest settings, IBJJF match times, Start, Skip, Reset, and fullscreen. For a live site, pin a version (`bjj-timer@0.1.0`) so an update never changes your page unexpectedly. The same file is on unpkg at `https://unpkg.com/bjj-timer/dist/bjj-timer.min.js`.

### With npm

```sh
npm install bjj-timer
```

```js
import "bjj-timer"; // registers <bjj-timer>
```

The package is ESM, ships TypeScript types, and has no runtime dependencies. The timer math and the match-time table are also available without the element:

```js
import { positionAt, totalSeconds, IBJJF_MATCH_TIMES } from "bjj-timer/logic";
```

### No code? Use the embed

If you run a gym website and do not want to touch code, use the copy-and-paste embed at [grappleflows.com/tools#embed](https://grappleflows.com/tools#embed). It is an iframe of the hosted timer and works in WordPress, Squarespace, Wix, and any site builder that accepts an embed or HTML block. There is nothing to install and no account to create.

## Features

- Round and rest intervals, 1 to 30 rounds, rounds from 10 seconds to 60 minutes, rest up to 15 minutes.
- Presets for open mat, comp prep, positional sparring, and drilling.
- IBJJF match times by belt for adult and Master 1 divisions, one tap to set the clock.
- A 3-2-1 countdown into round one and into every round after a rest.
- A start and stop tone for every round.
- A 10-second warning: a wooden knock on 10, 9, and 8 seconds left. On by default.
- Clear states for ready, get ready, roll, rest, and done, with a progress ring and a color per phase.
- Fullscreen for a gym TV, with only the clock and the main buttons.
- Keep screen awake, using the Screen Wake Lock API where the browser supports it.
- Accurate time: the clock counts from when you pressed Start, so a locked phone or a background tab does not make it drift.
- Keyboard shortcuts: Space to start and pause, N for next, R to reset, F for fullscreen.
- Accessible controls: labelled buttons and fields, a polite live region that announces each round and rest, and no animation when the system asks for reduced motion.
- Themeable with CSS custom properties, with light, dark, and automatic themes built in.
- Fits its container, from a phone-width sidebar to a full-width page.
- All sounds are synthesized in the browser. No audio files to host.

## Attributes

| Attribute | Values | Default | What it does |
| --- | --- | --- | --- |
| `preset` | `open-mat`, `comp-prep`, `positional`, `drilling` | none | Starts from a preset setup. |
| `rounds` | 1 to 30 | `6` | Number of rounds. |
| `round` | seconds (`300`) or `m:ss` (`5:00`), 10 seconds to 60 minutes | `5:00` | Length of each round. |
| `rest` | seconds or `m:ss`, 0 to 15 minutes | `1:00` | Rest between rounds. There is no rest after the last round. |
| `belt` | `white`, `blue`, `purple`, `brown`, `black` | none | One round at the IBJJF match length for that belt, no rest. |
| `division` | `adult`, `master-1` | `adult` | Which IBJJF division `belt` uses. |
| `warning` | `on`, `off` | `on` | The 10-second warning knock. |
| `keep-awake` | boolean | off | Starts with Keep screen awake checked. |
| `muted` | boolean | off | No sounds. |
| `minimal` | boolean | off | Shows only the clock and the Start, Skip, and Reset buttons. |
| `theme` | `light`, `dark`, `auto` | `light` | `auto` follows the visitor's system setting. |
| `global-keys` | boolean | off | Keyboard shortcuts work anywhere on the page, not only when the timer has focus. Use it on a page with one timer. |
| `persist` | optional name | off | Remembers the setup and toggles in `localStorage`. Use different names for different timers. |
| `url-params` | boolean | off | Reads `?round=300&rest=60&rounds=6` from the page URL, so you can link to a specific setup. |
| `no-credit` | boolean | off | Removes the "Free BJJ timer by Grapple Flows" link. See [Credit link](#credit-link). |

`round`, `rest`, and `rounds` override `preset` and `belt`, so `<bjj-timer preset="comp-prep" rounds="3">` runs three comp-prep rounds. Out-of-range values are clamped. When the page loads, a URL setup (`url-params`) wins over a remembered one (`persist`), which wins over attributes. Changing a setup attribute later always applies it and resets the timer.

```html
<bjj-timer preset="drilling"></bjj-timer>
<bjj-timer rounds="5" round="6:00" rest="0:30"></bjj-timer>
<bjj-timer belt="purple"></bjj-timer>
<bjj-timer belt="black" division="master-1" warning="off"></bjj-timer>
```

## JavaScript API

```js
const timer = document.querySelector("bjj-timer");

await timer.start(); // start, or resume after a pause (a fresh start runs 3-2-1 first)
timer.pause(); // pause and keep the place
timer.toggle(); // start or pause
timer.reset(); // back to Ready on round one
await timer.skip(); // jump to the next round or rest
timer.applyConfig({ rounds: 5, roundSeconds: 360, restSeconds: 30 }); // load a setup and reset
await timer.toggleFullscreen(); // needs a click or key press from the user
```

| Property | Type | Notes |
| --- | --- | --- |
| `config` | `{ roundSeconds, restSeconds, rounds }` | Setting it is the same as `applyConfig()`. |
| `running` | `boolean` | Read only. |
| `phase` | `"ready" \| "countdown" \| "work" \| "rest" \| "done"` | Read only. `work` is a round. |
| `round` | `number` | Read only, starts at 1. |
| `remaining` | `number` | Read only. Seconds left in the current phase. |
| `elapsed` | `number` | Read only. Seconds since round one started, negative during the 3-2-1. |
| `totalSeconds` | `number` | Read only. All rounds plus the rests between them. |
| `warning` | `boolean` | The 10-second warning. |
| `keepAwake` | `boolean` | Keep screen awake. |
| `muted` | `boolean` | Reflects the `muted` attribute. |

To register under another tag name, import the ESM build and call `defineBjjTimer("gym-timer")`. The class is exported as `BjjTimerElement`. The IIFE build exposes everything on `window.BjjTimer`.

## Events

Every event bubbles, crosses the shadow boundary, and carries the same `detail`:

```ts
{
  phase: "ready" | "countdown" | "work" | "rest" | "done";
  round: number; // 1-based
  rounds: number;
  remaining: number; // seconds left in this phase
  elapsed: number; // seconds since round one started
  running: boolean;
  config: { roundSeconds: number; restSeconds: number; rounds: number };
}
```

| Event | Fires when |
| --- | --- |
| `bjj-timer:start` | A fresh start (the 3-2-1 begins). |
| `bjj-timer:round-start` | A round begins. |
| `bjj-timer:warning` | 10 seconds are left in a round (once per round, when the warning is on and the round is longer than 11 seconds). |
| `bjj-timer:rest-start` | A rest begins. |
| `bjj-timer:done` | The last round ends. |
| `bjj-timer:phase` | Any phase change (round, rest, or done). |
| `bjj-timer:tick` | The displayed second changes while running. |
| `bjj-timer:pause` | The timer is paused. |
| `bjj-timer:resume` | The timer resumes after a pause. |
| `bjj-timer:reset` | The timer is reset. |
| `bjj-timer:skip` | Skip is pressed. |
| `bjj-timer:config-change` | The setup changes (preset, settings, attribute, or `applyConfig`). |

```js
timer.addEventListener("bjj-timer:round-start", (event) => {
  console.log(`Round ${event.detail.round} of ${event.detail.rounds}`);
});
timer.addEventListener("bjj-timer:done", () => {
  document.title = "Rounds done";
});
```

## Theming

Set any of these on `bjj-timer` or an ancestor:

| Custom property | Light default | Used for |
| --- | --- | --- |
| `--bjj-timer-bg` | `#f5f3ef` | Background |
| `--bjj-timer-surface` | `#ffffff` | Buttons, fields, preset cards |
| `--bjj-timer-text` | `#18181b` | Text and the clock |
| `--bjj-timer-muted` | `#71717a` | Labels and help text |
| `--bjj-timer-line` | `#d4d4d8` | Field and button borders |
| `--bjj-timer-line-soft` | `#e7e5e4` | Card borders |
| `--bjj-timer-track` | `rgba(24, 24, 27, 0.07)` | Ring track |
| `--bjj-timer-idle-color` | `rgba(24, 24, 27, 0.18)` | Ring before Start |
| `--bjj-timer-work-color` | `#7e0986` | Rounds |
| `--bjj-timer-rest-color` | `#0e7490` | Rests |
| `--bjj-timer-countdown-color` | `#b45309` | The 3-2-1 |
| `--bjj-timer-done-color` | `#15803d` | Done |
| `--bjj-timer-on-accent` | `#ffffff` | Text on the Start button |
| `--bjj-timer-font` | system UI font | Text |
| `--bjj-timer-mono-font` | system monospace | Clock and labels |
| `--bjj-timer-radius` | `12px` | Toggle cards |
| `--bjj-timer-control-radius` | `999px` | Buttons and fields |
| `--bjj-timer-outer-radius` | `0` | Corners of the whole timer |
| `--bjj-timer-max-width` | `760px` | Width of the controls |

```css
bjj-timer {
  --bjj-timer-work-color: #b91c1c;
  --bjj-timer-font: "Inter", sans-serif;
  --bjj-timer-outer-radius: 16px;
}
```

For deeper changes, these parts can be styled with `::part()`: `timer`, `clock`, `phase`, `round`, `ring`, `presets`, `settings`, `summary`, `actions`, `button`, `start-button`, `fullscreen-button`, `credit`. The host element also carries `data-phase` and `data-running` attributes, so page CSS can react to the state, for example `bjj-timer[data-phase="rest"] { ... }`.

## How the timing works

The timer never counts ticks. It stores the moment you pressed Start and computes the round, the phase, and the time left from the time elapsed since then (`positionAt(config, elapsed)` in [`src/rollTimer.ts`](src/rollTimer.ts)). The display refreshes every animation frame while visible, and a one-second timer keeps phase changes going when a background tab stops drawing frames (browsers may slow that timer further). Either way the time shown is recomputed from the start timestamp, never accumulated. If a phone locks for two minutes, the timer shows the right round and time the moment it comes back.

Phones pause sound from pages that are not on screen, so the tones play on time only while the timer is visible. Turn on Keep screen awake and leave the page open during rounds. On iPhone, turn off silent mode to hear the tones through the speaker. Tap Start once to allow sound; browsers block audio until the visitor interacts with the page.

## IBJJF match times by belt

| Belt | Adult | Master 1 |
| --- | --- | --- |
| White | 5:00 | 5:00 |
| Blue | 6:00 | 6:00 |
| Purple | 7:00 | 6:00 |
| Brown | 8:00 | 6:00 |
| Black | 10:00 | 6:00 |

Source: [IBJJF Rules Book](https://ibjjf.com/books-videos), as used by the [Grapple Flows BJJ timer](https://grappleflows.com/timer). Juvenile (16 to 17) runs 5:00. Master 2 and older divisions are shorter. Always confirm against the current IBJJF rulebook for your event, since match lengths can change between rulebook versions. `<bjj-timer belt="brown">` sets one round of the adult brown belt length, and the in-timer IBJJF match time picker does the same for any row of this table.

## Presets

| Preset | Rounds | Round | Rest | Total |
| --- | --- | --- | --- | --- |
| Open mat | 6 | 5:00 | 1:00 | 35:00 |
| Comp prep | 5 | 6:00 | 0:30 | 32:00 |
| Positional | 8 | 2:00 | 0:15 | 17:45 |
| Drilling | 10 | 1:00 | 0:10 | 11:30 |

Comp prep runs a blue belt match length back to back with short rest, so the last round feels like a final. Positional rounds are short on purpose: start in a position, work until someone scores or escapes, then reset.

## How long is a BJJ round?

Most gyms roll 5 or 6 minute rounds with 1 minute of rest. Competition classes often match the IBJJF time for the belt: 5 minutes at white, 6 at blue, 7 at purple, 8 at brown, and 10 at black belt for adults. Drilling rounds are usually 1 to 2 minutes with a few seconds of rest to switch partners or sides. Positional sparring rounds are often 1 to 3 minutes.

## Using it on a gym TV

Open a page with the timer on a laptop or a smart TV browser and press Fullscreen, or press F. The clock grows to fill the screen, the other settings are hidden, and the color changes between roll, rest, and done, so everyone can read it from across the mat. The tones play through whatever speakers the TV or laptop uses.

For a dedicated TV page, use a dark theme, the minimal layout, and page-wide shortcuts so a wireless keyboard or presenter remote can run it:

```html
<bjj-timer theme="dark" minimal global-keys keep-awake preset="open-mat"></bjj-timer>
```

Keep screen awake stops the display from sleeping while the timer runs, in browsers that support the Screen Wake Lock API (current Chrome, Edge, Safari, and Firefox). iPhone Safari has no element fullscreen, so the Fullscreen button is hidden there instead of shown broken.

## Credit link

By default the timer adds one small link under the buttons: "Free BJJ timer by Grapple Flows", pointing to `https://grappleflows.com/timer` with `utm_source=github` tags. It is a normal `<a slot="credit">` child of `<bjj-timer>` in your page's DOM, not hidden inside the shadow DOM, so readers and search engines see it the same way. It opens in a new tab so it never interrupts a running timer.

To keep the link but control it, write it yourself and the timer will use yours instead of adding one. This also makes it visible to crawlers that do not run JavaScript:

```html
<bjj-timer>
  <a slot="credit" href="https://grappleflows.com/timer">Free BJJ timer by Grapple Flows</a>
</bjj-timer>
```

To remove it, add `no-credit`:

```html
<bjj-timer no-credit></bjj-timer>
```

The MIT license does not require the link, and you are free to remove it. If the timer is useful to your gym, keeping it is a simple way to help other people find it.

## Browser support

Current Chrome, Edge, Safari, and Firefox on desktop and mobile: Chrome and Edge 111+, Safari 16.2+, Firefox 113+. The timer uses custom elements, shadow DOM, container queries, and `color-mix()`. Keep screen awake needs the Screen Wake Lock API (Chrome 84+, Safari 16.4+, Firefox 126+); without it the help text under the buttons says the browser does not support it. Importing the package in Node for server rendering does not throw; the element renders in the browser.

## Development

```sh
npm ci
npm run typecheck
npm test
npm run build
```

`npm run build` writes `dist/bjj-timer.js` (ESM, registers the element on import), `dist/logic.js` (timer math and match times only), `dist/bjj-timer.min.js` (minified, self-registering, for a script tag), and the `.d.ts` type declarations. To try the demo, build, serve the repository root with any static file server (for example `python3 -m http.server`), and open `/demo/`.

The timer logic in [`src/rollTimer.ts`](src/rollTimer.ts) is the same code that runs [grappleflows.com/timer](https://grappleflows.com/timer), and its tests are in [`test/rollTimer.test.ts`](test/rollTimer.test.ts).

## Related

- [bjj-scoreboard](https://github.com/GrappleFlows/bjj-scoreboard): an IBJJF scoreboard web component with points, advantages, penalties, tiebreaks, and a match clock.
- [bjj-bracket](https://github.com/GrappleFlows/bjj-bracket): a tournament bracket generator for single elimination, double elimination, and round robin.
- [bjj-data](https://github.com/GrappleFlows/bjj-data): IBJJF and ADCC weight classes, legal techniques by ruleset, IBJJF belt requirements, and a BJJ position vocabulary as JSON and a typed npm package.

## About Grapple Flows

Grapple Flows is a free BJJ flowchart app that turns voice notes and videos into visual maps of jiu-jitsu techniques, positions, and transitions you can study, edit, and share.

- App: [grappleflows.com](https://grappleflows.com)
- Free BJJ tools, including this timer, a scoreboard, and a bracket generator: [grappleflows.com/tools](https://grappleflows.com/tools)

## License

[MIT](LICENSE), copyright Grapple Flows.
