// How a player looks at any game's table (docs/game-look.md §1, "Players"): name, you, the owner's
// crown, a bot's level in pips, away, a bot playing for them, and a brass glow on their turn.
// A game adds its own facts (points, tricks…) as `meta`.

import type { ReactNode } from "react";
import { Pips } from "./bits";
import { texts, useText } from "./i18n";

const T = texts({
  en: { you: " (you)", owner: "Table owner", botPlaying: "bot playing", away: "away", bot: (level: string) => `${level} bot` },
  fr: { you: " (vous)", owner: "Hôte de la table", botPlaying: "un bot joue", away: "absent", bot: (level: string) => `bot ${level.toLowerCase()}` },
  ar: { you: " (أنت)", owner: "صاحب الطاولة", botPlaying: "روبوت يلعب", away: "غائب", bot: (level: string) => `روبوت ${level}` },
});

export interface SeatTagProps {
  name: string;
  you?: boolean;
  owner?: boolean;
  /** A bot: its level's place among the game's levels (1 = easiest) and its name. */
  bot?: { pips: number; label: string } | null;
  away?: boolean;
  botPlaying?: boolean;
  turn?: boolean;
  /** The game's own facts about this seat. */
  meta?: ReactNode;
  dir?: "ltr" | "rtl";
}

export function SeatTag({ name, you, owner, bot, away, botPlaying, turn, meta, dir }: SeatTagProps) {
  const t = useText(T);
  return (
    <div className={`seat-tag ${turn ? "turn" : ""} ${you ? "you" : ""}`} dir={dir}>
      <span className="seat-name">
        {owner && (
          <span className="owner-crown" title={t.owner}>
            ♛{" "}
          </span>
        )}
        {name}
        {you && <span className="seat-you">{t.you}</span>}
      </span>
      <span className="seat-meta">
        {meta}
        {bot && (
          <span className="chip bot" title={t.bot(bot.label)}>
            <Pips n={bot.pips} />
          </span>
        )}
        {botPlaying && <span className="chip warn">{t.botPlaying}</span>}
        {away && <span className="chip warn">{t.away}</span>}
      </span>
    </div>
  );
}
