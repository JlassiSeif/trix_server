// The shared card decks. A game says which one it plays with (Seif, 2026-09-25: not every card game
// uses the same cards):
// - "classic": GNOME Aisleriot's original "bonded" deck (GPL), the faces of Seif's 2023 game. 7 to
//   ace are the 2023 files themselves; 2 to 6 and the two jokers were cut from the same deck the same
//   way (tools/cards-from-aisleriot.mjs). 52 cards and two jokers. Trix, and the other card games
//   unless Seif says otherwise.
// - "chkobba": the Tunisian deck, pips without numbers, by Abjiklam on Wikimedia Commons (1 to 7:
//   CC0; queen, jack, king: CC BY-SA 4.0; sources in assets-src/chkobba). 40 cards: ace to 7, and
//   queen (worth 8), jack (9), king (10). Chkobba and Pablo.
// Ids: "<rank>_<suit>", rank a 2 3 4 5 6 7 8 9 10 j q k, suit c d h s; "joker_red", "joker_black".
// Dineri's own back (`cardBackUrl`) is the back of every deck.

export type Deck = "classic" | "chkobba";

const load = (files: Record<string, string>, ext: string) =>
  Object.fromEntries(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -ext.length), url]));
const FACES: Record<Deck, Record<string, string>> = {
  classic: load(import.meta.glob<string>("./assets/cards/*.png", { eager: true, query: "?url", import: "default" }), ".png"),
  chkobba: load(import.meta.glob<string>("./assets/decks/chkobba/*.webp", { eager: true, query: "?url", import: "default" }), ".webp"),
};

/** Each deck's card shape (width / height), for laying cards out. */
export const DECK_ASPECT: Record<Deck, number> = { classic: 79 / 123, chkobba: 89 / 131 };

export type Suit = "c" | "d" | "h" | "s";
export type Rank = "a" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "j" | "q" | "k";
export type CardFace = `${Rank}_${Suit}` | "joker_red" | "joker_black";

/** The image of a card's face in a deck. */
export function cardFaceUrl(id: CardFace, deck: Deck = "classic"): string {
  const url = FACES[deck][id];
  if (!url) throw new Error(`no card ${id} in the ${deck} deck`);
  return url;
}
