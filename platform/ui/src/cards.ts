// The shared card deck: the faces from Seif's 2023 game (archive/client-sdl/assets/cards), which
// Seif prefers (2026-09-25). Only 7 to ace for now (32 cards); games that need 2–6 or jokers wait
// for matching faces (docs/games.md). Ids: "<rank>_<suit>" with rank a 2 3 4 5 6 7 8 9 10 j q k and
// suit c d h s, plus "joker_red" and "joker_black". Dineri's card back is `cardBackUrl`.

const FACES = Object.fromEntries(
  Object.entries(import.meta.glob<string>("./assets/cards/*.png", { eager: true, query: "?url", import: "default" })).map(([path, url]) => [
    path.slice(path.lastIndexOf("/") + 1, -4),
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
