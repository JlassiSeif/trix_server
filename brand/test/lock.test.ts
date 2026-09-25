// The brand is locked (brand/BRAND.md): every logo, icon and token file, and every copy the website
// serves, must match the fingerprint in LOCK.json. A change fails here until Seif approves it and the
// kit is rebuilt (node brand/build.mjs), which rewrites the lock.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const lock = JSON.parse(readFileSync(join(root, "brand/LOCK.json"), "utf8")) as { files: Record<string, string> };

describe("Dineri's brand is locked", () => {
  it("every locked file matches its fingerprint", () => {
    const changed = Object.entries(lock.files).filter(([file, hash]) => createHash("sha256").update(readFileSync(join(root, file))).digest("hex") !== hash);
    expect(changed.map(([f]) => f), "brand files changed without an approved rebuild (brand/BRAND.md §9)").toEqual([]);
  });

  it("the CSS and JSON tokens agree", () => {
    const css = readFileSync(join(root, "brand/tokens.css"), "utf8");
    const json = JSON.parse(readFileSync(join(root, "brand/tokens.json"), "utf8")) as { color: Record<string, string> };
    for (const [name, value] of Object.entries(json.color)) expect(css, name).toContain(`--dineri-${name}: ${value};`);
  });

  it("the website takes its colours from the brand tokens", () => {
    const shell = readFileSync(join(root, "platform/web/src/shell.css"), "utf8");
    expect(shell).toContain('@import "@dineri/brand/tokens.css"');
  });
});
