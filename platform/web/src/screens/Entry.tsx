import { useState, type FormEvent } from "react";
import { NAME_MAX } from "@platform/protocol";
import { savedName, useErrorText, useLang, useText, type Connection, type GameUI } from "@platform/ui";
import { useAccount } from "../account";
import { Fan, Footer, Pips, TopBar } from "../brand";
import { T } from "../text";
import { Notices } from "./Notices";

/**
 * A game's page (/<game>): create a table for friends, or play against bots (R-TABLE-13).
 * An invite link (/r/<room>): take a seat. Both only ask for a name (R-TABLE-1).
 */
export function Entry({ conn, game, roomId, invite, go }: { conn: Connection; game: GameUI | null; roomId: string | null; invite: string | null; go: (path: string) => void }) {
  const t = useText(T);
  const lang = useLang();
  const errorText = useErrorText();
  const acc = useAccount();
  // Signed in: your account's name, unless you've typed one here.
  const [typed, setTyped] = useState<string | null>(null);
  const name = typed ?? acc.profile?.displayName ?? savedName.get();
  const setName = setTyped;
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
    <div className="hub entry">
      <TopBar go={go} back />
      <main className="game-page">
        <section className="game-intro">
          {game && <Fan game={game} size="lg" />}
          <p className="eyebrow">{joining ? t.entry.invited : game?.players[lang]}</p>
          <h1>{joining ? t.entry.joinTitle : game?.name}</h1>
          <p className="lede">{joining ? t.entry.joinLede : game?.tagline[lang]}</p>
        </section>

        <section className="play-panel">
          <Notices conn={conn} />
          {joining && !invite && <p className="notice">{t.entry.noInvite}</p>}
          <form onSubmit={submit}>
            <label htmlFor="name">{t.entry.name}</label>
            <input id="name" autoFocus maxLength={NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.entry.namePlaceholder} autoComplete="nickname" />
            <button type="submit" className="primary" disabled={!canGo}>
              {joining ? t.entry.takeSeat : t.entry.create}
            </button>
            {!joining && <p className="hint">{t.entry.createHint}</p>}
          </form>
          {!joining && game && game.levels.length > 0 && (
            <section className="solo">
              <h2 className="divider">
                <span>{t.entry.orBots}</span>
              </h2>
              <div className="solo-levels">
                {game.levels.map((l, i) => (
                  <button key={l.id} className={`solo-level ${l.id}`} disabled={!canGo} onClick={() => start(l.id)}>
                    <Pips n={i + 1} />
                    <strong>{l.label[lang]}</strong>
                    <span className="what">{l.what[lang]}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {conn.error && !(conn.lost && (conn.error.code === "ROOM_NOT_FOUND" || conn.error.code === "BAD_TOKEN")) && <p className="error">{errorText(conn.error)}</p>}
          {!conn.online && <p className="hint">{t.entry.connecting}</p>}
        </section>
      </main>
      <Footer go={go} />
    </div>
  );
}
