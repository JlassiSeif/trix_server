import { useEffect, useState } from "react";
import type { GameListing } from "@platform/protocol";
import type { Connection, GameUI } from "@platform/ui";
import { Fan, FaceDown, TopBar } from "../brand";
import { COMING_SOON, GAMES } from "../games";
import { Notices } from "./Notices";

/** The hub: the games lie on a café table. The ones you can play are face up (docs/architecture.md §10). */
export function Home({ conn, go }: { conn: Connection; go: (path: string) => void }) {
  // Which games are open right now (a game can be switched off for a moment, §12).
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
          <p className="eyebrow">Tunisian card and table games</p>
          <h1>Deal in your friends.</h1>
          <p className="lede">Send them a link and play at the same table, on a phone or a PC. Nobody around? Play against bots.</p>
        </section>
        <Notices conn={conn} />
        <section className="felt" aria-label="Games">
          <div className="face-up">
            {GAMES.map((g) => (
              <GameCard key={g.id} game={g} closed={open[g.id] === false} go={go} />
            ))}
          </div>
          <div className="face-downs">
            <p className="felt-label">Coming to the table</p>
            <div className="face-down-grid">
              {COMING_SOON.map((name) => (
                <FaceDown key={name} name={name} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/** A game you can play: a face-up card with its name, its cover, and a way in. */
function GameCard({ game, closed, go }: { game: GameUI; closed: boolean; go: (path: string) => void }) {
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
      <span className="game-card-tagline">{game.tagline}</span>
      <span className="game-card-meta">
        {game.players} · bots from easy to hard
      </span>
      <span className="game-card-play">{closed ? "Back in a moment" : `Play ${game.name}`}</span>
    </a>
  );
}
