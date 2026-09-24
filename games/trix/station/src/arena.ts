// The bot arena (docs/bots.md §9): complete games inside the engine, no server, with mixed
// levels. Each bot gets exactly what the server gives it: its own view and the public events
// of the current contract. Reports win and loss rates with 95% error margins, how each level
// does with the contracts it picks, and how long hard thinks.
//
//   npm run arena                       all matchups, default game counts
//   npm run arena -- --games 200 --only A,B --out docs/bots-arena.md

import { writeFileSync } from "node:fs";
import {
  applyAction,
  botAction,
  createGame,
  placeholderBotAction,
  privateTo,
  seededRng,
  viewFor,
  type Action,
  type BotLevel,
  type Contract,
  type GameEvent,
  type Seat,
} from "@games/trix";

type Player = BotLevel | "placeholder";
const args = process.argv.slice(2);
const opt = (name: string, dflt: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1]! : dflt);
const only = opt("only", "A,B,C,D").split(",");
const gamesOverride = args.includes("--games") ? Number(opt("games", "0")) : 0;
const out = opt("out", "");
const seedBase = Number(opt("seed", "1"));

interface Matchup {
  id: string;
  title: string;
  focal: Player;
  others: Player;
  games: number;
  /** "better": focal must beat its share clearly. "notWorse": focal must not be clearly worse. */
  goal: "better" | "notWorse" | "info";
}
const MATCHUPS: Matchup[] = [
  { id: "A", title: "one hard vs three medium", focal: "hard", others: "medium", games: 400, goal: "better" },
  { id: "B", title: "one medium vs three easy", focal: "medium", others: "easy", games: 1500, goal: "better" },
  { id: "C", title: "one easy vs three placeholder bots", focal: "easy", others: "placeholder", games: 1500, goal: "notWorse" },
  { id: "D", title: "one hard vs three easy", focal: "hard", others: "easy", games: 300, goal: "info" },
];

interface PickRecord {
  level: Player;
  contract: Contract;
  multiplier: number;
  score: number;
}

const hardMs: number[] = [];
const picks: PickRecord[] = [];

function playGame(seed: number, players: Player[]) {
  let state = createGame({ seed });
  let log: GameEvent[] = [];
  const rngs = players.map((_, i) => seededRng(seed * 31 + i + 7));
  let pending: { level: Player; contract: Contract; multiplier: number; picker: Seat } | null = null;
  for (let guard = 0; state.phase !== "gameOver"; guard++) {
    if (guard > 5000) throw new Error(`game ${seed} did not finish`);
    let actor: Seat | "system";
    let action: Action | null;
    if (state.phase === "contractEnd") {
      actor = "system";
      action = { type: "nextContract" };
    } else {
      const seat = (state.phase === "picking" ? state.picker : state.turn) as Seat;
      actor = seat;
      const p = players[seat]!;
      if (p === "placeholder") action = placeholderBotAction(state, seat);
      else {
        const t0 = performance.now();
        action = botAction(p, viewFor(state, seat), log, rngs[seat]!);
        if (p === "hard") hardMs.push(performance.now() - t0);
      }
    }
    if (!action) throw new Error(`game ${seed}: no move for ${String(actor)} in ${state.phase}`);
    const r = applyAction(state, actor, action);
    if (!r.ok) throw new Error(`game ${seed}: ${players[actor as Seat]} made an illegal move ${JSON.stringify(action)}: ${r.error.code}`);
    state = r.state;
    for (const e of r.events) {
      if (e.type === "dealt") log = [];
      else if (privateTo(e) === null) log.push(e);
      if (e.type === "picked") pending = { level: players[e.seat]!, contract: e.contract, multiplier: e.multiplier, picker: e.seat };
      if (e.type === "contractScored" && pending) {
        picks.push({ level: pending.level, contract: pending.contract, multiplier: pending.multiplier, score: e.result.scores[pending.picker]! });
        pending = null;
      }
    }
  }
  return state.standings!;
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const margin = (p: number, n: number) => 1.96 * Math.sqrt((p * (1 - p)) / n);

const lines: string[] = [];
const say = (s = "") => {
  lines.push(s);
  console.log(s);
};
let allOk = true;
say(`# Bot arena (${new Date().toISOString().slice(0, 10)})`);
say();
say("Complete games inside the engine. The level under test sits at a different seat each game. Win = lowest total at the end (a tie shares it); loss = highest total. With four players, an equal player wins and loses 25% of the time.");
say();
say("| Matchup | Games | Wins (±95%) | Losses (±95%) | Average rank | Verdict |");
say("|---|---|---|---|---|---|");
const started = Date.now();
for (const m of MATCHUPS.filter((x) => only.includes(x.id))) {
  const n = gamesOverride || m.games;
  let wins = 0;
  let losses = 0;
  let rankSum = 0;
  for (let g = 0; g < n; g++) {
    const focalSeat = g % 4;
    const players = [0, 1, 2, 3].map((s) => (s === focalSeat ? m.focal : m.others));
    const st = playGame(seedBase * 100_000 + g, players);
    if (st.winners.includes(focalSeat as Seat)) wins += 1 / st.winners.length;
    if (st.losers.includes(focalSeat as Seat)) losses += 1 / st.losers.length;
    rankSum += 1 + st.totals.filter((t) => t < st.totals[focalSeat]!).length;
  }
  const w = wins / n;
  const l = losses / n;
  const [mw, ml] = [margin(w, n), margin(l, n)];
  let verdict = "for information";
  if (m.goal === "better") {
    const ok = w - mw > 0.25 && l + ml < 0.25;
    verdict = ok ? "✅ clearly better" : "❌ not clearly better";
    allOk &&= ok;
  } else if (m.goal === "notWorse") {
    const ok = w + mw >= 0.25 && l - ml <= 0.25;
    verdict = ok ? "✅ not worse" : "❌ worse";
    allOk &&= ok;
  }
  say(`| ${m.id}: ${m.title} | ${n} | ${pct(w)} ± ${pct(mw)} | ${pct(l)} ± ${pct(ml)} | ${(rankSum / n).toFixed(2)} | ${verdict} |`);
}
say();

// How each level does with the contracts it picks: the picker's own score (multiplier included).
say("## Picking: the picker's own score in the contracts it chose");
say();
const levels = [...new Set(picks.map((p) => p.level))];
const contracts: Contract[] = ["dineri", "damet", "pli", "farcha", "ray", "general", "trix"];
say(`| Level | ${contracts.join(" | ")} | ×4 last picks | All picks |`);
say(`|---|${contracts.map(() => "---").join("|")}|---|---|`);
for (const lv of levels) {
  const mine = picks.filter((p) => p.level === lv);
  const avg = (xs: PickRecord[]) => (xs.length ? (xs.reduce((a, p) => a + p.score, 0) / xs.length).toFixed(0) : "-");
  const cells = contracts.map((c) => avg(mine.filter((p) => p.contract === c)));
  const forced = mine.filter((p) => p.multiplier === 4);
  say(`| ${lv} | ${cells.join(" | ")} | ${avg(forced)} (${forced.length}) | ${avg(mine)} (${mine.length}) |`);
}
say();

if (hardMs.length) {
  const sorted = [...hardMs].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!.toFixed(1);
  const under = sorted.filter((x) => x <= 30).length / sorted.length;
  const ok = under >= 0.99;
  allOk &&= ok;
  say("## Hard's thinking time per move");
  say();
  say(`${sorted.length} moves: median ${q(0.5)} ms, 99th percentile ${q(0.99)} ms, slowest ${sorted.at(-1)!.toFixed(1)} ms. Under 30 ms: ${pct(under)} ${ok ? "✅" : "❌ (want 99%)"}.`);
  say();
}
say(`Run time ${((Date.now() - started) / 1000).toFixed(0)} s. ${allOk ? "All checks passed." : "Some checks FAILED."}`);
if (out) writeFileSync(out, lines.join("\n") + "\n");
process.exit(allOk ? 0 : 1);
