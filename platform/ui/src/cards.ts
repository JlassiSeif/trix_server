// The shared card deck (docs/game-look.md): 52 faces and two jokers, GNOME Aisleriot's "bonded"
// theme (GPL-3.0-or-later) rendered by tools/render-cards.mjs. Every card game uses these ids:
// "<rank>_<suit>" with rank a 2 3 4 5 6 7 8 9 10 j q k and suit c d h s, plus "joker_red" and
// "joker_black". Dineri's card back is `cardBackUrl`.

const FACES = Object.fromEntries(
  Object.entries(import.meta.glob<string>("./assets/cards/*.webp", { eager: true, query: "?url", import: "default" })).map(([path, url]) => [
    path.slice(path.lastIndexOf("/") + 1, -5),
    url,
  ]),
);

export type Suit = "c" | "d" | "h" | "s";
export type Rank = "a" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "j" | "q" | "k";
export type CardFace = `${Rank}_${Suit}` | "joker_red" | "joker_black";

/** The image of a card's face. */
export function cardFaceUrl(id: CardFace): string {
  const url = FACES[id];
  if (!url) throw new Error(`no card face ${id}`);
  return url;
}
