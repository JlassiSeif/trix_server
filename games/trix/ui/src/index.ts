// Trix for the hub: its description (loaded with the home page) and its table (loaded on demand).

import { cardFaceUrl, type GameUI } from "@platform/ui";
import { TrixIcon } from "./icon";
import { LEVELS } from "./levels";

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
  cover: [cardFaceUrl("q_s"), cardFaceUrl("k_h"), cardFaceUrl("10_d")],
  initial: "T",
  icon: TrixIcon,
  levels: LEVELS,
  loadTable: () => import("./Table").then((m) => m.Table),
};
