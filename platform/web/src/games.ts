// The games on the site. Adding a game: its UI package's description here, its module on the
// server (platform/server/src/games.ts).

import type { GameUI } from "@platform/ui";
import { trixUI } from "@games/trix-ui";

export const GAMES: GameUI[] = [trixUI];

export const gameById = (id: string | null | undefined) => GAMES.find((g) => g.id === id) ?? null;

/** On the home page as "coming soon" (TODO.md). Trademarked names wait for our own names. */
export const COMING_SOON = ["Chkobba", "Rami", "Belote", "Bent w wled", "Dominos", "Loup garou", "Pablo", "Jhayech", "Tekdheb", "The goose game"];
