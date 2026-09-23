// Messages between the browser and the server, over one WebSocket per player.
// The server is the only authority: the browser sends what the player wants to do,
// the server checks it with the engine and sends every player their own view.

import type { Action, GameEvent, PlayerView, Seat } from "@trix/engine";

/** Any message may carry an `id`; an error caused by it echoes that id as `re`. */
export type ClientMessage = ClientRequest & { id?: number };

export type ClientRequest =
  /** Create a room and take seat 0 as its owner (R-TABLE-2). */
  | { type: "createRoom"; name: string }
  /** Join with an invite (new player) or a seat token (returning player, R-TABLE-5). */
  | { type: "joinRoom"; roomId: string; invite?: string; token?: string; name?: string }
  /** A game move, checked by the engine. */
  | { type: "action"; action: Action }
  /** Between contracts: ready for the next deal. */
  | { type: "continue" }
  /** After the game: ready to play again (R-TABLE-8). */
  | { type: "ready" }
  | { type: "leave" }
  // Room owner only
  | { type: "addBot"; seat: Seat }
  | { type: "kick"; seat: Seat }
  | { type: "resumeWithBots" }
  | { type: "endGame" }
  /** In the lobby with 4 seats filled (e.g. after the owner ended a game). */
  | { type: "startGame" };

export type RoomStatus = "lobby" | "playing" | "paused" | "finished";

export interface SeatInfo {
  kind: "empty" | "human" | "bot";
  name: string | null;
  connected: boolean;
  /** A bot is playing this seat for someone who is away (R-TABLE-7). */
  botPlaying: boolean;
}

export interface RoomView {
  id: string;
  status: RoomStatus;
  you: Seat;
  owner: Seat;
  seats: SeatInfo[];
  /** Invite link path, e.g. /r/abc?i=xyz. Only sent to the room owner (R-TABLE-6). */
  invitePath: string | null;
  /** Seats the table is waiting for while paused. */
  waitingFor: Seat[];
  /** Between contracts: when the next deal starts on its own (epoch ms), and who is ready. */
  continueAt: number | null;
  continued: Seat[];
  /** After the game: who clicked Ready. */
  ready: Seat[];
}

export type ServerMessage =
  /** You have a seat. Keep the token: it brings you back to the same seat (R-TABLE-5). */
  | { type: "joined"; roomId: string; seat: Seat; token: string }
  | { type: "update"; room: RoomView; game: PlayerView | null; events: GameEvent[] }
  /** `re` is the `id` of the message that caused it, when that message had one. */
  | { type: "error"; code: string; message: string; re?: number }
  /** You were removed from the room (kicked, or you left). */
  | { type: "removed"; reason: "kicked" | "left" | "roomClosed" };

export const NAME_MAX = 20;
export const CONTINUE_SECONDS = 10;
