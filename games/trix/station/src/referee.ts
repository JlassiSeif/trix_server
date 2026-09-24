// An independent referee. It re-implements the rules it checks straight from RULES.md
// (it does not call the engine), so it can catch engine bugs as well as server bugs.

import type { GameEvent, PlayerView } from "@games/trix";

export const RANK = ["7", "8", "9", "j", "q", "k", "10", "a"]; // R-DECK-2
const suit = (c: string) => c.split("_")[1]!;
const rank = (c: string) => RANK.indexOf(c.split("_")[0]!);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export interface Finding {
  check: string;
  detail: string;
}

/** Checks on one player's view after an update (prev = that player's previous view). */
export function checkView(prev: PlayerView | null, view: PlayerView, events: GameEvent[]): Finding[] {
  const f: Finding[] = [];
  const bad = (check: string, detail: string) => f.push({ check, detail });
  const me = view.seat;

  // Own hand matches the public card count.
  if (view.hand.length !== view.handCounts[me]) bad("hand-count", `hand has ${view.hand.length} cards, handCounts says ${view.handCounts[me]}`);
  if (new Set(view.hand).size !== view.hand.length) bad("hand-duplicates", `duplicate cards in hand: ${view.hand.join(",")}`);

  // Every card is accounted for (R-DECK-1): hands + table + taken tricks, or hands + trix stacks.
  if (view.contract && view.contract !== "trix" && (view.phase === "tricks" || view.phase === "contractEnd")) {
    const total = sum(view.handCounts) + view.trick.length + 4 * sum(view.tricksWon);
    if (total !== 32) bad("card-conservation", `hands ${sum(view.handCounts)} + trick ${view.trick.length} + taken ${4 * sum(view.tricksWon)} = ${total}, not 32`);
  }
  if (view.contract === "trix" && (view.phase === "trix" || view.phase === "contractEnd")) {
    const onTable = Object.values(view.stacks).reduce((n, s) => n + (s ? s.high - s.low + 1 : 0), 0);
    if (sum(view.handCounts) + onTable !== 32) bad("card-conservation", `trix: hands ${sum(view.handCounts)} + stacks ${onTable} ≠ 32`);
  }

  // Legal moves: only your own cards; only on your turn (looking at the last trick is allowed any time).
  for (const a of view.legal) {
    if (a.type === "play" && !view.hand.includes(a.card)) bad("legal-not-in-hand", `legal play ${a.card} is not in hand`);
    if (a.type !== "peekLastTrick" && view.turn !== me) bad("legal-off-turn", `legal ${a.type} offered while turn is ${view.turn}`);
  }
  if ((view.phase === "tricks" || view.phase === "trix" || view.phase === "picking") && view.turn === me) {
    if (!view.legal.some((a) => a.type !== "peekLastTrick")) bad("no-legal-move", `my turn in ${view.phase} but no legal move`);
  }
  if (view.peeksLeft < 0 || view.peeksLeft > 2) bad("peeks-range", `peeksLeft ${view.peeksLeft}`);

  // Contracts picked: each at most once per player (R-GAME-1).
  view.used.forEach((u, s) => {
    if (new Set(u).size !== u.length) bad("contract-picked-twice", `seat ${s} used ${u.join(",")}`);
  });

  // History bookkeeping.
  const expectHistory = view.phase === "contractEnd" || view.phase === "gameOver" ? view.contractNo : view.contractNo - 1;
  if (view.history.length !== expectHistory) bad("history-length", `history ${view.history.length}, expected ${expectHistory} in ${view.phase}`);

  for (const e of events) {
    if (e.type === "lastTrickShown" && e.seat !== me) bad("privacy-peek", `received seat ${e.seat}'s look at the last trick`);
    if (!prev) continue;

    if (e.type === "cardPlayed") {
      if (prev.turn !== e.seat) bad("played-out-of-turn", `seat ${e.seat} played ${e.card} while turn was ${prev.turn}`);
      if (e.seat === me) {
        if (!prev.hand.includes(e.card)) bad("played-card-not-held", `I played ${e.card}, not in my previous hand`);
        if (prev.phase === "tricks" && prev.trick.length > 0) {
          const led = suit(prev.trick[0]!.card); // R-TRICK-2
          if (suit(e.card) !== led && prev.hand.some((c) => suit(c) === led)) bad("follow-suit", `played ${e.card} on ${led} while holding ${led}`);
        }
        if (prev.phase === "trix") {
          const st = prev.stacks[suit(e.card) as keyof typeof prev.stacks];
          const r = rank(e.card);
          const fits = st ? r === st.high + 1 || r === st.low - 1 : RANK[r] === "j"; // R-TRIX-1, R-TRIX-3
          if (!fits) bad("trix-placement", `placed ${e.card} on ${st ? `${RANK[st.low]}..${RANK[st.high]}` : "an unstarted suit"}`);
        }
      }
    }
    if (e.type === "kingDeclared") {
      // R-RAY-3: on your own turn, in ray or general, before your first card (only the holder knows the last two).
      if (prev.turn !== e.seat || prev.phase !== "tricks" || (prev.contract !== "ray" && prev.contract !== "general")) bad("declare-illegal", `seat ${e.seat} declared K♥ on turn ${prev.turn} in ${prev.phase} ${prev.contract}`);
      if (e.seat === me && !prev.hand.includes("k_h")) bad("declare-without-king", "I declared K♥ without holding it");
      if (prev.kingDeclaredBy !== null) bad("declare-twice", `K♥ declared again (already by seat ${prev.kingDeclaredBy})`);
    }
    if (e.type === "picked" && (prev.phase !== "picking" || prev.picker !== e.seat)) bad("picked-by-non-picker", `seat ${e.seat} picked, picker was ${prev.picker} in ${prev.phase}`);
    if (e.type === "picked") {
      // R-GAME-11: trix is due by the 6th pick.
      const before = prev.used[e.seat] ?? [];
      if (e.contract !== "trix" && !before.includes("trix") && before.length >= 5) bad("trix-overdue", `seat ${e.seat} picked ${e.contract} as pick ${before.length + 1} with trix unused`);
    }

    if (e.type === "trickWon") {
      const led = suit(e.cards[0]!.card); // R-TRICK-3
      const best = e.cards.filter((p) => suit(p.card) === led).sort((a, b) => rank(b.card) - rank(a.card))[0]!;
      if (e.cards.length !== 4) bad("trick-size", `trick of ${e.cards.length} cards`);
      if (best.seat !== e.seat) bad("trick-winner", `${e.cards.map((p) => p.card).join(" ")}: winner should be seat ${best.seat}, got ${e.seat}`);
    }

    if (e.type === "contractScored") f.push(...checkScores(prev, e.result));
    if (e.type === "gameOver") {
      const t = e.standings.totals;
      const max = Math.max(...t);
      const min = Math.min(...t);
      if (e.standings.reason === "overLimit" && max <= 1000) bad("game-over-reason", `over limit but max total ${max}`);
      if (e.standings.reason === "allContractsPlayed" && view.contractNo !== 28) bad("game-over-reason", `all contracts played at contract ${view.contractNo}`);
      if (!e.standings.losers.every((s) => t[s] === max) || !e.standings.winners.every((s) => t[s] === min)) bad("standings", `losers/winners do not match totals ${t}`);
    }
  }
  return f;
}

/** RULES.md §5 and §6: per-contract point totals, multipliers, and the 1000 rule. */
function checkScores(prev: PlayerView, r: Extract<GameEvent, { type: "contractScored" }>["result"]): Finding[] {
  const f: Finding[] = [];
  const bad = (detail: string) => f.push({ check: `score-${r.contract}`, detail: `contract ${r.contractNo}: ${detail} (raw ${r.raw}, scores ${r.scores})` });
  const raw = r.raw;
  const nonZero = raw.filter((x) => x !== 0);
  const declared = r.kingDeclaredBy !== null;
  switch (r.contract) {
    case "dineri": // 80 in tens, or one sweep of 150 (R-DIN-1, R-DIN-2)
      if (!(sum(raw) === 80 && raw.every((x) => x % 10 === 0 && x !== 150)) && !(nonZero.length === 1 && nonZero[0] === 150)) bad("diamond points should total 80, or one player 150");
      break;
    case "damet": // 4 queens × 20
      if (sum(raw) !== 80 || raw.some((x) => x % 20 !== 0)) bad("queen points should total 80");
      break;
    case "pli": // 8 tricks × 10, or one sweep of 150
      if (!(sum(raw) === 80 && raw.every((x) => x % 10 === 0 && x !== 150)) && !(nonZero.length === 1 && nonZero[0] === 150)) bad("trick points should total 80, or one player 150");
      break;
    case "farcha":
      if (!(nonZero.length === 1 && nonZero[0] === 100)) bad("exactly one player should get 100");
      break;
    case "ray":
      if (!(nonZero.length === 1 && nonZero[0] === (declared ? 200 : 100))) bad(`exactly one player should get ${declared ? 200 : 100}`);
      break;
    case "general": {
      // No sweep: dineri (80|150) + damet 80 + pli 80 + farcha 100 + ray (100|200). Sweep: everyone 0 (R-GEN-3).
      const ok = sum(raw) === 0 ? true : [440, 510, 540, 610].includes(sum(raw));
      if (!ok) bad(`points should total 440/510/540/610 (or 0 on a sweep), got ${sum(raw)}`);
      break;
    }
    case "trix":
      if ([...raw].sort((a, b) => a - b).join() !== "-100,-50,0,0") bad("should be −100, −50, 0, 0");
      break;
  }
  // Multiplier: picker ×2, ×4 on the 7th pick, never trix; declarer −50 unmultiplied (R-MULT-1..4, R-RAY-6).
  const forced = prev.used[r.picker]!.length === 7; // prev already includes this pick: it was their 7th
  const mult = r.contract === "trix" ? 1 : forced ? 4 : 2;
  if (r.multiplier !== mult) bad(`multiplier should be ${mult}, got ${r.multiplier}`);
  r.scores.forEach((sc, s) => {
    let expect = raw[s]! * (s === r.picker ? mult : 1);
    if (declared && r.kingTakenBy !== null && r.kingTakenBy !== r.kingDeclaredBy && s === r.kingDeclaredBy) expect -= 50;
    if (sc !== expect) bad(`seat ${s} should score ${expect}, got ${sc}`);
  });
  // Totals: add, then exactly 1000 → 0 (R-GAME-6).
  r.totals.forEach((t, s) => {
    const added = prev.totals[s]! + r.scores[s]!;
    const expect = added === 1000 ? 0 : added;
    if (t !== expect) f.push({ check: "totals", detail: `contract ${r.contractNo}: seat ${s} total should be ${expect}, got ${t}` });
  });
  return f;
}

/** The public part of a view: every player at the table must see exactly the same thing. */
export function publicPart(v: PlayerView) {
  return {
    phase: v.phase, contractNo: v.contractNo, picker: v.picker, contract: v.contract, multiplier: v.multiplier, forced: v.forced,
    turn: v.turn, handCounts: v.handCounts, trick: v.trick, tricksWon: v.tricksWon, lastTrickExists: v.lastTrickExists,
    kingDeclaredBy: v.kingDeclaredBy, stacks: v.stacks, finishers: v.finishers, totals: v.totals, used: v.used,
    history: v.history.length, standings: v.standings,
  };
}
