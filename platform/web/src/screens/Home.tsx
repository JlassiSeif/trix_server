import { useEffect, useState } from "react";
import type { GameListing } from "@platform/protocol";
import type { Connection } from "@platform/ui";
import { COMING_SOON, GAMES } from "../games";
import { Notices } from "./Notices";

/** The hub: pick a game (docs/architecture.md §10). */
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
    <main className="home">
      <header>
        <h1>Tunisian games</h1>
        <p className="tagline">Card and table games to play with your friends, or against bots.</p>
      </header>
      <Notices conn={conn} />
      <section className="games" aria-label="Games">
        {GAMES.map((g) => {
          const closed = open[g.id] === false;
          return (
            <a
              key={g.id}
              className={`game-tile ${closed ? "closed" : ""}`}
              href={`/${g.id}`}
              aria-disabled={closed}
              onClick={(e) => {
                e.preventDefault();
                if (!closed) go(`/${g.id}`);
              }}
            >
              <strong>{g.name}</strong>
              <span>{g.tagline}</span>
              <span className="small muted-light">{closed ? "Back in a moment" : g.players}</span>
            </a>
          );
        })}
        {COMING_SOON.map((name) => (
          <div key={name} className="game-tile soon" aria-disabled>
            <strong>{name}</strong>
            <span className="small muted-light">Coming soon</span>
          </div>
        ))}
      </section>
    </main>
  );
}
