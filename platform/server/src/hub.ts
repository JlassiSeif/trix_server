// Routes each connection to its room. Parses and checks every incoming message; nothing a
// browser sends can crash the server or reach another room.

import { isBotLevel } from "@games/trix";
import type { ServerMessage } from "@platform/protocol";
import { clip, log } from "./log";
import { Room, RoomError, cleanName, randomId, type Conn, type RoomSnapshot } from "./room";

const ROOM_IDLE_MS = 6 * 60 * 60 * 1000; // rooms with nobody connected are dropped after 6 hours

export interface HubSnapshot {
  version: 1;
  savedAt: string;
  rooms: RoomSnapshot[];
}

export class Hub {
  readonly rooms = new Map<string, Room>();
  private readonly roomOf = new Map<Conn, Room>();

  /** Failed join attempts per address (wrong invite, token or room), to stop guessing. */
  private failures = new Map<string, number[]>();

  constructor(
    private readonly options: {
      seed?: () => number;
      maxRooms?: number;
      /** Tables one address may have open at once. */
      maxRoomsPerIp?: number;
      /** Wrong guesses allowed per address within `failureWindowMs`. */
      maxJoinFailures?: number;
      failureWindowMs?: number;
      onChange?: () => void;
    } = {},
  ) {}

  private recentFailures(ip: string, now = Date.now()): number[] {
    const window = this.options.failureWindowMs ?? 10 * 60 * 1000;
    const list = (this.failures.get(ip) ?? []).filter((t) => now - t < window);
    if (list.length) this.failures.set(ip, list);
    else this.failures.delete(ip);
    return list;
  }

  private roomHooks() {
    return { seed: this.options.seed, onChange: this.options.onChange, onClose: (r: Room) => this.rooms.delete(r.id) };
  }

  snapshot(): HubSnapshot {
    return { version: 1, savedAt: new Date().toISOString(), rooms: [...this.rooms.values()].map((r) => r.toJSON()) };
  }

  /** Bring saved rooms back. Rooms idle too long are dropped. Returns how many came back. */
  restore(snap: HubSnapshot, now = Date.now()): number {
    if (snap.version !== 1) throw new Error(`unknown state file version ${String(snap.version)}`);
    for (const r of snap.rooms) {
      if (now - r.lastActive > ROOM_IDLE_MS) continue;
      const room = Room.fromJSON(r, this.roomHooks());
      this.rooms.set(room.id, room);
    }
    for (const room of this.rooms.values()) room.wake();
    return this.rooms.size;
  }

  stopTimers(): void {
    for (const room of this.rooms.values()) room.freeze();
  }

  receive(conn: Conn, raw: string): void {
    let msg: { type?: unknown; [k: string]: unknown };
    try {
      msg = JSON.parse(raw);
    } catch {
      log("warn", "message.bad", { reason: "not JSON", raw: clip(raw) });
      return this.error(conn, "BAD_MESSAGE", "Not JSON");
    }
    if (typeof msg !== "object" || msg === null || typeof msg.type !== "string") {
      log("warn", "message.bad", { reason: "malformed", raw: clip(raw) });
      return this.error(conn, "BAD_MESSAGE", "Malformed message");
    }
    const re = typeof msg.id === "number" ? msg.id : undefined;
    try {
      if (msg.type === "createRoom") return this.create(conn, msg.name, msg.bots);
      if (msg.type === "joinRoom") return this.join(conn, msg);
      const room = this.roomOf.get(conn);
      if (!room) return this.error(conn, "NOT_SEATED", "Join a room first", re);
      room.handle(conn, msg as { type: string });
    } catch (e) {
      if (e instanceof RoomError) {
        if (msg.type !== "action") log("info", "request.refused", { code: e.code, type: msg.type, room: this.roomOf.get(conn)?.id });
        return this.error(conn, e.code, e.message, re);
      }
      log("error", "message.crashed", { error: e, raw: clip(raw), room: this.roomOf.get(conn)?.id });
      this.error(conn, "SERVER_ERROR", "Something went wrong on the server", re);
    }
  }

  roomIdOf(conn: Conn): string | undefined {
    return this.roomOf.get(conn)?.id;
  }

  disconnected(conn: Conn): void {
    const room = this.roomOf.get(conn);
    this.roomOf.delete(conn);
    room?.disconnect(conn);
  }

  /** Drop rooms nobody has been connected to for a long time. */
  sweep(now = Date.now()): void {
    for (const ip of [...this.failures.keys()]) this.recentFailures(ip, now);
    for (const room of this.rooms.values()) {
      const anyoneHere = room.seats.some((s) => s?.conn);
      if (!anyoneHere && now - room.lastActive > ROOM_IDLE_MS) room.close();
    }
  }

  private create(conn: Conn, name: unknown, bots: unknown): void {
    // Check first: a refused request must never pull the player out of the table they're at.
    if (!cleanName(name)) throw new RoomError("BAD_NAME", "Pick a name (1 to 20 characters)");
    if (bots !== undefined && !isBotLevel(bots)) throw new RoomError("BAD_MESSAGE", "Unknown bot level");
    const previous = this.roomOf.get(conn);
    if (this.rooms.size >= (this.options.maxRooms ?? Infinity)) throw new RoomError("SERVER_FULL", "The server has too many tables right now. Try again later.");
    const perIp = this.options.maxRoomsPerIp ?? Infinity;
    const mine = conn.ip ? [...this.rooms.values()].filter((r) => r.creatorIp === conn.ip) : [];
    if (mine.length >= perIp) {
      // A table of this address that nobody is connected to any more (tabs closed) makes way for
      // the new one, oldest first. Tables people are still at count against the limit.
      const abandoned = mine.filter((r) => !r.seats.some((s) => s?.conn)).sort((a, b) => a.lastActive - b.lastActive)[0];
      if (!abandoned) {
        log("warn", "room.tooManyFromAddress", { ip: conn.ip });
        throw new RoomError("TOO_MANY_TABLES", "You already have several tables open. Close one first.");
      }
      log("info", "room.recycled", { room: abandoned.id, ip: conn.ip });
      abandoned.close();
    }
    let id = randomId(6);
    while (this.rooms.has(id)) id = randomId(6);
    const room = new Room(id, this.roomHooks());
    room.creatorIp = conn.ip;
    this.rooms.set(id, room);
    try {
      room.seatNewPlayer(conn, name, null);
    } catch (e) {
      this.rooms.delete(id);
      throw e;
    }
    previous?.disconnect(conn);
    this.roomOf.set(conn, room);
    // "Play against bots" (R-TABLE-13): three bots of the chosen level, and the game starts.
    if (bots !== undefined) room.fillWithBots(bots);
  }

  private join(conn: Conn, msg: { [k: string]: unknown }): void {
    // Guessing invite codes, seat tokens or room ids gets an address locked out for a while.
    const ip = conn.ip;
    const max = this.options.maxJoinFailures ?? Infinity;
    if (ip && this.recentFailures(ip).length >= max) throw new RoomError("TOO_MANY_ATTEMPTS", "Too many wrong links from your address. Wait a few minutes and try again.");
    try {
      this.joinChecked(conn, msg);
    } catch (e) {
      if (ip && e instanceof RoomError && ["ROOM_NOT_FOUND", "BAD_INVITE", "BAD_TOKEN"].includes(e.code)) {
        const list = this.recentFailures(ip);
        list.push(Date.now());
        this.failures.set(ip, list);
        if (list.length === max) log("warn", "join.lockedOut", { ip, failures: list.length });
      }
      throw e;
    }
  }

  private joinChecked(conn: Conn, msg: { [k: string]: unknown }): void {
    const room = typeof msg.roomId === "string" ? this.rooms.get(msg.roomId) : undefined;
    if (!room) throw new RoomError("ROOM_NOT_FOUND", "This room does not exist (any more)");
    const previous = this.roomOf.get(conn);
    if (previous === room && typeof msg.token !== "string") throw new RoomError("ALREADY_SEATED", "You are already at this table");
    // Join first; only once that worked, leave the old table (one connection, one table).
    // A refused join leaves the player exactly where they were.
    if (typeof msg.token === "string") room.reconnect(conn, msg.token);
    else room.seatNewPlayer(conn, msg.name, typeof msg.invite === "string" ? msg.invite : null);
    if (previous && previous !== room) previous.disconnect(conn);
    this.roomOf.set(conn, room);
  }

  private error(conn: Conn, code: string, message: string, re?: number): void {
    const msg: ServerMessage = re === undefined ? { type: "error", code, message } : { type: "error", code, message, re };
    conn.send(msg);
  }
}
