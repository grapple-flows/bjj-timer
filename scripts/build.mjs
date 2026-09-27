// Builds dist/:
//   bjj-timer.js      ESM for bundlers and npm (registers <bjj-timer> on import)
//   logic.js          ESM timer math and match times, no element, no side effects
//   bjj-timer.min.js  minified IIFE for a <script> tag (jsDelivr, unpkg)
//   *.d.ts            type declarations from tsc
import { build, transform } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const banner = `/*! bjj-timer v${pkg.version} | MIT License | (c) Grapple Flows | https://grappleflows.com/timer */`;

rmSync("dist", { recursive: true, force: true });

// Minify the shadow DOM stylesheet (a template string in src/styles.ts) with
// esbuild's CSS minifier, since JS minification leaves strings alone.
const minifyStyles = {
  name: "minify-styles",
  setup(b) {
    b.onLoad({ filter: /[\\/]src[\\/]styles\.ts$/ }, async (args) => {
      const source = readFileSync(args.path, "utf8");
      const css = source.slice(source.indexOf("`") + 1, source.lastIndexOf("`"));
      const { code } = await transform(css, { loader: "css", minify: true });
      return { contents: `export const styles = ${JSON.stringify(code.trim())};`, loader: "js" };
    });
  },
};

const shared = { plugins: [minifyStyles], bundle: true, target: "es2020", legalComments: "inline", banner: { js: banner }, logLevel: "warning" };

await build({ ...shared, entryPoints: { "bjj-timer": "src/bjj-timer.ts", logic: "src/logic.ts" }, outdir: "dist", format: "esm" });
await build({ ...shared, entryPoints: ["src/bjj-timer.ts"], outfile: "dist/bjj-timer.min.js", format: "iife", globalName: "BjjTimer", minify: true, mangleProps: /^_[a-zA-Z]/ });

execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json"], { stdio: "inherit" });

for (const file of ["bjj-timer.js", "bjj-timer.min.js", "logic.js"]) {
  const bytes = readFileSync(`dist/${file}`);
  console.log(`dist/${file}  ${(bytes.length / 1024).toFixed(1)} kB  (${(gzipSync(bytes).length / 1024).toFixed(1)} kB gzip)`);
}
