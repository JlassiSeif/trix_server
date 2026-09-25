// Trix for the hub: its description (loaded with the home page) and its table (loaded on demand).

import type { GameUI } from "@platform/ui";
import { LEVELS } from "./levels";
import kingOfHearts from "./assets/cards/k_h.png?url";
import tenOfDiamonds from "./assets/cards/10_d.png?url";
import queenOfSpades from "./assets/cards/q_s.png?url";

export const trixUI: GameUI = {
  id: "trix",
  name: "Trix",
  tagline: {
    en: "Seven contracts, four players, and the lowest score wins.",
    fr: "Sept contrats, quatre joueurs, et le plus petit score gagne.",
    ar: "سبعة عقود وأربعة لاعبين، والأقل نقاطًا يفوز.",
  },
  players: { en: "4 players", fr: "4 joueurs", ar: "4 لاعبين" },
  // The K♥ (ray), a diamond (dineri) and a queen (damet): three of Trix's contracts in one fan.
  cover: [queenOfSpades, kingOfHearts, tenOfDiamonds],
  initial: "T",
  levels: LEVELS,
  loadTable: () => import("./Table").then((m) => m.Table),
};
