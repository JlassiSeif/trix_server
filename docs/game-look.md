# How games look on Dineri: one house, many rooms

**Status: APPROVED by Seif, 2026-09-25** (principle and details, with his answers in §5).

Every game on Dineri lives in the same house. The frame, the type, the colours, the controls and the way players are shown are shared, so moving from the hub into any game feels like one place. Inside that frame, each game furnishes its own room: its playing surface, its pieces, one accent colour, and later its sounds. A game is never a separate site with its own logo.

The brand itself (`brand/BRAND.md`) stays locked. This document says how games use it; it adds no colours, fonts or logos.

## 1. The house: what every game shares

| | Rule |
|---|---|
| **Frame** | The hub's pages before and after play: the game's page, the lobby, the invite link, "Open elsewhere", the pages you land on when a table is gone. At the table itself, Dineri's name and the language menu sit at the top of the side panel (on a phone, at the top of the panel you open), so the table keeps its full height. The name is not a link at the table: leaving a game must always be deliberate ("Leave the table"). |
| **Type** | Reem Kufi for titles, names and big numbers; Rubik for everything else. No other typefaces, including the system font. Both cover Latin and Arabic. |
| **Colour** | Only the brand's tokens (`--dineri-*`), plus the game's one accent (§2). No hex codes in a game's styles; shadows may use black at any opacity. Meanings are the same in every game: **brass** = the main action and "your turn"; **red** = points against you, danger, leaving; **felt green** = good for you; **lamp** = a warning (away, a bot playing for someone). |
| **Controls** | Buttons, inputs, chips, toasts, dialogs and overlays come from the shared kit (`platform/ui`), which draws them in the brand's style. A game doesn't style its own buttons. |
| **Panels** | Two kinds only: **ivory cards** (like the game cards on the home page: ivory, ink text, Reem Kufi title) for moments that ask for attention (choose, round summary, game over, paused), and **night panels** (like the sign-in window) for information that stays on screen (leaderboard, what's happening). |
| **Players** | A seat looks the same in every game: name (Reem Kufi), "you", the owner's crown, a bot's level in pips (♦ ♦♦ ♦♦♦), "away", "a bot is playing", and a brass glow when it's their turn. Shared component, so personas and avatars can later show up everywhere at once. |
| **Card backs** | Every card game uses Dineri's back: burgundy, the eight-point star pattern, the brass medallion (the "coming soon" cards on the home page). Never a red diamond on it (BRAND.md §3). |
| **Moments** | The same shapes in every game: the lobby, "your turn", the round summary (what happened, points, totals, Continue with its countdown), game over (who lost or won, Play again), paused (who we're waiting for, the owner's choices). The game supplies what goes inside. |
| **Words** | Brand voice (BRAND.md §7). English, French and Arabic from day one, every line in a catalog. No gambling language, ever. |
| **Layout rules** | Phones first-class (390 px wide), right to left in Arabic (the page flips, the playing surface doesn't), readable contrast, visible focus, calmer motion when the player asks for reduced motion. |

## 2. The room: what each game makes its own

| | What the game decides |
|---|---|
| **Playing surface** | What the table is made of: felt for card games, wood or a café tabletop for dominoes, a painted board for the goose game, a night village for Loup garou. It always sits in the house's frame: rounded, with the brass rim, on the night room. |
| **Pieces** | Its cards' faces, tiles, dice, tokens, and how they move. |
| **One accent** | One of the brand's colours as its own (Trix: felt green; others: sky, lamp, red, brass). Used for its surface and small touches, never for the shared controls. A colour outside the brand needs Seif's OK through the brand's change process (BRAND.md §9). |
| **Its icons** | Pictures for its own ideas (Trix's contracts), drawn to sit with the brand: simple shapes, the brand's colours, on an ivory tile. |
| **Sound** | Its own sounds and music, when the sound system comes (TODO, phase 2). |

**A game never has** its own logo or wordmark, its own typefaces, its own button styles, colours outside the brand, or a different way of showing players.

## 3. Keeping it that way
- The kit (`platform/ui`) provides the shared pieces; a new game builds its table from them. `docs/adding-a-game.md` gets a "Look" step pointing here.
- **A test** reads every game's styles and fails on a hex colour, an `rgb()` other than black shadows, or a `font-family`, so a game can't drift quietly.
- Every visual change is checked with screenshots at desktop and phone size, in all three languages, before it reaches Seif.

## 4. Applying it to Trix
The Trix table was built before the brand and still shows it: the system font, its own greens and gold, square paper panels, and Aisleriot's card backs (the GNOME foot). The re-dress changes how it looks only. The layout, the gameplay and the rules stay exactly as they are.

1. **The kit in the brand's style:** buttons, chips, toasts, overlays, panels, the invite link and "Leave" switch to the tokens and the two fonts. This alone changes most of the table.
2. **The felt:** the brand's felt with the brass rim and a lamp-lit centre, the same table as on the home page.
3. **The side panel:** a night panel with Dineri's name and the language menu on top, then the leaderboard and "what's happening".
4. **The moments:** choose-a-contract, round summary, game over, paused and last-trick panels become ivory cards; their text stays the same.
5. **Seats and "your turn":** the shared seat look; bots show their level in pips.
6. **Card backs:** Dineri's back instead of Aisleriot's.
7. **Checks:** every existing test, the browser flows, full games at phone and desktop size, and before/after screenshots in English, French and Arabic.

## 5. Seif's answers (2026-09-25)
1. **Contract icons:** keep Seif's own hand-drawn tiles from the 2023 game, as drawn, set on an ivory tile in the new style. Only their grey canvas goes; every stroke stays.
2. **Card faces:** keep GNOME Aisleriot's faces for now (GPL-3.0-or-later), credited on the site's About page as well as the README; Dineri's own card faces go on the TODO as a later design task. The backs become Dineri's now.
3. **Accents:** Trix's is felt green; the other games' are chosen from the brand's colours as each game arrives.

## Notes
- **Tints:** a brand colour mixed with ivory, night or transparency (for example a lighter green for "good" on the night panel, where the felt green itself is too dark to read) counts as the brand's colour. No new hues.
