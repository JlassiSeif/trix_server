import type { ComponentType } from "react";
import type { Connection } from "./net";

/** A bot level as a game's page shows it. */
export interface LevelInfo {
  id: string;
  label: string;
  /** One line on how it feels to play against. */
  what: string;
}

/**
 * What a game gives the hub: a small description, loaded with the home page, and its table
 * screen, loaded only when someone opens that game.
 */
export interface GameUI {
  id: string;
  name: string;
  /** One line for the home page and the game's page. */
  tagline: string;
  players: string;
  levels: LevelInfo[];
  /** The table, for every stage after the lobby. Loaded on demand. */
  loadTable: () => Promise<ComponentType<{ conn: Connection }>>;
}
