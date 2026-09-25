import type { ComponentType } from "react";
import type { Lang } from "./i18n";
import type { Connection } from "./net";

/** A line in every language. */
export type Localized = Record<Lang, string>;

/** A bot level as a game's page shows it. */
export interface LevelInfo {
  id: string;
  label: Localized;
  /** One line on how it feels to play against. */
  what: Localized;
}

/**
 * What a game gives the hub: a small description, loaded with the home page, and its table
 * screen, loaded only when someone opens that game.
 */
export interface GameUI {
  id: string;
  name: string;
  /** One line for the home page and the game's page. */
  tagline: Localized;
  players: Localized;
  /** Optional: a few images (e.g. cards) laid out as a fan on the game's card on the home page. */
  cover?: string[];
  /** Its icon (docs/game-look.md: simple lines in the current colour; `IconSvg` from the kit). */
  icon: ComponentType;
  /** Optional: the letter in the corners of its card on the home page (default: its name's first letter). */
  initial?: string;
  levels: LevelInfo[];
  /** The table, for every stage after the lobby. Loaded on demand. */
  loadTable: () => Promise<ComponentType<{ conn: Connection }>>;
}

const BOT_WORD: Localized = { en: "bot", fr: "Bot", ar: "روبوت" };

/**
 * A seat's name as shown. The server names bots after their level ("Hard bot", "Hard bot 2");
 * those are shown in the player's language ("Bot difficile 2", "روبوت صعب 2"). People's names as typed.
 */
export function seatName(seat: { kind: string; name: string | null; level: string | null }, lang: Lang, levels: readonly LevelInfo[]): string | null {
  if (seat.kind !== "bot" || !seat.name) return seat.name;
  const n = / bot(?: (\d+))?$/i.exec(seat.name);
  const level = levels.find((l) => l.id === seat.level);
  if (!n || !level) return seat.name;
  const label = level.label[lang];
  const base = lang === "en" ? `${label} ${BOT_WORD.en}` : lang === "fr" ? `${BOT_WORD.fr} ${label.toLowerCase()}` : `${BOT_WORD.ar} ${label}`;
  return n[1] ? `${base} ${n[1]}` : base;
}
