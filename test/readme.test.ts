// @vitest-environment node
// The README's reference tables are hand-written for readers and search
// engines. These checks keep them in step with the data the timer runs on.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TIMER_PRESETS, formatDuration, totalSeconds } from "../src/rollTimer";
import { IBJJF_MATCH_TIMES } from "../src/matchTimes";
import { CREDIT_URL } from "../src/element";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

/** Rows of the first Markdown table after a heading, without the header. */
const tableAfter = (heading: string): string[][] => {
  const start = readme.indexOf(`## ${heading}\n`);
  expect(start, `heading "${heading}"`).toBeGreaterThan(-1);
  const lines = readme.slice(start).split("\n");
  const first = lines.findIndex((line) => line.startsWith("|"));
  const rows: string[][] = [];
  for (const line of lines.slice(first + 2)) {
    if (!line.startsWith("|")) break;
    rows.push(line.split("|").slice(1, -1).map((cell) => cell.trim()));
  }
  return rows;
};

describe("README", () => {
  it("presets table matches the presets", () => {
    expect(tableAfter("Presets")).toEqual(
      TIMER_PRESETS.map((preset) => [
        preset.label,
        String(preset.config.rounds),
        formatDuration(preset.config.roundSeconds),
        formatDuration(preset.config.restSeconds),
        formatDuration(totalSeconds(preset.config)),
      ]),
    );
  });

  it("IBJJF table matches the match times", () => {
    expect(tableAfter("IBJJF match times by belt")).toEqual(
      IBJJF_MATCH_TIMES.map((row) => [row.label, formatDuration(row.adult), formatDuration(row.master1)]),
    );
  });

  it("names the hosted tool and the credit URL", () => {
    expect(readme).toContain("https://grappleflows.com/timer");
    expect(CREDIT_URL).toBe(
      "https://grappleflows.com/timer?utm_source=github&utm_medium=referral&utm_campaign=bjj-timer&ref=github",
    );
  });
});
