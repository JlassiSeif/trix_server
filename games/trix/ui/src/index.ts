// Trix for the hub: its description (loaded with the home page) and its table (loaded on demand).

import type { GameUI } from "@platform/ui";

export const trixUI: GameUI = {
  id: "trix",
  name: "Trix",
  tagline: "Seven contracts, four players, and the lowest score wins.",
  players: "4 players",
  // docs/bots.md §2: how each level feels.
  levels: [
    { id: "easy", label: "Easy", what: "a beginner who knows the rules" },
    { id: "medium", label: "Medium", what: "a decent club player" },
    { id: "hard", label: "Hard", what: "a strong, patient player" },
  ],
  loadTable: () => import("./Table").then((m) => m.Table),
};
