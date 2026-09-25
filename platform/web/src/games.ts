// The games on the site. Adding a game: its UI package's description here, its module on the
// server (platform/server/src/games.ts).

import type { ComponentType } from "react";
import type { GameUI } from "@platform/ui";
import { trixUI } from "@games/trix-ui";
import {
  BeloteIcon,
  BentWWledIcon,
  ChkobbaIcon,
  DamaIcon,
  DominosIcon,
  GooseIcon,
  JhayechIcon,
  KharbgaIcon,
  LoupGarouIcon,
  PabloIcon,
  RamiIcon,
  TekdhebIcon,
} from "./game-icons";

export const GAMES: GameUI[] = [trixUI];

export const gameById = (id: string | null | undefined) => GAMES.find((g) => g.id === id) ?? null;

/** On the home page as "coming soon", face down, in the order they're planned (docs/games.md).
 *  Trademarked names wait for our own names. */
export interface ComingSoon {
  id: string;
  name: string;
  Icon: ComponentType;
}
export const COMING_SOON: ComingSoon[] = [
  { id: "chkobba", name: "Chkobba", Icon: ChkobbaIcon },
  { id: "rami", name: "Rami", Icon: RamiIcon },
  { id: "belote", name: "Belote", Icon: BeloteIcon },
  { id: "pablo", name: "Pablo", Icon: PabloIcon },
  { id: "tekdheb", name: "Tekdheb", Icon: TekdhebIcon },
  { id: "dominos", name: "Dominos", Icon: DominosIcon },
  { id: "dama", name: "Dama", Icon: DamaIcon },
  { id: "kharbga", name: "Kharbga", Icon: KharbgaIcon },
  { id: "goose", name: "The goose game", Icon: GooseIcon },
  { id: "loup-garou", name: "Loup garou", Icon: LoupGarouIcon },
  { id: "bent-w-wled", name: "Bent w wled", Icon: BentWWledIcon },
  { id: "jhayech", name: "Jhayech", Icon: JhayechIcon },
];
