// Trix as a platform game (docs/architecture.md §4): the rules, bots and pacing behind the
// game contract. The platform runs rooms; everything Trix-specific is decided here.

import type { GameModule } from "@platform/sdk";
import { SEATS, type Seat } from "./cards";
import { BOT_LEVELS, botAction, type BotLevel } from "./bots";
import { placeholderBotAction } from "./bot";
import { applyAction, createGame, legalActions, privateTo, type GameEvent, type GameState } from "./game";
import { viewFor, type PlayerView } from "./view";

export const TRIX_VERSION = "1.0.0";

/** Pacing at normal speed, so everyone can follow what the bots do (docs/bots.md §1). */
export const TRIX_PACE = {
  botMoveMs: 900,
  botPickMs: 1400,
  /** After a trick is taken, so everyone sees what came out before the next lead. */
  afterTrickMs: 1800,
};
/** R-TABLE-11: the score summary between contracts: Continue, or 10 seconds. */
export const TRIX_BREAK_SECONDS = 10;

export const trixGame: GameModule<GameState, PlayerView, GameEvent> = {
  meta: {
    id: "trix",
    name: "Trix",
    version: TRIX_VERSION,
    sdk: "1.0.0",
    seats: { min: 4, max: 4 },
    botLevels: BOT_LEVELS,
    standInLevel: "medium", // R-TABLE-7
  },
  create: ({ seed }) => createGame({ seed }),
  started: (state) => [{ type: "dealt", contractNo: state.contractNo, picker: state.picker }],
  apply: (state, actor, action) => {
    if (actor !== "system" && !SEATS.includes(actor as Seat)) return { ok: false, error: { code: "BAD_ACTION", message: "Unknown seat" } };
    const r = applyAction(state, actor as Seat | "system", action);
    return r.ok ? r : { ok: false, error: r.error };
  },
  view: (state, seat) => viewFor(state, seat as Seat),
  privateTo,
  actors: (state) => (state.phase === "picking" || state.phase === "tricks" || state.phase === "trix") && state.turn !== null ? [state.turn] : [],
  status: (state) => {
    if (state.phase === "gameOver" && state.standings) {
      const st = state.standings;
      return { kind: "over", result: { order: st.order, winners: st.winners, losers: st.losers } };
    }
    if (state.phase === "contractEnd") return { kind: "break", next: { type: "nextContract" }, seconds: TRIX_BREAK_SECONDS };
    return { kind: "playing" };
  },
  isRoundStart: (e) => e.type === "dealt",
  pace: (state, events) =>
    state.phase === "picking" ? TRIX_PACE.botPickMs : events.some((e) => e.type === "trickWon") ? TRIX_PACE.afterTrickMs : TRIX_PACE.botMoveMs,
  bot: (level, view, events, rng, thinking) => botAction(level as BotLevel, view, events, rng, thinking),
  fallback: (state, seat) => placeholderBotAction(state, seat as Seat) ?? legalActions(state, seat as Seat).find((a) => a.type !== "peekLastTrick") ?? null,
  logLine: (e) => {
    if (e.type === "contractScored") {
      const r = e.result;
      return { event: "contract.scored", fields: { contractNo: r.contractNo, contract: r.contract, picker: r.picker, raw: r.raw, scores: r.scores, totals: r.totals, resets: r.resetToZero } };
    }
    if (e.type === "gameOver") return { event: "game.over", fields: { reason: e.standings.reason, totals: e.standings.totals, losers: e.standings.losers } };
    return null;
  },
};
