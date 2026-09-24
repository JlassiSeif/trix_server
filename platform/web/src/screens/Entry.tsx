import { useState, type FormEvent } from "react";
import { NAME_MAX } from "@platform/protocol";
import { savedName, type Connection, type GameUI } from "@platform/ui";
import { Notices } from "./Notices";

/**
 * A game's page (/<game>): create a table for friends, or play against bots (R-TABLE-13).
 * An invite link (/r/<room>): take a seat. Both only ask for a name (R-TABLE-1).
 */
export function Entry({ conn, game, roomId, invite, go }: { conn: Connection; game: GameUI | null; roomId: string | null; invite: string | null; go: (path: string) => void }) {
  const [name, setName] = useState(savedName.get());
  const [busy, setBusy] = useState(false);
  const joining = roomId !== null;

  /** Create a table (with `bots`: against bots of that level), or take a seat. */
  const start = (bots?: string) => {
    const clean = name.trim();
    if (!clean) return;
    savedName.set(clean);
    setBusy(true);
    if (joining) conn.join({ type: "joinRoom", roomId, invite: invite ?? undefined, name: clean });
    else if (game) conn.join({ type: "createRoom", name: clean, game: game.id, ...(bots ? { bots } : {}) });
    setTimeout(() => setBusy(false), 1500);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    start();
  };
  const canGo = !!name.trim() && !busy && conn.online;

  return (
    <main className="entry">
      <nav className="crumbs">
        <a href="/" onClick={(e) => (e.preventDefault(), go("/"))}>
          ← All games
        </a>
      </nav>
      <h1>{joining ? "Join a table" : game?.name}</h1>
      <p className="tagline">{joining ? "You've been invited to a table." : game?.tagline}</p>
      <Notices conn={conn} />
      {joining && !invite && <p className="notice">This link has no invite code. Ask the table owner for the full link.</p>}
      <form onSubmit={submit}>
        <label htmlFor="name">Your name</label>
        <input id="name" autoFocus maxLength={NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. lam3i" />
        <button type="submit" disabled={!canGo}>
          {joining ? "Take a seat" : "Create a table"}
        </button>
        {!joining && <p className="muted small hint">…and send the link to your friends.</p>}
      </form>
      {!joining && game && game.levels.length > 0 && (
        <section className="solo">
          <h2>Or play alone against bots</h2>
          <div className="solo-levels">
            {game.levels.map((l) => (
              <button key={l.id} className={`solo-level ${l.id}`} disabled={!canGo} onClick={() => start(l.id)}>
                <strong>{l.label}</strong>
                <span className="small">{l.what}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {conn.error && !(conn.lost && (conn.error.code === "ROOM_NOT_FOUND" || conn.error.code === "BAD_TOKEN")) && <p className="error">{conn.error.message}</p>}
      {!conn.online && <p className="muted">Connecting to the server…</p>}
    </main>
  );
}
