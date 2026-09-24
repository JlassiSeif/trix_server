// One table of 4 (RULES.md §7). Owns the seats, the game state and the timers; every game
// move goes through the engine. Nothing here trusts the browser.

import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import {
  SEATS,
  applyAction,
  botAction,
  createGame,
  placeholderBotAction,
  privateTo,
  seededRng,
  viewFor,
  type Action,
  type BotLevel,
  type GameEvent,
  type GameState,
  type Seat,
} from "@games/trix";
import { CONTINUE_SECONDS, NAME_MAX, type RoomStatus, type RoomView, type ServerMessage } from "@platform/protocol";
import { log } from "./log";

/** One player's connection. The WebSocket in production, a fake in tests. */
export interface Conn {
  send(msg: ServerMessage): void;
  close(): void;
  /** The player's address (behind the proxy: the real client address). For per-address limits. */
  ip?: string;
}

interface SeatState {
  kind: "human" | "bot";
  name: string;
  /** Humans only: proves who owns the seat when they come back (R-TABLE-5). */
  token: string | null;
  conn: Conn | null;
  /** The placeholder bot plays this human's seat while they are away (R-TABLE-7). */
  botPlaying: boolean;
  /** A bot holding a free seat: a new player coming through the invite link takes it over. */
  vacant: boolean;
  /** Bots only: easy, medium or hard (docs/bots.md). */
  level?: BotLevel;
}

export interface RoomSnapshot {
  id: string;
  invite: string;
  owner: Seat;
  seats: (Omit<SeatState, "conn"> | null)[];
  game: GameState | null;
  lastActive: number;
  /** Public events of the current contract: what the bots remember (docs/bots.md §1). */
  contractEvents?: GameEvent[];
}

export const TIMING = {
  botMoveMs: 900,
  botPickMs: 1400,
  /** After a trick is taken, so everyone sees what came out before the next lead. */
  afterTrickMs: 1800,
  continueMs: CONTINUE_SECONDS * 1000,
  /** R-TABLE-12: an owner away this long hands ownership to a connected player. */
  ownerHandoverMs: 30_000,
};

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const randomId = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const newToken = () => randomBytes(16).toString("hex");
/** Stand-in bots, and bots saved before levels existed, play at medium (docs/bots.md §8). */
const STAND_IN_LEVEL: BotLevel = "medium";
const LEVEL_NAME: Record<BotLevel, string> = { easy: "Easy bot", medium: "Medium bot", hard: "Hard bot" };
/** Hard's thinking budget per move (docs/bots.md §1). */
const THINK = { samples: 40, budgetMs: 30 };

/** Constant-time comparison, so response timing reveals nothing about a seat token. */
function sameToken(a: string | null, b: unknown): boolean {
  if (!a || typeof b !== "string" || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

const isLevel = (v: unknown): v is BotLevel => v === "easy" || v === "medium" || v === "hard";

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  return name.length > 0 ? name : null;
}

export class RoomError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class Room {
  readonly id: string;
  invite = randomId(8);
  owner: Seat = 0;
  seats: (SeatState | null)[] = [null, null, null, null];
  game: GameState | null = null;
  continueAt: number | null = null;
  continued = new Set<Seat>();
  ready = new Set<Seat>();
  lastActive = Date.now();
  /** Address that created the room (not saved), for the per-address room limit. */
  creatorIp: string | undefined;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private ownerTimer: ReturnType<typeof setTimeout> | null = null;
  /** When each human seat lost its connection (not saved: after a restart everyone counts from then). */
  private awaySince = new Map<Seat, number>();
  private continueTimer: ReturnType<typeof setTimeout> | null = null;
  /** Public events since the current contract was dealt: the bots' memory. */
  private contractEvents: GameEvent[] = [];
  /** The bots' own randomness, separate from the deal. */
  private botRng = seededRng(randomInt(2 ** 31));
  private closed = false;
  private frozen = false;
  private lastStatus: RoomStatus = "lobby";

  constructor(
    id: string,
    private readonly hooks: { onClose?: (room: Room) => void; onChange?: () => void; seed?: () => number } = {},
    restored = false,
  ) {
    this.id = id;
    if (!restored) log("info", "room.created", { room: id });
  }

  // -------------------------------------------------------------------------
  // Saving and restoring (so a server restart doesn't end the game)

  /** Everything needed to bring the room back after a restart. Connections are not saved:
   *  every player comes back through their seat token (R-TABLE-5). */
  toJSON(): RoomSnapshot {
    return {
      id: this.id,
      invite: this.invite,
      owner: this.owner,
      seats: this.seats.map((st) => st && { kind: st.kind, name: st.name, token: st.token, botPlaying: st.botPlaying, vacant: st.vacant, ...(st.level ? { level: st.level } : {}) }),
      game: this.game,
      lastActive: this.lastActive,
      contractEvents: this.contractEvents,
    };
  }

  static fromJSON(snap: RoomSnapshot, hooks: ConstructorParameters<typeof Room>[1]): Room {
    const room = new Room(snap.id, hooks, true);
    room.invite = snap.invite;
    room.owner = snap.owner;
    room.seats = snap.seats.map((st) => st && { ...st, conn: null, ...(st.kind === "bot" && !st.level ? { level: STAND_IN_LEVEL } : {}) });
    room.game = snap.game;
    room.contractEvents = snap.contractEvents ?? [];
    room.lastActive = snap.lastActive;
    room.lastStatus = room.status;
    const now = Date.now();
    for (const s of SEATS) if (room.seats[s]?.kind === "human") room.awaySince.set(s, now);
    return room;
  }

  /** After a restore: let bot-only work (a seat played by the bot) carry on. */
  wake(): void {
    this.changed([]);
  }

  /** Server shutting down: no more timers. */
  freeze(): void {
    this.frozen = true;
    this.clearTimers();
    if (this.ownerTimer) clearTimeout(this.ownerTimer);
  }

  // -------------------------------------------------------------------------
  // Derived state

  get status(): RoomStatus {
    if (!this.game) return "lobby";
    if (this.game.phase === "gameOver") return "finished";
    return this.waitingFor().length > 0 ? "paused" : "playing";
  }

  /** Seats nobody is playing: empty, or a human who is away without a bot (R-TABLE-4, R-TABLE-6). */
  waitingFor(): Seat[] {
    if (!this.game || this.game.phase === "gameOver") return [];
    return SEATS.filter((s) => {
      const seat = this.seats[s];
      return !seat || (seat.kind === "human" && !seat.conn && !seat.botPlaying);
    });
  }

  seatOf(conn: Conn): Seat | null {
    const s = SEATS.find((i) => this.seats[i]?.conn === conn);
    return s ?? null;
  }

  private isBotControlled(s: Seat): boolean {
    const seat = this.seats[s];
    return !!seat && (seat.kind === "bot" || seat.botPlaying);
  }

  private humans(): Seat[] {
    return SEATS.filter((s) => this.seats[s]?.kind === "human");
  }

  // -------------------------------------------------------------------------
  // Joining and leaving

  /** A new player takes a free seat (R-TABLE-1). The first one becomes the owner (R-TABLE-2). */
  seatNewPlayer(conn: Conn, rawName: unknown, invite: string | null): Seat {
    const name = cleanName(rawName);
    if (!name) throw new RoomError("BAD_NAME", "Pick a name (1 to 20 characters)");
    const creating = this.humans().length === 0 && this.seats.every((s) => s === null);
    if (!creating && invite !== this.invite) throw new RoomError("BAD_INVITE", "This invite link is no longer valid. Ask the room owner for the new one.");
    // No two people with the same name at a table, so nobody can pass for someone else.
    const taken = SEATS.some((s) => this.seats[s] && this.seats[s]!.name.toLowerCase() === name.toLowerCase());
    if (taken) throw new RoomError("NAME_TAKEN", "Someone at this table already has that name. Pick another one.");
    // Free seat first; during a game a stand-in bot's seat can be taken over too.
    let seat = SEATS.find((s) => this.seats[s] === null);
    if (seat === undefined && this.game) seat = SEATS.find((s) => this.seats[s]?.vacant);
    if (seat === undefined) throw new RoomError("ROOM_FULL", "The table is full");
    const token = newToken();
    const replacing = this.seats[seat]?.kind === "bot";
    this.seats[seat] = { kind: "human", name, token, conn, botPlaying: false, vacant: false };
    this.awaySince.delete(seat);
    if (creating) this.owner = seat;
    log("info", "seat.joined", { room: this.id, seat, name, owner: creating, replacingBot: replacing, inGame: !!this.game });
    conn.send({ type: "joined", roomId: this.id, seat, token });
    this.changed([]);
    this.startIfFull();
    return seat;
  }

  /** A returning player reclaims their seat with their token (R-TABLE-5). */
  reconnect(conn: Conn, token: unknown): Seat {
    const seat = SEATS.find((s) => sameToken(this.seats[s]?.token ?? null, token));
    if (seat === undefined) throw new RoomError("BAD_TOKEN", "That seat is no longer yours");
    const st = this.seats[seat]!;
    log("info", "seat.reconnected", { room: this.id, seat, replacedOpenConnection: !!st.conn && st.conn !== conn, wasBotPlaying: st.botPlaying });
    if (st.conn && st.conn !== conn) {
      // Same player, new tab: the old tab is dropped.
      st.conn.send({ type: "error", code: "REPLACED", message: "This seat was opened in another tab" });
      st.conn.close();
    }
    st.conn = conn;
    st.botPlaying = false;
    this.awaySince.delete(seat);
    conn.send({ type: "joined", roomId: this.id, seat, token: st.token! });
    this.changed([]);
    return seat;
  }

  disconnect(conn: Conn): void {
    const seat = this.seatOf(conn);
    if (seat === null) return;
    this.seats[seat]!.conn = null;
    this.awaySince.set(seat, Date.now());
    log("info", "seat.disconnected", { room: this.id, seat, phase: this.game?.phase ?? "lobby", owner: seat === this.owner });
    this.changed([]); // pauses the game if it needs this player (R-TABLE-4)
    if (this.humans().every((s) => !this.seats[s]!.conn)) this.lastActive = Date.now();
  }

  /** Leaving and being kicked are the same (R-TABLE-6): the seat empties and the invite link changes. */
  private vacate(seat: Seat, reason: "kicked" | "left"): void {
    const st = this.seats[seat];
    if (!st) return;
    this.seats[seat] = null;
    log("info", "seat.vacated", { room: this.id, seat, reason, kind: st.kind, phase: this.game?.phase ?? "lobby" });
    this.continued.delete(seat);
    this.ready.delete(seat);
    if (st.conn) {
      st.conn.send({ type: "removed", reason });
      st.conn.close();
    }
    if (st.kind === "human") this.invite = randomId(8);
    this.awaySince.delete(seat);
    if (seat === this.owner) {
      // R-TABLE-12: a connected player first; if nobody is connected, any remaining player.
      const next = this.nextOwner() ?? this.humans()[0];
      if (next === undefined) return this.close();
      this.setOwner(next, "left");
    }
    this.changed([]);
  }

  // -------------------------------------------------------------------------
  // Ownership (R-TABLE-12)

  /** The next connected player counter-clockwise from the owner, if any. */
  private nextOwner(): Seat | undefined {
    for (let i = 1; i <= 3; i++) {
      const s = ((this.owner + i) % 4) as Seat;
      const st = this.seats[s];
      if (st?.kind === "human" && st.conn) return s;
    }
    return undefined;
  }

  private setOwner(seat: Seat, reason: "left" | "away" | "handedOver"): void {
    log("info", "room.ownerChanged", { room: this.id, from: this.owner, to: seat, reason });
    this.owner = seat;
  }

  /** An owner away for too long hands over to a connected player; checked on every change. */
  private checkOwner(): void {
    if (this.ownerTimer) clearTimeout(this.ownerTimer);
    this.ownerTimer = null;
    const st = this.seats[this.owner];
    if (!st || st.kind !== "human" || st.conn) return;
    const next = this.nextOwner();
    if (next === undefined) return; // nobody to hand over to: check again when someone connects
    const away = Date.now() - (this.awaySince.get(this.owner) ?? Date.now());
    if (away >= TIMING.ownerHandoverMs) {
      this.setOwner(next, "away");
      return;
    }
    if (!this.frozen && !this.closed) this.ownerTimer = setTimeout(() => this.changed([]), TIMING.ownerHandoverMs - away);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.clearTimers();
    if (this.ownerTimer) clearTimeout(this.ownerTimer);
    log("info", "room.closed", { room: this.id });
    this.hooks.onChange?.();
    for (const s of SEATS) {
      const conn = this.seats[s]?.conn;
      if (conn) {
        conn.send({ type: "removed", reason: "roomClosed" });
        conn.close();
      }
    }
    this.hooks.onClose?.(this);
  }

  // -------------------------------------------------------------------------
  // Messages from a seated player

  handle(conn: Conn, msg: { type: string; [k: string]: unknown }): void {
    const seat = this.seatOf(conn);
    if (seat === null) throw new RoomError("NOT_SEATED", "You are not seated at this table");
    this.lastActive = Date.now();
    const ownerOnly = () => {
      if (seat !== this.owner) throw new RoomError("NOT_OWNER", "Only the room owner can do that");
    };
    const targetSeat = (): Seat => {
      const s = msg.seat;
      if (s !== 0 && s !== 1 && s !== 2 && s !== 3) throw new RoomError("BAD_MESSAGE", "Unknown seat");
      return s;
    };

    switch (msg.type) {
      case "action": {
        if (!this.game || this.status !== "playing") throw new RoomError("NOT_PLAYING", "The game is not running right now");
        const r = applyAction(this.game, seat, msg.action);
        if (!r.ok) {
          log("info", "action.rejected", { room: this.id, seat, code: r.error.code, action: msg.action, phase: this.game.phase, turn: this.game.turn });
          throw new RoomError(r.error.code, r.error.message);
        }
        log("debug", "action.accepted", { room: this.id, seat, action: msg.action });
        this.game = r.state;
        this.changed(r.events);
        return;
      }
      case "continue":
        if (this.game?.phase !== "contractEnd") return;
        this.continued.add(seat);
        this.changed([]);
        return;
      case "ready":
        if (this.status !== "finished") return;
        this.ready.add(seat);
        this.changed([]);
        this.restartIfAllReady();
        return;
      case "leave":
        this.vacate(seat, "left");
        return;
      case "addBot": {
        ownerOnly();
        const s = targetSeat();
        if (this.game) throw new RoomError("NOT_IN_LOBBY", "Bots can be added before the game starts");
        if (this.seats[s]) throw new RoomError("SEAT_TAKEN", "That seat is taken");
        const level = msg.level === undefined ? STAND_IN_LEVEL : msg.level;
        if (!isLevel(level)) throw new RoomError("BAD_MESSAGE", "Unknown bot level");
        this.seatBot(s, level);
        this.changed([]);
        this.startIfFull();
        return;
      }
      case "makeOwner": {
        ownerOnly();
        const s = targetSeat();
        const st = this.seats[s];
        if (s === seat || st?.kind !== "human" || !st.conn) throw new RoomError("NOT_ELIGIBLE", "Ownership can only go to another player who is at the table right now");
        this.setOwner(s, "handedOver");
        this.changed([]);
        return;
      }
      case "kick": {
        ownerOnly();
        const s = targetSeat();
        if (s === seat) throw new RoomError("BAD_MESSAGE", "Use Leave to leave the table");
        this.vacate(s, "kicked");
        return;
      }
      case "resumeWithBots":
        ownerOnly();
        if (this.status !== "paused") return;
        for (const s of this.waitingFor()) {
          const st = this.seats[s];
          if (st) st.botPlaying = true;
          else this.seatBot(s, STAND_IN_LEVEL);
          log("info", "seat.botStandIn", { room: this.id, seat: s, forPlayer: st?.name ?? null });
        }
        this.changed([]);
        return;
      case "endGame":
        ownerOnly();
        this.game = null;
        this.resetBetweenGames();
        this.changed([]);
        return;
      case "startGame":
        ownerOnly();
        if (this.game) return;
        if (this.seats.some((s) => !s)) throw new RoomError("NOT_FULL", "All 4 seats must be filled");
        this.startGame();
        return;
      default:
        throw new RoomError("BAD_MESSAGE", "Unknown message");
    }
  }

  /** "Play against bots" (R-TABLE-13): every empty seat gets a bot of this level, and the game starts. */
  fillWithBots(level: BotLevel): void {
    for (const s of SEATS) if (!this.seats[s]) this.seatBot(s, level);
    this.changed([]);
    this.startIfFull();
  }

  /** A bot in an empty seat, named after its level ("Hard bot", "Hard bot 2", …). */
  private seatBot(seat: Seat, level: BotLevel): void {
    const taken = (n: string) => SEATS.some((i) => this.seats[i]?.name.toLowerCase() === n.toLowerCase());
    let name = LEVEL_NAME[level];
    for (let n = 2; taken(name); n++) name = `${LEVEL_NAME[level]} ${n}`;
    this.seats[seat] = { kind: "bot", name, token: null, conn: null, botPlaying: false, vacant: true, level };
    log("info", "seat.botAdded", { room: this.id, seat, level });
  }

  // -------------------------------------------------------------------------
  // Game flow

  /** R-TABLE-3: the game starts on its own when the 4th seat is filled. */
  private startIfFull(): void {
    if (!this.game && this.seats.every((s) => s !== null)) this.startGame();
  }

  private startGame(): void {
    const seed = this.hooks.seed ? this.hooks.seed() : randomInt(2 ** 31);
    this.game = createGame({ seed });
    log("info", "game.started", { room: this.id, seed, firstPicker: this.game.picker, seats: this.seats.map((s) => s && { kind: s.kind, name: s.name }) });
    this.resetBetweenGames();
    this.changed([{ type: "dealt", contractNo: 1, picker: this.game.picker }]);
  }

  private resetBetweenGames(): void {
    this.continueAt = null;
    this.continued.clear();
    this.ready.clear();
    this.clearTimers();
  }

  /** R-TABLE-8: a new game with the same seats once everyone is ready (bots always are). */
  private restartIfAllReady(): void {
    if (this.status !== "finished") return;
    if (SEATS.every((s) => this.seats[s] && (this.ready.has(s) || this.isBotControlled(s)))) this.startGame();
  }

  /** Between contracts: deal when every human is ready, or when the countdown ends. */
  private nextContract(): void {
    if (!this.game || this.game.phase !== "contractEnd" || this.status !== "playing") return;
    const r = applyAction(this.game, "system", { type: "nextContract" });
    if (!r.ok) return;
    this.game = r.state;
    this.continueAt = null;
    this.continued.clear();
    this.changed(r.events);
  }

  /** Called after every change: send everyone their view, then schedule whatever happens next. */
  private changed(events: GameEvent[]): void {
    if (this.closed) return;
    // Start the between-contracts countdown before telling anyone, so they all see it.
    if (this.game?.phase === "contractEnd" && this.continueAt === null) this.continueAt = Date.now() + TIMING.continueMs;
    this.checkOwner(); // before telling anyone, so everyone sees the current owner
    for (const e of events) {
      if (e.type === "dealt") this.contractEvents = [];
      else if (privateTo(e) === null) this.contractEvents.push(e);
      if (e.type === "contractScored") {
        const r = e.result;
        log("info", "contract.scored", { room: this.id, contractNo: r.contractNo, contract: r.contract, picker: r.picker, raw: r.raw, scores: r.scores, totals: r.totals, resets: r.resetToZero });
      } else if (e.type === "gameOver") {
        log("info", "game.over", { room: this.id, reason: e.standings.reason, totals: e.standings.totals, losers: e.standings.losers });
      }
    }
    const status = this.status;
    if (status !== this.lastStatus) {
      log("info", "room.status", { room: this.id, from: this.lastStatus, to: status, waitingFor: this.waitingFor() });
      this.lastStatus = status;
    }
    this.broadcast(events);
    this.hooks.onChange?.();
    if (!this.frozen) this.schedule(events);
  }

  private schedule(events: GameEvent[]): void {
    this.clearTimers();
    const game = this.game;
    if (!game) return;
    if (this.status === "finished") return this.restartIfAllReady();
    if (this.status !== "playing") return;

    if (game.phase === "contractEnd") {
      const humansReady = SEATS.every((s) => this.isBotControlled(s) || this.continued.has(s));
      const at = this.continueAt ?? Date.now();
      if (humansReady || Date.now() >= at) return this.nextContract();
      this.continueTimer = setTimeout(() => this.nextContract(), at - Date.now());
      return;
    }

    const actor = game.turn;
    if (actor === null || !this.isBotControlled(actor)) return;
    const delay =
      game.phase === "picking" ? TIMING.botPickMs : events.some((e) => e.type === "trickWon") ? TIMING.afterTrickMs : TIMING.botMoveMs;
    this.botTimer = setTimeout(() => this.botMove(actor), delay);
  }

  private botMove(seat: Seat): void {
    if (!this.game || this.status !== "playing" || this.game.turn !== seat || !this.isBotControlled(seat)) return;
    const st = this.seats[seat]!;
    const level = st.kind === "bot" ? (st.level ?? STAND_IN_LEVEL) : STAND_IN_LEVEL;
    // The bot sees what a player in its seat sees: its view and the public events (docs/bots.md §1).
    let action: Action | null = null;
    try {
      action = botAction(level, viewFor(this.game, seat), this.contractEvents, this.botRng, THINK);
    } catch (e) {
      log("error", "bot.crashed", { room: this.id, seat, level, error: e });
    }
    let r = action ? applyAction(this.game, seat, action) : null;
    if (!r?.ok) {
      // Never let a bot problem stall the table: log it and make a simple legal move instead.
      if (r && !r.ok) log("error", "bot.illegalMove", { room: this.id, seat, level, action, code: r.error.code });
      action = placeholderBotAction(this.game, seat);
      if (!action) return;
      r = applyAction(this.game, seat, action);
      if (!r.ok) return;
    }
    log("debug", "bot.move", { room: this.id, seat, level, action });
    this.game = r.state;
    this.changed(r.events);
  }

  private clearTimers(): void {
    if (this.botTimer) clearTimeout(this.botTimer);
    if (this.continueTimer) clearTimeout(this.continueTimer);
    this.botTimer = this.continueTimer = null;
  }

  // -------------------------------------------------------------------------
  // What each player receives

  viewFor(seat: Seat): RoomView {
    return {
      id: this.id,
      status: this.status,
      you: seat,
      owner: this.owner,
      seats: SEATS.map((s) => {
        const st = this.seats[s];
        if (!st) return { kind: "empty", name: null, connected: false, botPlaying: false, level: null };
        return { kind: st.kind, name: st.name, connected: st.kind === "bot" || !!st.conn, botPlaying: st.botPlaying, level: st.kind === "bot" ? (st.level ?? STAND_IN_LEVEL) : null };
      }),
      invitePath: seat === this.owner ? `/r/${this.id}?i=${this.invite}` : null,
      waitingFor: this.waitingFor(),
      continueAt: this.continueAt,
      continued: [...this.continued],
      ready: [...this.ready],
    };
  }

  private broadcast(events: GameEvent[]): void {
    for (const s of SEATS) {
      const conn = this.seats[s]?.conn;
      if (!conn) continue;
      conn.send({
        type: "update",
        room: this.viewFor(s),
        game: this.game ? viewFor(this.game, s) : null,
        events: events.filter((e) => {
          const only = privateTo(e);
          return only === null || only === s;
        }),
      });
    }
  }
}
