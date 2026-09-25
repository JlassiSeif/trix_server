import { useState } from "react";
import { InviteLink, LeaveButton, type Connection, type GameUI } from "@platform/ui";
import { Pips, TopBar } from "../brand";

/** Before the game: seats fill up; the game starts on its own with the last one (R-TABLE-3). */
export function Lobby({ conn, game }: { conn: Connection; game: GameUI | null }) {
  const room = conn.room!;
  const isOwner = room.you === room.owner;
  const full = room.seats.every((s) => s.kind !== "empty");
  const empty = room.seats.filter((s) => s.kind === "empty").length;
  const levels = game?.levels ?? [];
  // The middle level by default (for Trix: medium, the stand-in level).
  const [level, setLevel] = useState(levels[Math.floor((levels.length - 1) / 2)]?.id ?? "");

  return (
    <div className="hub lobby">
      <TopBar />
      <main className="lobby-main">
        <header className="lobby-head">
          <p className="eyebrow">{game?.name ?? "Game"} table</p>
          <h1>{full ? "Everyone's here" : `Waiting for ${empty} more`}</h1>
          <p className="lede">The game starts as soon as all {room.seats.length} seats are taken.</p>
        </header>

        {room.invitePath && (
          <section className="invite-panel">
            <h2>Invite your friends</h2>
            <p className="hint">Send them this link. Anyone with it can take a free seat.</p>
            <InviteLink path={room.invitePath} />
          </section>
        )}

        <section className="felt lobby-felt" aria-label="Seats">
          {isOwner && !full && levels.length > 0 && (
            <div className="bot-level">
              <h2>Bots you add play at</h2>
              <div className="levels" role="radiogroup" aria-label="Bot level">
                {levels.map((l, i) => (
                  <button key={l.id} role="radio" aria-checked={l.id === level} className={l.id === level ? "chosen" : "secondary"} onClick={() => setLevel(l.id)}>
                    <Pips n={i + 1} /> {l.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="lobby-seats">
            {room.seats.map((seat, s) => {
              const you = s === room.you;
              const tags = [you && "you", s === room.owner && "owner", seat.kind === "bot" && "bot", seat.kind === "human" && !seat.connected && "away"].filter(Boolean);
              return (
                <div key={s} className={`lobby-seat ${seat.kind} ${you ? "you" : ""}`}>
                  <span className="seat-no">Seat {s + 1}</span>
                  <strong>{seat.name ?? "Empty"}</strong>
                  <span className="seat-tags">{tags.join(" · ") || " "}</span>
                  {isOwner && seat.kind === "empty" && (
                    <button className="add-bot" onClick={() => conn.send({ type: "addBot", seat: s, ...(level ? { level } : {}) })}>
                      Add a bot
                    </button>
                  )}
                  {isOwner && seat.kind === "human" && seat.connected && s !== room.you && (
                    <button className="secondary" onClick={() => conn.send({ type: "makeOwner", seat: s })}>
                      Make owner
                    </button>
                  )}
                  {isOwner && seat.kind !== "empty" && s !== room.you && (
                    <button className="secondary" onClick={() => conn.send({ type: "kick", seat: s })}>
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {isOwner && full && (
          <button className="primary" onClick={() => conn.send({ type: "startGame" })}>
            Start the game
          </button>
        )}
        {!isOwner && <p className="hint">Waiting for the table owner to fill the seats.</p>}
        <LeaveButton onLeave={() => conn.send({ type: "leave" })} />
        {conn.error && <p className="error">{conn.error.message}</p>}
      </main>
    </div>
  );
}
