# Trix: TODO

Trix's own list. The platform's list, and the index of all games, is the root [TODO.md](../../TODO.md). We reconcile both with the disk at the start of every session. Sources of truth: the disk, Seif, and these files.

## Open
1. **Personas** (`docs/personas.md`, draft): Jeddi (sweet grandpa), Je7ch (the donkey), Chmeyti (playful opportunist), Waben (funny asshole), with chat bubbles. Waiting for Seif's approval, and for the lines from Seif and friends (`docs/persona-lines.csv`).
2. **Sounds and music** (`docs/sounds.md`): the Trix moments (K♥, sweeps, exactly 1000…). Seif provides the audio. The settings panel and sound system are the platform's (root TODO).
3. **To confirm (not blocking).** Claude's design calls, in use since v0.5, which Seif played. RULES.md still marks them "Seif to confirm":
   - R-TABLE-10: the owner adds bots in the lobby, and a friend who joins later takes over a bot's seat.
   - R-TABLE-11: a score summary after each contract; the next deal starts when everyone clicks Continue, or after 10 s.
   - R-TRICK-6: a look at the last trick is allowed at any moment (not only on your turn) and shows who played each card.
   - Table layout: click to play (no drag); you at the bottom with the next player on your right (counter-clockwise); the finished trick shown for 1.8 s with the winner highlighted; contract announcements as a banner; the event feed; the leaderboard.
4. **`docs/client-baseline.md`:** Seif was going to mark the behaviour he wants from the old client. v0.5 has since replaced it as the working spec. Seif decides whether to drop this item.
5. **Later: our own card designs.** The cards are GNOME Aisleriot's "bonded" theme (GPL-3.0-or-later; the notice is in the README) and stay until we have our own.
6. **Seif plays a game at each bot level** and says whether it feels right (`docs/bots.md` §9, the last acceptance step).

## Done
The history by version is in [CHANGELOG.md](CHANGELOG.md).
- **Dineri's house style (2026-09-25, not deployed):** the table re-dressed to `docs/game-look.md` (look only). Checked with full games at desktop and phone size, and the Arabic table.
- **Three languages (2026-09-25, not deployed):** the table speaks English, French and Arabic (R-TABLE-9): every line in `ui/src/text.ts`, bots named in your language, numbers kept readable right to left, and the table's layout the same in every language. French and Arabic wording waits for Seif's review (root TODO).
- **Rules:** `RULES.md` approved by Seif on 2026-09-23; every rule has an ID and tests cite them. R-GAME-11 (trix due by the 6th pick) added 2026-09-24.
- **Engine:** a pure, seeded state machine, with the golden dineri round from the old code and a fuzz run of random games. Every bug found in the old code is covered by a test.
- **Bots:** easy, medium and hard (`docs/bots.md`, approved), deciding only from what a player in their seat could know. Arena results in `docs/bots-arena.md`.
- **Table:** invite links, reconnecting, pauses, kick and leave, ownership, score summary, game over, play again; a ranked leaderboard; the phone layout.
- **Testing:** the station (`station/`, 21 play scenarios, 10 attack scenarios, referee, mutation check), the arena (`station/src/arena.ts`), browser flows (`platform/web/e2e`).
- **In the hub (2026-09-24):** Trix moved into `games/trix`, behind the game contract; nothing changed for players.

## Lessons from the old code (2023)
The engine gets these right, each covered by a test: won piles reset every deal; an early ending closes the trick cleanly; the server owns every hand and checks every move; a disconnect never crashes anything; the `trix` contract exists; contract names have one definition; scores reach the players; the server tracks which contracts are used.
