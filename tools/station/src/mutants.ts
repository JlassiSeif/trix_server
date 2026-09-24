// Tests the tester: builds servers with deliberate bugs ("mutants") and checks the station
// catches each one. A mutant that survives means a blind spot in the checks.
//
//   npx tsx tools/station/src/mutants.ts

import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const work = join(root, ".station-runs", "mutants");

interface Mutant {
  name: string;
  file: string; // relative to packages/engine/src
  from: string;
  to: string;
  /** The referee check that should flag it. */
  expect: string;
}

const MUTANTS: Mutant[] = [
  { name: "lowest card wins the trick", file: "game.ts", from: "rankIndex(p.card) > rankIndex(best.card)", to: "rankIndex(p.card) < rankIndex(best.card)", expect: "trick-winner" },
  { name: "follow-suit not enforced", file: "game.ts", from: "return following.length > 0 ? following : [...hand]; // R-TRICK-2", to: "return [...hand]; // R-TRICK-2", expect: "follow-suit" },
  { name: "diamonds worth 20", file: "scoring.ts", from: "return diamonds === 8 ? 150 : diamonds * 10;", to: "return diamonds === 8 ? 150 : diamonds * 20;", expect: "score-dineri" },
  { name: "everyone multiplied, not just the picker", file: "scoring.ts", from: "(s === args.picker ? points * args.multiplier : points)", to: "(points * args.multiplier)", expect: "score-" },
  { name: "trix: a 10 fits right after the jack", file: "game.ts", from: "return r === stack.high + 1 || r === stack.low - 1;", to: "return r === stack.high + 1 || r === stack.low - 1 || r === 6;", expect: "trix-placement" },
  { name: "the view shows the next player's hand", file: "view.ts", from: "hand: state.hands[seat]!,", to: "hand: state.hands[(seat + 1) % 4]!,", expect: "hand-" },
  { name: "trix never due (no R-GAME-11)", file: "game.ts", from: 'if (remaining.includes("trix") && state.used[seat]!.length >= 5) return ["trix"];', to: "", expect: "trix-overdue" },
  { name: "the look at the last trick goes to everyone", file: "game.ts", from: 'return event.type === "lastTrickShown" ? event.seat : null;', to: "return null;", expect: "privacy-peek" },
];

rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const esbuild = join(root, "node_modules/.bin/esbuild");
const rows: string[] = [];
let survivors = 0;

for (const [i, m] of MUTANTS.entries()) {
  const dir = join(work, `m${i + 1}`);
  cpSync(join(root, "packages/engine/src"), join(dir, "engine"), { recursive: true });
  const path = join(dir, "engine", m.file);
  const src = readFileSync(path, "utf8");
  if (!src.includes(m.from)) throw new Error(`mutant "${m.name}": pattern not found in ${m.file}`);
  writeFileSync(path, src.replace(m.from, m.to));
  // The real server, bundled against the mutated engine.
  execFileSync(esbuild, [
    join(root, "apps/server/src/index.ts"), "--bundle", "--platform=node", "--format=esm", "--target=node22", "--external:ws",
    `--alias:@trix/engine=${join(dir, "engine/index.ts")}`, `--outfile=${join(dir, "server.js")}`, "--log-level=warning",
  ]);
  const run = spawnSync(process.execPath, ["--import", "tsx", join(root, "tools/station/src/main.ts"), "--only", "S01,S02,S21", "--seed", String(100 + i), "--server-js", join(dir, "server.js"), "--out", join(dir, "run")], {
    cwd: root,
    encoding: "utf8",
    timeout: 300_000,
  });
  const report = (() => {
    try {
      return readFileSync(join(dir, "run", "report.md"), "utf8");
    } catch {
      return "";
    }
  })();
  const caught = report.includes(`**${m.expect}`) || new RegExp(`\\*\\*${m.expect}[a-z-]*\\*\\*`).test(report);
  const anyFail = run.status !== 0;
  if (!caught) survivors++;
  const flagged = [...report.matchAll(/- \*\*([a-z-]+)\*\* ×(\d+)/g)].map((x) => `${x[1]}×${x[2]}`);
  rows.push(`| ${m.name} | \`${m.expect}…\` | ${caught ? "✅ caught" : anyFail ? "⚠️ failed, but not by the expected check" : "❌ survived"} | ${flagged.slice(0, 5).join(", ") || "-"} |`);
  console.log(`${caught ? "caught  " : "SURVIVED"} ${m.name}`);
}

const md = ["# Mutation check: does the station catch deliberate bugs?", "", "| Deliberate bug | Expected check | Result | What the station flagged |", "|---|---|---|---|", ...rows, "", `${MUTANTS.length - survivors}/${MUTANTS.length} caught.`, ""].join("\n");
writeFileSync(join(work, "mutants.md"), md);
console.log(`\n${MUTANTS.length - survivors}/${MUTANTS.length} mutants caught. ${join(work, "mutants.md")}`);
process.exit(survivors ? 1 : 0);
