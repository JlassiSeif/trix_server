import type { GameUI } from "@platform/ui";

/** Dineri: the hub's name (Seif, 2026-09-25), with a diamond (the dineri) as its mark. */
export function Wordmark() {
  return (
    <span className="wordmark">
      Dineri
      <span className="wordmark-mark" aria-hidden>
        ♦
      </span>
    </span>
  );
}

/** The bar on every hub page. The name links home, unless we're seated at a table. */
export function TopBar({ go, back = false }: { go?: (path: string) => void; back?: boolean }) {
  const home = (e: React.MouseEvent) => {
    e.preventDefault();
    go?.("/");
  };
  return (
    <header className="topbar">
      {go ? (
        <a href="/" className="brand" onClick={home} aria-label="Dineri, all games">
          <Wordmark />
        </a>
      ) : (
        <span className="brand">
          <Wordmark />
        </span>
      )}
      {back && go && (
        <a href="/" className="back" onClick={home}>
          All games
        </a>
      )}
    </header>
  );
}

/** Difficulty as diamonds: easy ♦, medium ♦♦, hard ♦♦♦. */
export function Pips({ n }: { n: number }) {
  return (
    <span className="pips" aria-hidden>
      {"♦".repeat(n)}
    </span>
  );
}

/** A few of the game's own images, fanned out like a hand of cards. */
export function Fan({ game, size = "md" }: { game: GameUI; size?: "md" | "lg" }) {
  const cover = game.cover ?? [];
  if (!cover.length) return null;
  return (
    <span className={`fan ${size}`} aria-hidden>
      {cover.map((src, i) => (
        <img key={src} src={src} alt="" style={{ "--i": i - (cover.length - 1) / 2 } as React.CSSProperties} draggable={false} />
      ))}
    </span>
  );
}

/** A game not turned over yet: a face-down card with its name beside it. */
export function FaceDown({ name }: { name: string }) {
  return (
    <div className="face-down" role="img" aria-label={`${name}, coming soon`}>
      <span className="card-back" aria-hidden>
        <span className="medallion" />
      </span>
      <span className="face-down-name">{name}</span>
      <span className="face-down-soon">Coming soon</span>
    </div>
  );
}
