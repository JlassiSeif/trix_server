import { useState } from "react";
import { GameBadge, InviteLink, LeaveButton, seatName, useErrorText, useLang, useText, type Connection, type GameUI } from "@platform/ui";
import { Pips, TopBar } from "../brand";
import { T } from "../text";

/** Before the game: seats fill up; the game starts on its own with the last one (R-TABLE-3). */
export function Lobby({ conn, game }: { conn: Connection; game: GameUI | null }) {
  const t = useText(T);
  const lang = useLang();
  const errorText = useErrorText();
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
          <p className="eyebrow with-badge">
            {game && <GameBadge Icon={game.icon} size={30} />}
            {t.lobby.table(game?.name ?? "")}
          </p>
          <h1>{full ? t.lobby.full : t.lobby.waiting(empty)}</h1>
          <p className="lede">{t.lobby.startsWhen(room.seats.length)}</p>
        </header>

        {room.invitePath && (
          <section className="invite-panel">
            <h2>{t.lobby.invite}</h2>
            <p className="hint">{t.lobby.inviteHint}</p>
            <InviteLink path={room.invitePath} />
          </section>
        )}

        <section className="felt lobby-felt" aria-label="Seats">
          {isOwner && !full && levels.length > 0 && (
            <div className="bot-level">
              <h2>{t.lobby.botsAt}</h2>
              <div className="levels" role="radiogroup" aria-label={t.lobby.botLevel}>
                {levels.map((l, i) => (
                  <button key={l.id} role="radio" aria-checked={l.id === level} className={l.id === level ? "chosen" : "secondary"} onClick={() => setLevel(l.id)}>
                    <Pips n={i + 1} /> {l.label[lang]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="lobby-seats">
            {room.seats.map((seat, s) => {
              const you = s === room.you;
              const tags = [you && t.lobby.you, s === room.owner && t.lobby.owner, seat.kind === "bot" && t.lobby.bot, seat.kind === "human" && !seat.connected && t.lobby.away].filter(Boolean);
              return (
                <div key={s} className={`lobby-seat ${seat.kind} ${you ? "you" : ""}`}>
                  <span className="seat-no">{t.lobby.seat(s + 1)}</span>
                  <strong>{seatName(seat, lang, levels) ?? t.lobby.empty}</strong>
                  <span className="seat-tags">
                    {seat.kind === "bot" && levels.some((l) => l.id === seat.level) && <Pips n={levels.findIndex((l) => l.id === seat.level) + 1} />} {tags.join(" · ") || " "}
                  </span>
                  {isOwner && seat.kind === "empty" && (
                    <button className="add-bot" onClick={() => conn.send({ type: "addBot", seat: s, ...(level ? { level } : {}) })}>
                      {t.lobby.addBot}
                    </button>
                  )}
                  {isOwner && seat.kind === "human" && seat.connected && s !== room.you && (
                    <button className="secondary" onClick={() => conn.send({ type: "makeOwner", seat: s })}>
                      {t.lobby.makeOwner}
                    </button>
                  )}
                  {isOwner && seat.kind !== "empty" && s !== room.you && (
                    <button className="secondary" onClick={() => conn.send({ type: "kick", seat: s })}>
                      {t.lobby.remove}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {isOwner && full && (
          <button className="primary" onClick={() => conn.send({ type: "startGame" })}>
            {t.lobby.start}
          </button>
        )}
        {!isOwner && <p className="hint">{t.lobby.waitOwner}</p>}
        <LeaveButton onLeave={() => conn.send({ type: "leave" })} />
        {conn.error && <p className="error">{errorText(conn.error)}</p>}
      </main>
    </div>
  );
}
