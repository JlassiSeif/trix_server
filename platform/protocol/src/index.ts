// Messages between the browser and the server, over one WebSocket per player.
// The server is the only authority: the browser sends what the player wants to do,
// the server checks it with the game's rules and sends every player their own view.
//
// The platform never looks inside a game's moves, views or events: they travel as the game's own
// data. A game's screens type them with the parameters below (e.g. ServerMessage<TrixView, TrixEvent>).

export type Seat = number;

/** Any message may carry an `id`; an error caused by it echoes that id as `re`. */
export type ClientMessage = ClientRequest & { id?: number };

export type ClientRequest =
  /** Create a room for a game and take its first seat as the owner (R-TABLE-2). With `bots`, the
   *  other seats get bots of that level and the game starts at once ("Play against bots"). */
  | { type: "createRoom"; name: string; game?: string; bots?: string }
  /** Who you are: a Firebase ID token when signed in, null for a guest. Sent before joining. */
  | { type: "identify"; idToken: string | null }
  /** Join with an invite (new player) or a seat token (returning player, R-TABLE-5). */
  | { type: "joinRoom"; roomId: string; invite?: string; token?: string; name?: string }
  /** A game move, checked by the game's rules. */
  | { type: "action"; action: unknown }
  /** Between rounds: ready for the next one. */
  | { type: "continue" }
  /** After the game: ready to play again (R-TABLE-8). */
  | { type: "ready" }
  | { type: "leave" }
  // Room owner only
  /** A bot at one of the game's levels (default: the game's stand-in level). */
  | { type: "addBot"; seat: Seat; level?: string }
  | { type: "kick"; seat: Seat }
  /** Hand ownership to another connected player (R-TABLE-12). */
  | { type: "makeOwner"; seat: Seat }
  | { type: "resumeWithBots" }
  | { type: "endGame" }
  /** In the lobby with every seat filled (e.g. after the owner ended a game). */
  | { type: "startGame" };

export type RoomStatus = "lobby" | "playing" | "paused" | "finished";

export interface SeatInfo {
  kind: "empty" | "human" | "bot";
  name: string | null;
  connected: boolean;
  /** A bot is playing this seat for someone who is away (R-TABLE-7). */
  botPlaying: boolean;
  /** Bots only: how well it plays. */
  level: string | null;
}

export interface RoomView {
  id: string;
  /** Which game this room plays, and the version it runs. */
  game: string;
  gameVersion: string;
  status: RoomStatus;
  you: Seat;
  owner: Seat;
  seats: SeatInfo[];
  /** Invite link path, e.g. /r/abc?i=xyz. Only sent to the room owner (R-TABLE-6). */
  invitePath: string | null;
  /** Seats the table is waiting for while paused. */
  waitingFor: Seat[];
  /** Between rounds: when the next one starts on its own (epoch ms), and who is ready. */
  continueAt: number | null;
  continued: Seat[];
  /** After the game: who clicked Ready. */
  ready: Seat[];
}

export type ServerMessage<View = unknown, Event = unknown> =
  /** You have a seat. Keep the token: it brings you back to the same seat (R-TABLE-5). */
  | { type: "joined"; roomId: string; seat: Seat; token: string }
  | { type: "update"; room: RoomView; game: View | null; events: Event[] }
  /** `re` is the `id` of the message that caused it, when that message had one. */
  | { type: "error"; code: string; message: string; re?: number }
  /** The answer to "identify". */
  | { type: "identified"; signedIn: boolean }
  /** You were removed from the room (kicked, or you left). */
  | { type: "removed"; reason: "kicked" | "left" | "roomClosed" };

export const NAME_MAX = 20;

/** A game as the home page lists it (GET /api/games). */
export interface GameListing {
  id: string;
  name: string;
  version: string;
  seats: { min: number; max: number };
  botLevels: readonly string[];
  /** False while the game is switched off: no new tables (existing ones finish). */
  open: boolean;
}
