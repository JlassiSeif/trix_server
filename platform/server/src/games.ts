// The games this server runs. Adding a game: add its module here (and its screens in platform/web).

import { trixGame } from "@games/trix";
import type { GameModule } from "@platform/sdk";

export const GAMES: Record<string, GameModule> = {
  [trixGame.meta.id]: trixGame as unknown as GameModule,
};

/** Rooms and saves from before the hub had no game id: they are Trix. */
export const DEFAULT_GAME = "trix";
