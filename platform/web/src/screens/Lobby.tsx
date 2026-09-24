import { useState } from "react";
import { InviteLink, LeaveButton, type Connection, type GameUI } from "@platform/ui";

/** Before the game: seats fill up; the game starts on its own with the last one (R-TABLE-3). */
export function Lobby({ conn, game }: { conn: Connection; game: GameUI | null }) {
  const room = conn.room!;
  const isOwner = room.you === room.owner;
  const full = room.seats.every((s) => s.kind !== "empty");
  const levels = game?.levels ?? [];
  // The middle level by default (for Trix: medium, the stand-in level).
  const [level, setLevel] = useState(levels[Math.floor((levels.length - 1) / 2)]?.id ?? "");

  return (
    <main className="lobby">
      <h1>{game?.name ?? "Game"} table</h1>
      <p className="tagline">The game starts as soon as all {room.seats.length} seats are taken.</p>
      {room.invitePath && (
        <section>
          <h2>Invite your friends</h2>
          <InviteLink path={room.invitePath} />
        </section>
      )}
      {isOwner && !full && levels.length > 0 && (
        <section className="bot-level">
          <h2>Bots you add play at</h2>
          <div className="levels" role="radiogroup" aria-label="Bot level">
            {levels.map((l) => (
              <button key={l.id} role="radio" aria-checked={l.id === level} className={l.id === level ? "chosen" : "secondary"} onClick={() => setLevel(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="lobby-seats">
        {room.seats.map((seat, s) => {
          return (
            <div key={s} className={`lobby-seat ${seat.kind}`}>
              <span className="seat-no">Seat {s + 1}</span>
              <strong>{seat.name ?? "Empty"}</strong>
              <span className="muted">
                {s === room.you ? "you" : ""}
                {s === room.owner ? (s === room.you ? " · owner" : "owner") : ""}
                {seat.kind === "bot" ? "bot" : ""}
                {seat.kind === "human" && !seat.connected ? " · away" : ""}
              </span>
              {isOwner && seat.kind === "empty" && <button onClick={() => conn.send({ type: "addBot", seat: s, ...(level ? { level } : {}) })}>Add a bot</button>}
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
      </section>
      {isOwner && full && <button onClick={() => conn.send({ type: "startGame" })}>Start the game</button>}
      {!isOwner && <p className="muted">Waiting for the table owner to fill the seats.</p>}
      <LeaveButton onLeave={() => conn.send({ type: "leave" })} />
      {conn.error && <p className="error">{conn.error.message}</p>}
    </main>
  );
}
