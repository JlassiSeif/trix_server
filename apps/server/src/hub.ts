// Routes each connection to its room. Parses and checks every incoming message; nothing a
// browser sends can crash the server or reach another room.

import type { ServerMessage } from "@trix/protocol";
import { Room, RoomError, randomId, type Conn } from "./room";

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
      return this.error(conn, "BAD_MESSAGE", "Not JSON");
    }
    if (typeof msg !== "object" || msg === null || typeof msg.type !== "string") {
      return this.error(conn, "BAD_MESSAGE", "Malformed message");
    }
    try {
      if (msg.type === "createRoom") return this.create(conn, msg.name);
      if (msg.type === "joinRoom") return this.join(conn, msg);
      const room = this.roomOf.get(conn);
      if (!room) return this.error(conn, "NOT_SEATED", "Join a room first");
      room.handle(conn, msg as { type: string });
    } catch (e) {
      if (e instanceof RoomError) return this.error(conn, e.code, e.message);
      console.error("Unexpected error handling message", e);
      this.error(conn, "SERVER_ERROR", "Something went wrong on the server");
    }
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
    this.leaveCurrent(conn);
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
    this.roomOf.set(conn, room);
  }

  private join(conn: Conn, msg: { [k: string]: unknown }): void {
    const room = typeof msg.roomId === "string" ? this.rooms.get(msg.roomId) : undefined;
    if (!room) throw new RoomError("ROOM_NOT_FOUND", "This room does not exist (any more)");
    this.leaveCurrent(conn);
    if (typeof msg.token === "string") room.reconnect(conn, msg.token);
    else room.seatNewPlayer(conn, msg.name, typeof msg.invite === "string" ? msg.invite : null);
    this.roomOf.set(conn, room);
  }

  /** One connection sits at one table at a time. */
  private leaveCurrent(conn: Conn): void {
    const room = this.roomOf.get(conn);
    if (!room) return;
    this.roomOf.delete(conn);
    room.disconnect(conn);
  }

  private error(conn: Conn, code: string, message: string): void {
    const msg: ServerMessage = { type: "error", code, message };
    conn.send(msg);
  }
}
