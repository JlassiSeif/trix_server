// docs/game-look.md §3: the kit and every game draw only with the brand's colours and typefaces.
// Hex codes, rgb()/hsl() other than black (shadows) and font families other than the brand's fail.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../../..");

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "node_modules" ? [] : cssFiles(p);
    return f.endsWith(".css") ? [p] : [];
  });
}

/** What breaks the house rules in one stylesheet (comments ignored). */
export function offBrand(css: string): string[] {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: string[] = [];
  for (const m of code.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) found.push(m[0]);
  for (const m of code.matchAll(/\b(rgba?|hsla?)\(([^)]*)\)/g)) if (!/^\s*0\s*,\s*0\s*,\s*0\s*(,|\))?/.test(m[2]! + ")")) found.push(m[0]);
  for (const m of code.matchAll(/font-family\s*:\s*([^;}]+)/g)) if (!/^\s*(var\(--(dineri-font|k-display|k-body)[^)]*\)|inherit)\s*$/.test(m[1]!)) found.push(m[0]);
  for (const m of code.matchAll(/(?<![-\w])font\s*:\s*([^;}]+)/g)) if (!/^\s*inherit\s*$/.test(m[1]!)) found.push(m[0]);
  return found;
}

const files = [join(root, "platform/ui/src/kit.css"), ...readdirSync(join(root, "games")).flatMap((g) => {
  const ui = join(root, "games", g, "ui/src");
  try {
    return cssFiles(ui);
  } catch {
    return [];
  }
})];

describe("one house: games use only the brand's colours and typefaces", () => {
  it("finds the stylesheets (the kit and at least Trix)", () => {
    expect(files.some((f) => f.endsWith("games/trix/ui/src/trix.css"))).toBe(true);
  });
  it.each(files.map((f) => [f.slice(root.length + 1), f]))("%s", (_name, file) => {
    expect(offBrand(readFileSync(file, "utf8"))).toEqual([]);
  });
  it("catches what it should", () => {
    expect(offBrand(".a { color: #f2c14e; }")).toEqual(["#f2c14e"]);
    expect(offBrand(".a { background: rgba(255,255,255,0.1); box-shadow: 0 0 4px rgba(0,0,0,0.3); }")).toEqual(["rgba(255,255,255,0.1)"]);
    expect(offBrand(".a { font-family: system-ui; } .b { font-family: var(--k-display); }")).toEqual(["font-family: system-ui"]);
    expect(offBrand(".a { color: var(--dineri-brass); } /* #fff in a comment is fine */")).toEqual([]);
  });
});
