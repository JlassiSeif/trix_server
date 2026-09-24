# Sounds, music and settings: what Seif provides

**Status: DRAFT for Seif** (2026-09-24). Seif and his friends provide the audio; Claude builds the sound system and the settings, and converts and levels the files.

## 1. Game sounds (short, neutral, always clean)

They make the table feel alive. Keep them subtle: players hear them hundreds of times a game.

| File name | When | Feeling | Length |
|---|---|---|---|
| `card-play` | Any card is played on a trick | A crisp card snapped on the table | under 0.5 s |
| `card-deal` | A new contract is dealt | Shuffle and deal | 1–2 s |
| `trick-won` | A trick is gathered | Cards swept to the winner | under 1 s |
| `your-turn` | It becomes your turn | A gentle ping, never annoying | under 0.5 s |
| `contract-picked` | A contract is chosen | A stamp, a decision | under 1 s |
| `trix-place` | A card placed on a trix stack | A soft tap | under 0.5 s |
| `countdown` | The last 3 seconds before the next deal | A quiet tick | under 0.3 s |

If you don't have these, free sound packs exist (Kenney's casino pack is public domain). Say the word and I'll use those.

## 2. Meme reactions (the fun part)

Each moment can have a **clean** clip and an **18+** clip. The 18+ one plays only for people who turned on 18+ mode; anyone else hears the clean one, or nothing if there is no clean clip. More than one clip per moment is welcome, and the game picks at random so it stays fresh.

| File name | When | Feeling |
|---|---|---|
| `you-took-the-king` | The K♥ lands in your pile | Tragic and mocking: sad trombone, "ya wiliiii" |
| `king-declared` | Someone declares the K♥ | Suspense, drama |
| `dumped-on` | Someone hands you a queen, the K♥ or a pile of diamonds | Laughing at you |
| `clean-escape` | You dodge the K♥, or lose the last trick in farcha | Relief: "hamdoullah" |
| `sweep` | Someone takes all 8 tricks in general | Epic, triumphant |
| `exact-1000` | Someone lands on exactly 1000 and goes back to 0 | Miracle, disbelief |
| `danger-900` | Someone passes 900 | Tension |
| `trix-first` | You go out first in trix | A quick celebration |
| `ace-extra-turn` | An ace gives an extra turn in trix | Cheeky: "zid!" |
| `big-loss` | You take 100 points or more in one contract | Ouch |
| `game-won` | You win the game | Victory: zgharit would be perfect |
| `game-lost` | You lose, or go over 1000 | Funeral, booing, mockery |
| `hurry-up` | You take more than 20 seconds | "Yallah!" |

Optional **persona stingers**, one short signature clip per persona that plays with some of its bubbles: `jeddi` (a warm chuckle), `je7ch` (a bray), `chmeyti` (a sly giggle), `waben` (a scoff). Clean and 18+ versions welcome.

## 3. Background music

- **How many:** 6 to 8 tracks, about 25–30 minutes in total, so an evening's game doesn't loop too obviously. They play shuffled, one after another. Optionally one short loop for the lobby and the first screen.
- **Rights:** for friends only, anything goes. The day the site is public, and especially if it makes money, every track needs permission from its owner, or royalty-free music. Easiest: tell me which tracks are cleared and which are friends-only.

## 4. File formats (for everything above)

- **Send:** the best quality you have. WAV or FLAC is ideal, MP3 at 256–320 kbps is fine. Any sample rate. Mono is fine for sounds.
- **Name:** the file names above; add `.18` for the 18+ version and a number for alternatives, e.g. `you-took-the-king.mp3`, `you-took-the-king.2.mp3`, `you-took-the-king.18.mp3`. Music: `music-01-title.mp3` …
- **Trim:** no silence at the start (I trim anyway). Sounds under 1 second, memes under 5 seconds.
- **I do the rest:** convert to MP3 at 128 kbps (plays everywhere, iPhone included), level the loudness so nothing blasts, and load sounds only when needed.

## 5. Settings (gear icon on every screen, remembered per browser)

| Setting | Default | Why |
|---|---|---|
| Game sounds | on, low volume | Feedback for your own moves |
| Meme reactions | on (clean) | The fun, but safe |
| Music | **off** | Work, family, public transport; browsers also block music until you tap |
| Bot chat bubbles | on (clean) | |
| **18+ mode** (language and sounds) | **off** | Turning it on asks you to confirm you're 18+ and that people around you won't mind |
| Volume sliders | music and sounds separately | |
| Quick mute | a button on the table | Silences everything at once |

## 6. Bot lines

The sheet is `docs/persona-lines.csv`: one row per line, with columns `persona`, `moment`, `rating` (`clean` or `18`), `line`. Three or more lines per moment keep it from repeating. Open it in Google Sheets or Excel, fill it in, and send it back as CSV.
