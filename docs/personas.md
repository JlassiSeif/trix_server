# Bot personas (spec)

**Status: DRAFT for Seif to edit and approve** (2026-09-24). Built on the approved bot spec (`docs/bots.md`): a persona is a bot with a **character**. Its brain is one of the three levels, tuned in style, and it has a **voice**: chat bubbles, and optionally a sound. The plain Easy, Medium and Hard bots stay as they are, silent, for people who want a quiet game.

The personas are Tunisian characters, so their names stay in Derja. The descriptions below are Seif's.

## The four personas

| Persona | Who they are | Brain | How they play | How they talk |
|---|---|---|---|---|
| **Jeddi** (name to confirm) | Your sweet grandpa. | Hard | Patient and safe. Declares the K♥ only when he's sure, never tries a sweep, doesn't gang up on anyone. | Warm and kind. Encourages you, forgives your mistakes, proverbs, "in my day…". |
| **Je7ch** | The donkey. | Easy, with more blunders (1 move in 3 random) | Picks bad contracts, sometimes declares the K♥ for no reason, plays whatever. | Confused and proud of it. Celebrates the wrong things, doesn't understand what happened. |
| **Chmeyti** | Takes advantage of everyone, playfully. | Hard | Opportunist: loves dumping points on whoever is weakest right now, feeds the player about to go over 1000, never misses a chance. | Gloats, laughs at your misfortune, "I told you so", fake sympathy. |
| **Waben** | An asshole, but a funny one. | Medium, playing risky | Gambler: declares the K♥ often, goes for the sweep in general, takes big risks. | Trash talk and roasts. The 18+ lines are mostly his. |

Level and style both change how a bot plays, so each persona gets measured in the arena, as the levels were. Target: Jeddi and Chmeyti beat medium, Waben is about even with medium, and Je7ch loses to easy.

## When they talk (the moments)

A persona speaks at **moments** of the game. Each moment has lines per persona, in two ratings: **clean** (always allowed) and **18+** (only when the viewer turned on 18+ mode). With 18+ on, both sets are used.

| Moment | When | What it's for |
|---|---|---|
| `hello` | The game starts | Greeting, sets the character |
| `pick` | The persona picks a contract | Flavour: confident, scared, scheming |
| `declare` | The persona declares the K♥ | Bluff and bravado |
| `setup` | It plays a trap: leads a low heart to flush the K♥, throws a queen or the K♥ onto someone else's trick | "Trying to trick you" |
| `dumped_on_you` | You take points because of its card | Gloating (Chmeyti, Waben), apologising (Jeddi) |
| `took_points` | It takes the K♥ or a big pile of points itself | Self-pity, anger, denial |
| `you_took_king` | You take the K♥ | Mockery or sympathy, by character |
| `sweep` | Anyone takes all 8 tricks in general | Awe (or envy) |
| `trix_out` | It goes out first in trix | Brag |
| `near_1000` | Someone passes 900 | Warning, teasing |
| `reset_1000` | Someone lands on exactly 1000 and goes back to 0 | Disbelief |
| `game_won` | It wins the game | Victory speech |
| `game_lost` | It loses the game | Excuses, tantrum, grace (Jeddi) |
| `hurry_up` | You take more than 20 seconds | Impatience |
| `banter` | Right after another persona talks | Personas answering each other (Waben roasting Je7ch, Jeddi calming everyone down) |

**Not too chatty:** each moment has a chance to trigger, not a certainty, and a persona waits at least 15 seconds between bubbles unless the moment is big (a sweep, the K♥, the end of the game). A bubble stays for about 3.5 seconds next to the persona's seat.

**Everyone at the table sees the same moment.** Each player's own settings then choose the line (clean, or clean plus 18+) and whether a sound plays.

## Where personas appear
- **Play against bots:** under the three levels, a row of characters. Pick three, or "surprise me".
- **Lobby:** "Add a bot" offers the levels and the characters.
- **At the table:** the persona's name and avatar on its seat; chat bubbles next to it.

## Decisions for Seif
1. The four personas: names (is "Jeddi" right for the grandpa?), and whether you want more (the earlier ideas "risky" and "cunning" are covered by Waben and Chmeyti).
2. Each persona's brain and style in the table above.
3. The moments list: anything missing, anything that shouldn't talk?
4. The language of the lines: Derja in Latin script ("3aychek", "ya m3allem") or Arabic script, or a mix.
5. Who writes the lines. They only work if they're written by Tunisians, so you and your friends; the sheet is `docs/persona-lines.csv`.
