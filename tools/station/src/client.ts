// A simulated player: a real WebSocket client speaking the same protocol as the browser.
// Every message in and out is logged; every update is checked by the referee.

import { createWriteStream, type WriteStream } from "node:fs";
import WebSocket from "ws";
import { nextRandom, type Action, type GameEvent, type PlayerView, type Seat } from "@trix/engine";
import type { ClientMessage, RoomView, ServerMessage } from "@trix/protocol";
import { checkView, type Finding } from "./referee";

export interface Policy {
  /** Thinking time before a move, in ms. */
  thinkMs: [number, number];
  declareChance: number;
  /** Chance to look at the last trick when it's your turn and you still can. */
  peekChance: number;
  /** Click Continue between contracts (false = let the countdown run out). */
  clickContinue: boolean;
  /** Click Play again after the game. */
  clickReady: boolean;
  /** Send every move twice in a row (a double-click). The second copy is marked deliberate. */
  doubleSend?: boolean;
}
export const NORMAL: Policy = { thinkMs: [2, 25], declareChance: 0.5, peekChance: 0.15, clickContinue: true, clickReady: false };

export interface ErrorRecord {
  code: string;
  message: string;
  /** Did the state change between sending and the error? Then it's a harmless race, not a bug. */
  stale: boolean;
  /** Sent on purpose to test the server's defences. */
  deliberate: boolean;
  /** Not a reply to anything we sent (e.g. "opened in another tab"). */
  unsolicited: boolean;
  sent: unknown;
}

export class StationClient {
  ws: WebSocket | null = null;
  room: RoomView | null = null;
  game: PlayerView | null = null;
  roomId: string | null = null;
  token: string | null = null;
  seat: Seat | null = null;
  removed: string | null = null;
  updates = 0;
  /** Updates that carried a game. The first one reaches all players in the same broadcast,
   *  so the k-th game update is the same moment for everyone at the table. */
  gameUpdates = 0;
  /** Game updates received, for cross-player checks (consumed by the table monitor). */
  inbox: { index: number; room: RoomView; game: PlayerView | null; events: GameEvent[]; raw: string }[] = [];
  errors: ErrorRecord[] = [];
  findings: (Finding & { client: string; update: number })[] = [];
  events: GameEvent[] = [];
  policy: Policy | null = null;
  lastMessageAt = Date.now();
  private sent = new Map<number, { msg: unknown; atUpdate: number; deliberate: boolean }>();
  private nextId = 1;
  /** Junk sent without an id: its errors can't be matched, so they are counted. */
  private pendingJunk = 0;
  private acted = new Set<string>();
  private rng: number;
  private logFile: WriteStream;
  private waiters: { pred: () => boolean; resolve: () => void }[] = [];
  onUpdate: ((c: StationClient) => void) | null = null;
  /** Scenario hook, called after each update (after the monitor). */
  afterUpdate: ((c: StationClient) => void) | null = null;
  /** When each event arrived, for timing checks. */
  timeline: { t: number; type: string }[] = [];
  doublesSent = 0;
  /** The first view received after the latest join: what the server restored, before any new move. */
  firstViewAfterJoin: PlayerView | null = null;
  private awaitingFirstView = false;
  onClose: ((code: number) => void) | null = null;

  constructor(
    readonly name: string,
    private readonly url: string,
    logPath: string,
    seed: number,
    /** Pretend address, sent as X-Forwarded-For (the server trusts it from localhost in tests, as from Caddy). */
    readonly ip?: string,
    /** Origin header, like a browser page would send. */
    readonly origin?: string,
  ) {
    this.rng = seed >>> 0;
    this.logFile = createWriteStream(logPath, { flags: "a" });
  }

  random(): number {
    const [r, n] = nextRandom(this.rng);
    this.rng = n;
    return r;
  }
  private logEnded = false;
  private log(dir: "in" | "out" | "note", data: unknown) {
    if (this.logEnded) return;
    this.logFile.write(JSON.stringify({ t: Date.now(), dir, data }) + "\n");
  }
  note(text: string, extra: Record<string, unknown> = {}) {
    this.log("note", { text, ...extra });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {};
      if (this.ip) headers["x-forwarded-for"] = this.ip;
      const ws = new WebSocket(this.url, { headers, ...(this.origin ? { origin: this.origin } : {}) });
      this.ws = ws;
      ws.on("open", () => resolve());
      ws.on("error", (e) => reject(e));
      ws.on("unexpected-response", (_req, res) => reject(new Error(`handshake refused: HTTP ${res.statusCode}`)));
      ws.on("message", (data) => this.receive(data.toString()));
      ws.on("close", (code) => {
        this.log("note", { text: "socket closed", code });
        if (this.ws === ws) this.ws = null;
        this.onClose?.(code);
        this.wake();
      });
    });
  }

  /** Drop the connection the way a closed tab or lost network would. */
  drop(): void {
    this.ws?.terminate();
    this.ws = null;
  }

  async close(): Promise<void> {
    this.ws?.close();
    this.logEnded = true;
    await new Promise<void>((r) => this.logFile.end(() => r()));
  }

  /** Send a message with an id, so an error it causes can be traced back to it. */
  send(msg: ClientMessage | Record<string, unknown>, deliberate = false): void {
    const id = this.nextId++;
    const withId = { ...msg, id };
    this.sent.set(id, { msg, atUpdate: this.updates, deliberate });
    if (this.sent.size > 500) this.sent.delete(this.sent.keys().next().value!);
    this.log("out", withId);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(withId));
  }
  /** Send raw text (junk, oversized, malformed): always deliberate. */
  sendRaw(raw: string): void {
    this.log("out", { raw: raw.length > 300 ? `${raw.slice(0, 300)}…(${raw.length} chars)` : raw });
    this.pendingJunk++;
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(raw);
  }

  private receive(raw: string) {
    this.lastMessageAt = Date.now();
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.findings.push({ check: "server-sent-bad-json", detail: raw.slice(0, 200), client: this.name, update: this.updates });
      return;
    }
    this.log("in", msg);
    switch (msg.type) {
      case "joined":
        this.roomId = msg.roomId;
        this.token = msg.token;
        this.seat = msg.seat;
        this.acted.clear(); // back at the table: look at the state afresh, like a person would
        this.firstViewAfterJoin = null;
        this.awaitingFirstView = true;
        break;
      case "update": {
        const prev = this.game;
        this.updates++;
        this.room = msg.room;
        this.game = msg.game;
        if (this.awaitingFirstView && msg.game) {
          this.firstViewAfterJoin = msg.game;
          this.awaitingFirstView = false;
        }
        this.events.push(...msg.events);
        if (msg.game) this.inbox.push({ index: ++this.gameUpdates, room: msg.room, game: msg.game, events: msg.events, raw });
        if (msg.game) {
          // A new game resets what "previous" means for the referee.
          const fresh = prev && msg.game.contractNo === 1 && msg.game.history.length === 0 && prev.history.length > 0;
          for (const f of checkView(fresh ? null : prev, msg.game, msg.events)) this.findings.push({ ...f, client: this.name, update: this.updates });
        }
        for (const e of msg.events) this.timeline.push({ t: Date.now(), type: e.type });
        // A new deal (and so a new game) repeats earlier states: forget what we acted on.
        if (msg.events.some((e) => e.type === "dealt")) this.acted.clear();
        this.onUpdate?.(this);
        this.afterUpdate?.(this);
        this.maybeAct();
        break;
      }
      case "error": {
        const sent = msg.re !== undefined ? this.sent.get(msg.re) : undefined;
        const junk = !sent && msg.re === undefined && this.pendingJunk > 0;
        if (junk) this.pendingJunk--;
        this.errors.push({
          code: msg.code,
          message: msg.message,
          stale: sent ? this.updates > sent.atUpdate : false,
          deliberate: sent?.deliberate ?? junk,
          unsolicited: !sent && !junk,
          sent: sent?.msg ?? (junk ? "(raw junk)" : undefined),
        });
        // A real move was refused (e.g. it arrived while the table was paused): try again,
        // as a person would click again.
        if (sent && !sent.deliberate) {
          this.acted.clear();
          setTimeout(() => this.maybeAct(), 30);
        }
        break;
      }
      case "removed":
        this.removed = msg.reason;
        break;
    }
    this.wake();
  }

  // -------------------------------------------------------------------------
  // Waiting

  private wake() {
    this.waiters = this.waiters.filter((w) => {
      if (!w.pred()) return true;
      w.resolve();
      return false;
    });
  }

  /** Resolves when `pred` holds (checked on every message), rejects after `ms`. */
  waitFor(pred: () => boolean, ms: number, what: string): Promise<void> {
    if (pred()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w.resolve !== done);
        reject(new Error(`${this.name}: timed out after ${ms} ms waiting for ${what}`));
      }, ms);
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      this.waiters.push({ pred, resolve: done });
    });
  }

  // -------------------------------------------------------------------------
  // Playing

  /** Moves this player may make right now (not counting looks at the last trick). */
  moves(): Action[] {
    return (this.game?.legal ?? []).filter((a) => a.type !== "peekLastTrick");
  }

  /** Act once per distinct state, after a short think, like a person would. */
  maybeAct() {
    const p = this.policy;
    const g = this.game;
    const r = this.room;
    if (!p || !g || !r || this.removed) return;
    const key = `${g.contractNo}|${g.phase}|${g.turn}|${g.hand.length}|${g.trick.length}|${r.status}|${JSON.stringify(g.stacks)}|${g.kingDeclaredBy}`;
    if (this.acted.has(key)) return;

    let action: ClientMessage | null = null;
    if (r.status === "playing" && g.phase === "contractEnd" && p.clickContinue && !r.continued.includes(r.you)) action = { type: "continue" };
    else if (r.status === "finished" && p.clickReady && !r.ready.includes(r.you)) action = { type: "ready" };
    else if (r.status === "playing" && this.moves().length > 0) {
      const legal = g.legal;
      const declare = legal.find((a) => a.type === "declareKing");
      const peek = legal.find((a) => a.type === "peekLastTrick");
      if (declare && this.random() < p.declareChance) action = { type: "action", action: declare };
      else if (peek && this.random() < p.peekChance) action = { type: "action", action: peek };
      else {
        const moves = this.moves().filter((a) => a.type !== "declareKing");
        if (moves.length) action = { type: "action", action: moves[Math.floor(this.random() * moves.length)]! };
      }
    }
    if (!action) return;
    // A look or a declaration doesn't change the key, so don't mark it done: the play still follows.
    const repeatable = action.type === "action" && (action.action.type === "peekLastTrick" || action.action.type === "declareKing");
    if (!repeatable) this.acted.add(key);
    if (this.acted.size > 5000) this.acted.clear();
    const [lo, hi] = p.thinkMs;
    const delay = lo + this.random() * (hi - lo);
    const chosen = action;
    const twice = p.doubleSend && chosen.type === "action" && !repeatable;
    setTimeout(() => {
      // Like a person clicking what is on screen *now*: skip it if the state moved on meanwhile.
      if (!this.stillValid(chosen)) {
        this.acted.delete(key);
        this.maybeAct();
        return;
      }
      this.send(chosen);
      if (twice) {
        this.doublesSent++;
        this.send(chosen, true);
      }
    }, delay);
  }

  private stillValid(msg: ClientMessage): boolean {
    const g = this.game;
    const r = this.room;
    if (!g || !r || !this.ws) return false;
    if (msg.type === "continue") return g.phase === "contractEnd" && r.status === "playing";
    if (msg.type === "ready") return r.status === "finished";
    if (msg.type === "action") return r.status === "playing" && g.legal.some((a) => JSON.stringify(a) === JSON.stringify(msg.action));
    return true;
  }

  unexpectedErrors(): ErrorRecord[] {
    return this.errors.filter((e) => !e.deliberate && !e.stale);
  }
}
