import { SEATS, type Seat } from "@trix/engine";
import type { Connection } from "../net";
import { InviteLink } from "../components/bits";

/** Before the game: seats fill up; the game starts on its own with the 4th (R-TABLE-3). */
export function Lobby({ conn }: { conn: Connection }) {
  const room = conn.room!;
  const isOwner = room.you === room.owner;
  const full = room.seats.every((s) => s.kind !== "empty");

  return (
    <main className="lobby">
      <h1>Trix table</h1>
      <p className="tagline">The game starts as soon as all 4 seats are taken.</p>
      {room.invitePath && (
        <section>
          <h2>Invite your friends</h2>
          <InviteLink path={room.invitePath} />
        </section>
      )}
      <section className="lobby-seats">
        {SEATS.map((s: Seat) => {
          const seat = room.seats[s]!;
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
              {isOwner && seat.kind === "empty" && <button onClick={() => conn.send({ type: "addBot", seat: s })}>Add a bot</button>}
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
      <button className="link" onClick={() => conn.send({ type: "leave" })}>
        Leave the table
      </button>
      {conn.error && <p className="error">{conn.error.message}</p>}
    </main>
  );
}
