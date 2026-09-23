// One table of 4 (RULES.md §7). Owns the seats, the game state and the timers; every game
// move goes through the engine. Nothing here trusts the browser.

import { randomBytes, randomInt } from "node:crypto";
import {
  SEATS,
  applyAction,
  createGame,
  placeholderBotAction,
  privateTo,
  viewFor,
  type GameEvent,
  type GameState,
  type Seat,
} from "@trix/engine";
import { CONTINUE_SECONDS, NAME_MAX, type RoomStatus, type RoomView, type ServerMessage } from "@trix/protocol";

/** One player's connection. The WebSocket in production, a fake in tests. */
export interface Conn {
  send(msg: ServerMessage): void;
  close(): void;
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
}

export const TIMING = {
  botMoveMs: 900,
  botPickMs: 1400,
  /** After a trick is taken, so everyone sees what came out before the next lead. */
  afterTrickMs: 1800,
  continueMs: CONTINUE_SECONDS * 1000,
};

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const randomId = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const newToken = () => randomBytes(16).toString("hex");

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
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private continueTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(
    id: string,
    private readonly hooks: { onClose?: (room: Room) => void; seed?: () => number } = {},
  ) {
    this.id = id;
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
    // Free seat first; during a game a stand-in bot's seat can be taken over too.
    let seat = SEATS.find((s) => this.seats[s] === null);
    if (seat === undefined && this.game) seat = SEATS.find((s) => this.seats[s]?.vacant);
    if (seat === undefined) throw new RoomError("ROOM_FULL", "The table is full");
    const token = newToken();
    this.seats[seat] = { kind: "human", name, token, conn, botPlaying: false, vacant: false };
    if (creating) this.owner = seat;
    conn.send({ type: "joined", roomId: this.id, seat, token });
    this.changed([]);
    this.startIfFull();
    return seat;
  }

  /** A returning player reclaims their seat with their token (R-TABLE-5). */
  reconnect(conn: Conn, token: unknown): Seat {
    const seat = SEATS.find((s) => typeof token === "string" && this.seats[s]?.token === token);
    if (seat === undefined) throw new RoomError("BAD_TOKEN", "That seat is no longer yours");
    const st = this.seats[seat]!;
    if (st.conn && st.conn !== conn) {
      // Same player, new tab: the old tab is dropped.
      st.conn.send({ type: "error", code: "REPLACED", message: "This seat was opened in another tab" });
      st.conn.close();
    }
    st.conn = conn;
    st.botPlaying = false;
    conn.send({ type: "joined", roomId: this.id, seat, token: st.token! });
    this.changed([]);
    return seat;
  }

  disconnect(conn: Conn): void {
    const seat = this.seatOf(conn);
    if (seat === null) return;
    this.seats[seat]!.conn = null;
    this.changed([]); // pauses the game if it needs this player (R-TABLE-4)
    if (this.humans().every((s) => !this.seats[s]!.conn)) this.lastActive = Date.now();
  }

  /** Leaving and being kicked are the same (R-TABLE-6): the seat empties and the invite link changes. */
  private vacate(seat: Seat, reason: "kicked" | "left"): void {
    const st = this.seats[seat];
    if (!st) return;
    this.seats[seat] = null;
    this.continued.delete(seat);
    this.ready.delete(seat);
    if (st.conn) {
      st.conn.send({ type: "removed", reason });
      st.conn.close();
    }
    if (st.kind === "human") this.invite = randomId(8);
    if (seat === this.owner) {
      const next = this.humans()[0];
      if (next === undefined) return this.close();
      this.owner = next;
    }
    this.changed([]);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.clearTimers();
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
        if (!r.ok) throw new RoomError(r.error.code, r.error.message);
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
        const botNo = SEATS.filter((i) => this.seats[i]?.kind === "bot").length + 1;
        this.seats[s] = { kind: "bot", name: `Bot ${botNo}`, token: null, conn: null, botPlaying: false, vacant: true };
        this.changed([]);
        this.startIfFull();
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
          else this.seats[s] = { kind: "bot", name: "Bot", token: null, conn: null, botPlaying: false, vacant: true };
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

  // -------------------------------------------------------------------------
  // Game flow

  /** R-TABLE-3: the game starts on its own when the 4th seat is filled. */
  private startIfFull(): void {
    if (!this.game && this.seats.every((s) => s !== null)) this.startGame();
  }

  private startGame(): void {
    const seed = this.hooks.seed ? this.hooks.seed() : randomInt(2 ** 31);
    this.game = createGame({ seed });
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
    this.broadcast(events);
    this.schedule(events);
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
    const action = placeholderBotAction(this.game, seat);
    if (!action) return;
    const r = applyAction(this.game, seat, action);
    if (!r.ok) return; // cannot happen: the bot only picks legal actions (R-BOT-1)
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
        if (!st) return { kind: "empty", name: null, connected: false, botPlaying: false };
        return { kind: st.kind, name: st.name, connected: st.kind === "bot" || !!st.conn, botPlaying: st.botPlaying };
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
