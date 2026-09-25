import type { ImgHTMLAttributes } from "react";
import type { CardId, Contract } from "@games/trix";
import { cardBackUrl, cardFaceUrl } from "@platform/ui";
import { cardLabel } from "./text";

// Card faces and back are the platform's shared deck (platform/ui/src/cards.ts: GNOME Aisleriot's
// faces, GPL-3.0-or-later, and Dineri's back; docs/game-look.md). The contract icons are Seif's own
// hand-drawn tiles from the 2023 game (assets/lo3ab.bmp), kept as drawn: only their grey canvas was
// made transparent (2026-09-25), so they sit on an ivory tile. Bundled with the Trix screens.
const urls = (files: Record<string, string>) => Object.fromEntries(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -4), url]));
const CONTRACT_URL = urls(import.meta.glob<string>("./assets/contracts/*.png", { eager: true, query: "?url", import: "default" }));

export function Card({ id, className = "", onClick, title, ...rest }: { id: CardId | "back"; className?: string; onClick?: () => void; title?: string } & Omit<ImgHTMLAttributes<HTMLImageElement>, "id" | "onClick">) {
  const alt = id === "back" ? "card back" : cardLabel(id);
  return (
    <img
      {...rest}
      className={`card ${onClick ? "clickable" : ""} ${className}`}
      src={id === "back" ? cardBackUrl : cardFaceUrl(id)}
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
