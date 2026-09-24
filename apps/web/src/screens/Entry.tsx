import { useState, type FormEvent } from "react";
import type { BotLevel } from "@trix/engine";
import { NAME_MAX } from "@trix/protocol";
import type { Connection } from "../net";
import { savedName } from "../net";

/** Home: create a table. Invite link: take a seat. Both only ask for a name (R-TABLE-1). */
export function Entry({ conn, roomId, invite }: { conn: Connection; roomId: string | null; invite: string | null }) {
  const [name, setName] = useState(savedName.get());
  const [busy, setBusy] = useState(false);
  const joining = roomId !== null;

  /** Create a table (with `bots`: against three bots of that level, R-TABLE-13), or take a seat. */
  const go = (bots?: BotLevel) => {
    const clean = name.trim();
    if (!clean) return;
    savedName.set(clean);
    setBusy(true);
    if (joining) conn.join({ type: "joinRoom", roomId, invite: invite ?? undefined, name: clean });
    else conn.join({ type: "createRoom", name: clean, ...(bots ? { bots } : {}) });
    setTimeout(() => setBusy(false), 1500);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go();
  };
  const canGo = !!name.trim() && !busy && conn.online;

  return (
    <main className="entry">
      <h1>Trix</h1>
      <p className="tagline">{joining ? "You've been invited to a table." : "Seven contracts, four players, and the lowest score wins."}</p>
      {conn.removed && <p className="notice">{removedText[conn.removed]}</p>}
      {conn.lost && !conn.removed && <p className="notice">That table doesn't exist any more. Create a new one below, or ask for a new link.</p>}
      {joining && !invite && <p className="notice">This link has no invite code. Ask the table owner for the full link.</p>}
      <form onSubmit={submit}>
        <label htmlFor="name">Your name</label>
        <input id="name" autoFocus maxLength={NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. lam3i" />
        <button type="submit" disabled={!canGo}>
          {joining ? "Take a seat" : "Create a table"}
        </button>
        {!joining && <p className="muted small hint">…and send the link to three friends.</p>}
      </form>
      {!joining && (
        <section className="solo">
          <h2>Or play alone against bots</h2>
          <div className="solo-levels">
            {LEVELS.map(([level, label, what]) => (
              <button key={level} className={`solo-level ${level}`} disabled={!canGo} onClick={() => go(level)}>
                <strong>{label}</strong>
                <span className="small">{what}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {conn.error && !(conn.lost && (conn.error.code === "ROOM_NOT_FOUND" || conn.error.code === "BAD_TOKEN")) && <p className="error">{conn.error.message}</p>}
      {!conn.online && <p className="muted">Connecting to the server…</p>}
      {joining && (
        <p className="muted">
          <a href="/">Or create your own table</a>
        </p>
      )}
    </main>
  );
}

/** docs/bots.md §2: how each level feels. */
const LEVELS: [BotLevel, string, string][] = [
  ["easy", "Easy", "a beginner who knows the rules"],
  ["medium", "Medium", "a decent club player"],
  ["hard", "Hard", "a strong, patient player"],
];

const removedText = {
  kicked: "The table owner removed you from the table.",
  left: "You left the table.",
  roomClosed: "That table was closed.",
};
