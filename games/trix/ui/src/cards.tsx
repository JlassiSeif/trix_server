import type { ImgHTMLAttributes } from "react";
import type { CardId, Contract } from "@games/trix";
import { cardBackUrl } from "@platform/ui";
import { cardLabel } from "./text";

// Card faces come from the old client's assets (archive/client-sdl/assets/cards: GNOME Aisleriot,
// GPL-3.0-or-later); the back is Dineri's (docs/game-look.md). The contract icons are Seif's own
// hand-drawn tiles from the 2023 game (assets/lo3ab.bmp), kept as drawn: only their grey canvas was
// made transparent (2026-09-25), so they sit on an ivory tile. Bundled with the Trix screens.
const urls = (files: Record<string, string>) => Object.fromEntries(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -4), url]));
const CARD_URL = urls(import.meta.glob<string>("./assets/cards/*.png", { eager: true, query: "?url", import: "default" }));
const CONTRACT_URL = urls(import.meta.glob<string>("./assets/contracts/*.png", { eager: true, query: "?url", import: "default" }));

export function Card({ id, className = "", onClick, title, ...rest }: { id: CardId | "back"; className?: string; onClick?: () => void; title?: string } & Omit<ImgHTMLAttributes<HTMLImageElement>, "id" | "onClick">) {
  const alt = id === "back" ? "card back" : cardLabel(id);
  return (
    <img
      {...rest}
      className={`card ${onClick ? "clickable" : ""} ${className}`}
      src={id === "back" ? cardBackUrl : CARD_URL[id]}
      alt={alt}
      title={title ?? alt}
      draggable={false}
      onClick={onClick}
    />
  );
}

export function ContractIcon({ contract, className = "" }: { contract: Contract; className?: string }) {
  return <img className={`contract-icon ${className}`} src={CONTRACT_URL[contract]} alt={contract} title={contract} draggable={false} />;
}
