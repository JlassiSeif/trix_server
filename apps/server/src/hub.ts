// Routes each connection to its room. Parses and checks every incoming message; nothing a
// browser sends can crash the server or reach another room.

import type { ServerMessage } from "@trix/protocol";
import { clip, log } from "./log";
import { Room, RoomError, cleanName, randomId, type Conn } from "./room";

const ROOM_IDLE_MS = 6 * 60 * 60 * 1000; // rooms with nobody connected are dropped after 6 hours

export class Hub {
  readonly rooms = new Map<string, Room>();
  private readonly roomOf = new Map<Conn, Room>();

  constructor(private readonly options: { seed?: () => number } = {}) {}

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
      if (msg.type === "createRoom") return this.create(conn, msg.name);
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
    for (const room of this.rooms.values()) {
      const anyoneHere = room.seats.some((s) => s?.conn);
      if (!anyoneHere && now - room.lastActive > ROOM_IDLE_MS) room.close();
    }
  }

  private create(conn: Conn, name: unknown): void {
    // Check first: a refused request must never pull the player out of the table they're at.
    if (!cleanName(name)) throw new RoomError("BAD_NAME", "Pick a name (1 to 20 characters)");
    const previous = this.roomOf.get(conn);
    let id = randomId(6);
    while (this.rooms.has(id)) id = randomId(6);
    const room = new Room(id, { seed: this.options.seed, onClose: (r) => this.rooms.delete(r.id) });
    this.rooms.set(id, room);
    try {
      room.seatNewPlayer(conn, name, null);
    } catch (e) {
      this.rooms.delete(id);
      throw e;
    }
    previous?.disconnect(conn);
    this.roomOf.set(conn, room);
  }

  private join(conn: Conn, msg: { [k: string]: unknown }): void {
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
