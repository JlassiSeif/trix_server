// One table (docs/architecture.md §4). Owns the seats, the game state and the timers; every
// move goes through the game's rules, via the game contract (@platform/sdk). The room knows
// nothing about any particular game. Nothing here trusts the browser.

import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { seededRng, type GameEventBase, type GameModule, type GameStatus, type Seat } from "@platform/sdk";
import { NAME_MAX, type RoomStatus, type RoomView, type ServerMessage } from "@platform/protocol";
import { log } from "./log";

/** One player's connection. The WebSocket in production, a fake in tests. */
export interface Conn {
  send(msg: ServerMessage): void;
  close(): void;
  /** The player's address (behind the proxy: the real client address). For per-address limits. */
  ip?: string;
  /** A signed-in player's account id (after "identify"); guests have none. */
  uid?: string;
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
  /** Bots only: one of the game's bot levels. */
  level?: string;
  /** Humans only: the account of a signed-in player (for stats and ladders later). Never sent to anyone. */
  uid?: string;
}

export interface RoomSnapshot {
  id: string;
  /** The game this room plays and the version that saved it. Missing in saves from before the hub: Trix. */
  gameId?: string;
  gameVersion?: string;
  invite: string;
  owner: Seat;
  seats: (Omit<SeatState, "conn"> | null)[];
  /** The game's own state (older saves call it `game`). */
  state?: unknown;
  game?: unknown;
  lastActive: number;
  /** Public events of the current round: what the bots remember. Older saves: `contractEvents`. */
  roundEvents?: GameEventBase[];
  contractEvents?: GameEventBase[];
}

export const TIMING = {
  /** R-TABLE-12: an owner away this long hands ownership to a connected player. */
  ownerHandoverMs: 30_000,
  /** Tests only (TRIX_SPEED): bots, breaks and hand-overs run this many times faster. */
  speed: 1,
};

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const randomId = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const newToken = () => randomBytes(16).toString("hex");
/** "hard" → "Hard bot": bots are named after their level. */
const levelName = (level: string) => `${level[0]!.toUpperCase()}${level.slice(1)} bot`;
/** The thinking budget for bots that imagine deals (docs/architecture.md: a shared, capped server). */
const THINK = { samples: 40, budgetMs: 30 };

/** Constant-time comparison, so response timing reveals nothing about a seat token. */
function sameToken(a: string | null, b: unknown): boolean {
  if (!a || typeof b !== "string" || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

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
  /** One entry per seat of the game (e.g. 4 for Trix). */
  seats: (SeatState | null)[];
  /** The game's state, opaque to the room. */
  game: unknown = null;
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
  /** Public events since the current round started: the bots' memory. */
  private roundEvents: GameEventBase[] = [];
  /** The bots' own randomness, separate from the deal. */
  private botRng = seededRng(randomInt(2 ** 31));
  private closed = false;
  private frozen = false;
  private lastStatus: RoomStatus = "lobby";

  constructor(
    id: string,
    readonly module: GameModule,
    private readonly hooks: { onClose?: (room: Room) => void; onChange?: () => void; seed?: () => number } = {},
    restored = false,
  ) {
    this.id = id;
    this.seats = Array.from({ length: module.meta.seats.max }, () => null);
    if (!restored) log("info", "room.created", { room: id, game: module.meta.id });
  }

  /** Every seat number of this table. */
  get seatList(): Seat[] {
    return this.seats.map((_, i) => i);
  }

  /** Where the game is (playing, a break between rounds, over), or null in the lobby. */
  gameStatus(): GameStatus | null {
    return this.game === null ? null : this.module.status(this.game);
  }

  // -------------------------------------------------------------------------
  // Saving and restoring (so a server restart doesn't end the game)

  /** Everything needed to bring the room back after a restart. Connections are not saved:
   *  every player comes back through their seat token (R-TABLE-5). */
  toJSON(): RoomSnapshot {
    return {
      id: this.id,
      gameId: this.module.meta.id,
      gameVersion: this.module.meta.version,
      invite: this.invite,
      owner: this.owner,
      seats: this.seats.map((st) => st && { kind: st.kind, name: st.name, token: st.token, botPlaying: st.botPlaying, vacant: st.vacant, ...(st.level ? { level: st.level } : {}), ...(st.uid ? { uid: st.uid } : {}) }),
      state: this.game,
      lastActive: this.lastActive,
      roundEvents: this.roundEvents,
    };
  }

  /** Brings a saved room back with its game's module. Saves from before the hub (no `gameId`) are Trix. */
  static fromJSON(snap: RoomSnapshot, module: GameModule, hooks: ConstructorParameters<typeof Room>[2]): Room {
    const room = new Room(snap.id, module, hooks, true);
    room.invite = snap.invite;
    room.owner = snap.owner;
    // Bots saved before levels existed play at the game's stand-in level.
    room.seats = snap.seats.map((st) => st && { ...st, conn: null, ...(st.kind === "bot" && !st.level ? { level: module.meta.standInLevel } : {}) });
    room.game = snap.state !== undefined ? snap.state : (snap.game ?? null);
    room.roundEvents = snap.roundEvents ?? snap.contractEvents ?? [];
    room.lastActive = snap.lastActive;
    room.lastStatus = room.status;
    const now = Date.now();
    for (const s of room.seatList) if (room.seats[s]?.kind === "human") room.awaySince.set(s, now);
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
    const st = this.gameStatus();
    if (!st) return "lobby";
    if (st.kind === "over") return "finished";
    return this.waitingFor().length > 0 ? "paused" : "playing";
  }

  /** Seats nobody is playing: empty, or a human who is away without a bot (R-TABLE-4, R-TABLE-6). */
  waitingFor(): Seat[] {
    const st = this.gameStatus();
    if (!st || st.kind === "over") return [];
    return this.seatList.filter((s) => {
      const seat = this.seats[s];
      return !seat || (seat.kind === "human" && !seat.conn && !seat.botPlaying);
    });
  }

  linkAccount(seat: Seat, uid: string): void {
    const st = this.seats[seat];
    if (st?.kind === "human" && st.uid !== uid) {
      st.uid = uid;
      this.hooks.onChange?.(); // saved with the room
    }
  }

  seatOf(conn: Conn): Seat | null {
    const s = this.seatList.find((i) => this.seats[i]?.conn === conn);
    return s ?? null;
  }

  private isBotControlled(s: Seat): boolean {
    const seat = this.seats[s];
    return !!seat && (seat.kind === "bot" || seat.botPlaying);
  }

  private humans(): Seat[] {
    return this.seatList.filter((s) => this.seats[s]?.kind === "human");
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
    const taken = this.seatList.some((s) => this.seats[s] && this.seats[s]!.name.toLowerCase() === name.toLowerCase());
    if (taken) throw new RoomError("NAME_TAKEN", "Someone at this table already has that name. Pick another one.");
    // Free seat first; during a game a stand-in bot's seat can be taken over too.
    let seat = this.seatList.find((s) => this.seats[s] === null);
    if (seat === undefined && this.game !== null) seat = this.seatList.find((s) => this.seats[s]?.vacant);
    if (seat === undefined) throw new RoomError("ROOM_FULL", "The table is full");
    const token = newToken();
    const replacing = this.seats[seat]?.kind === "bot";
    this.seats[seat] = { kind: "human", name, token, conn, botPlaying: false, vacant: false, ...(conn.uid ? { uid: conn.uid } : {}) };
    this.awaySince.delete(seat);
    if (creating) this.owner = seat;
    log("info", "seat.joined", { room: this.id, seat, name, owner: creating, replacingBot: replacing, inGame: this.game !== null });
    conn.send({ type: "joined", roomId: this.id, seat, token });
    this.changed([]);
    this.startIfFull();
    return seat;
  }

  /** A returning player reclaims their seat with their token (R-TABLE-5). */
  reconnect(conn: Conn, token: unknown): Seat {
    const seat = this.seatList.find((s) => sameToken(this.seats[s]?.token ?? null, token));
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
    if (conn.uid) st.uid = conn.uid;
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
    log("info", "seat.disconnected", { room: this.id, seat, stage: this.gameStatus()?.kind ?? "lobby", owner: seat === this.owner });
    this.changed([]); // pauses the game if it needs this player (R-TABLE-4)
    if (this.humans().every((s) => !this.seats[s]!.conn)) this.lastActive = Date.now();
  }

  /** Leaving and being kicked are the same (R-TABLE-6): the seat empties and the invite link changes. */
  private vacate(seat: Seat, reason: "kicked" | "left"): void {
    const st = this.seats[seat];
    if (!st) return;
    this.seats[seat] = null;
    log("info", "seat.vacated", { room: this.id, seat, reason, kind: st.kind, stage: this.gameStatus()?.kind ?? "lobby" });
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
    if (away >= TIMING.ownerHandoverMs / TIMING.speed) {
      this.setOwner(next, "away");
      return;
    }
    if (!this.frozen && !this.closed) this.ownerTimer = setTimeout(() => this.changed([]), TIMING.ownerHandoverMs / TIMING.speed - away);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.clearTimers();
    if (this.ownerTimer) clearTimeout(this.ownerTimer);
    log("info", "room.closed", { room: this.id });
    this.hooks.onChange?.();
    for (const s of this.seatList) {
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
        if (this.game === null || this.status !== "playing") throw new RoomError("NOT_PLAYING", "The game is not running right now");
        const r = this.module.apply(this.game, seat, msg.action);
        if (!r.ok) {
          log("info", "action.rejected", { room: this.id, seat, code: r.error.code, action: msg.action, actors: this.module.actors(this.game) });
          throw new RoomError(r.error.code, r.error.message);
        }
        log("debug", "action.accepted", { room: this.id, seat, action: msg.action });
        this.game = r.state;
        this.changed(r.events);
        return;
      }
      case "continue":
        if (this.gameStatus()?.kind !== "break") return;
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
        if (this.game !== null) throw new RoomError("NOT_IN_LOBBY", "Bots can be added before the game starts");
        if (this.seats[s]) throw new RoomError("SEAT_TAKEN", "That seat is taken");
        const level = msg.level === undefined ? this.module.meta.standInLevel : msg.level;
        if (typeof level !== "string" || !this.module.meta.botLevels.includes(level)) throw new RoomError("BAD_MESSAGE", "Unknown bot level");
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
          else this.seatBot(s, this.module.meta.standInLevel);
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
        if (this.game !== null) return;
        if (this.seats.some((s) => !s)) throw new RoomError("NOT_FULL", "All 4 seats must be filled");
        this.startGame();
        return;
      default:
        throw new RoomError("BAD_MESSAGE", "Unknown message");
    }
  }

  /** "Play against bots" (R-TABLE-13): every empty seat gets a bot of this level, and the game starts. */
  fillWithBots(level: string): void {
    for (const s of this.seatList) if (!this.seats[s]) this.seatBot(s, level);
    this.changed([]);
    this.startIfFull();
  }

  /** A bot in an empty seat, named after its level ("Hard bot", "Hard bot 2", …). */
  private seatBot(seat: Seat, level: string): void {
    const taken = (n: string) => this.seatList.some((i) => this.seats[i]?.name.toLowerCase() === n.toLowerCase());
    let name = levelName(level);
    for (let n = 2; taken(name); n++) name = `${levelName(level)} ${n}`;
    this.seats[seat] = { kind: "bot", name, token: null, conn: null, botPlaying: false, vacant: true, level };
    log("info", "seat.botAdded", { room: this.id, seat, level });
  }

  // -------------------------------------------------------------------------
  // Game flow

  /** R-TABLE-3: the game starts on its own when the last seat is filled. */
  private startIfFull(): void {
    if (this.game === null && this.seats.every((s) => s !== null)) this.startGame();
  }

  private startGame(): void {
    const seed = this.hooks.seed ? this.hooks.seed() : randomInt(2 ** 31);
    this.game = this.module.create({ seed, seats: this.seats.length });
    log("info", "game.started", { room: this.id, game: this.module.meta.id, version: this.module.meta.version, seed, seats: this.seats.map((s) => s && { kind: s.kind, name: s.name, level: s.level }) });
    this.resetBetweenGames();
    this.changed(this.module.started(this.game));
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
    if (this.seatList.every((s) => this.seats[s] && (this.ready.has(s) || this.isBotControlled(s)))) this.startGame();
  }

  /** Between rounds: start the next one when every human is ready, or when the countdown ends. */
  private nextRound(): void {
    const st = this.gameStatus();
    if (!st || st.kind !== "break" || this.status !== "playing") return;
    const r = this.module.apply(this.game, "system", st.next);
    if (!r.ok) return;
    this.game = r.state;
    this.continueAt = null;
    this.continued.clear();
    this.changed(r.events);
  }

  /** Called after every change: send everyone their view, then schedule whatever happens next. */
  private changed(events: GameEventBase[]): void {
    if (this.closed) return;
    // Start the between-rounds countdown before telling anyone, so they all see it.
    const st = this.gameStatus();
    if (st?.kind === "break" && this.continueAt === null) this.continueAt = Date.now() + (st.seconds * 1000) / TIMING.speed;
    this.checkOwner(); // before telling anyone, so everyone sees the current owner
    for (const e of events) {
      if (this.module.isRoundStart(e)) this.roundEvents = [];
      else if (this.module.privateTo(e) === null) this.roundEvents.push(e);
      const line = this.module.logLine?.(e);
      if (line) log("info", line.event, { room: this.id, ...line.fields });
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

  private schedule(events: GameEventBase[]): void {
    this.clearTimers();
    const game = this.game;
    const st = this.gameStatus();
    if (game === null || !st) return;
    if (this.status === "finished") return this.restartIfAllReady();
    if (this.status !== "playing") return;

    if (st.kind === "break") {
      const humansReady = this.seatList.every((s) => this.isBotControlled(s) || this.continued.has(s));
      const at = this.continueAt ?? Date.now();
      if (humansReady || Date.now() >= at) return this.nextRound();
      this.continueTimer = setTimeout(() => this.nextRound(), at - Date.now());
      return;
    }

    // One bot at a time; the next one is scheduled after its move.
    const actor = this.module.actors(game).find((s) => this.isBotControlled(s));
    if (actor === undefined) return;
    const delay = this.module.pace(game, events) / TIMING.speed;
    this.botTimer = setTimeout(() => this.botMove(actor), delay);
  }

  private botMove(seat: Seat): void {
    if (this.game === null || this.status !== "playing" || !this.module.actors(this.game).includes(seat) || !this.isBotControlled(seat)) return;
    const st = this.seats[seat]!;
    const level = st.kind === "bot" ? (st.level ?? this.module.meta.standInLevel) : this.module.meta.standInLevel;
    // The bot sees what a player in its seat sees: its view and the round's public events.
    let action: unknown = null;
    try {
      action = this.module.bot(level, this.module.view(this.game, seat), this.roundEvents, this.botRng, THINK);
    } catch (e) {
      log("error", "bot.crashed", { room: this.id, seat, level, error: e });
    }
    let r = action !== null ? this.module.apply(this.game, seat, action) : null;
    if (!r?.ok) {
      // Never let a bot problem stall the table: log it and make a simple legal move instead.
      if (r && !r.ok) log("error", "bot.illegalMove", { room: this.id, seat, level, action, code: r.error.code });
      action = this.module.fallback(this.game, seat);
      if (action === null) return;
      r = this.module.apply(this.game, seat, action);
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
      game: this.module.meta.id,
      gameVersion: this.module.meta.version,
      status: this.status,
      you: seat,
      owner: this.owner,
      seats: this.seatList.map((s) => {
        const st = this.seats[s];
        if (!st) return { kind: "empty", name: null, connected: false, botPlaying: false, level: null };
        return { kind: st.kind, name: st.name, connected: st.kind === "bot" || !!st.conn, botPlaying: st.botPlaying, level: st.kind === "bot" ? (st.level ?? this.module.meta.standInLevel) : null };
      }),
      invitePath: seat === this.owner ? `/r/${this.id}?i=${this.invite}` : null,
      waitingFor: this.waitingFor(),
      continueAt: this.continueAt,
      continued: [...this.continued],
      ready: [...this.ready],
    };
  }

  private broadcast(events: GameEventBase[]): void {
    for (const s of this.seatList) {
      const conn = this.seats[s]?.conn;
      if (!conn) continue;
      conn.send({
        type: "update",
        room: this.viewFor(s),
        game: this.game !== null ? this.module.view(this.game, s) : null,
        events: events.filter((e) => {
          const only = this.module.privateTo(e);
          return only === null || only === s;
        }),
      });
    }
  }
}
