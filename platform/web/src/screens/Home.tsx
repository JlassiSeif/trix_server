import { useEffect, useState } from "react";
import type { GameListing } from "@platform/protocol";
import { useLang, useText, type Connection, type GameUI } from "@platform/ui";
import { Fan, FaceDown, Footer, TopBar } from "../brand";
import { COMING_SOON, GAMES } from "../games";
import { T } from "../text";
import { Notices } from "./Notices";

/** The hub: the games lie on a café table. The ones you can play are face up (docs/architecture.md §10). */
export function Home({ conn, go }: { conn: Connection; go: (path: string) => void }) {
  // Which games are open right now (a game can be switched off for a moment, §12).
  const t = useText(T);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    fetch("/api/games")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: GameListing[]) => setOpen(Object.fromEntries(list.map((g) => [g.id, g.open]))))
      .catch(() => undefined);
  }, []);

  return (
    <div className="hub home">
      <TopBar go={go} />
      <main className="home-main">
        <section className="hero">
          <p className="eyebrow">{t.home.eyebrow}</p>
          <h1>{t.home.title}</h1>
          <p className="lede">{t.home.lede}</p>
        </section>
        <Notices conn={conn} />
        <section className="felt" aria-label={t.home.gamesAria}>
          <div className="face-up">
            {GAMES.map((g) => (
              <GameCard key={g.id} game={g} closed={open[g.id] === false} go={go} />
            ))}
          </div>
          <div className="face-downs">
            <p className="felt-label">{t.home.comingLabel}</p>
            <div className="face-down-grid">
              {COMING_SOON.map((g) => (
                <FaceDown key={g.id} name={g.name} Icon={g.Icon} />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer go={go} />
    </div>
  );
}

/** A game you can play: a face-up card with its name, its cover, and a way in. */
function GameCard({ game, closed, go }: { game: GameUI; closed: boolean; go: (path: string) => void }) {
  const t = useText(T);
  const lang = useLang();
  return (
    <a
      className={`game-card ${closed ? "closed" : ""}`}
      href={`/${game.id}`}
      aria-disabled={closed}
      onClick={(e) => {
        e.preventDefault();
        if (!closed) go(`/${game.id}`);
      }}
    >
      <span className="corner top" aria-hidden>
        {game.initial ?? game.name[0]}
        <b>♦</b>
      </span>
      <span className="corner bottom" aria-hidden>
        {game.initial ?? game.name[0]}
        <b>♦</b>
      </span>
      <Fan game={game} />
      <strong className="game-card-name">{game.name}</strong>
      <span className="game-card-tagline">{game.tagline[lang]}</span>
      <span className="game-card-meta">
        {game.players[lang]} · {t.home.bots}
      </span>
      <span className="game-card-play">{closed ? t.home.closed : t.home.play(game.name)}</span>
    </a>
  );
}
