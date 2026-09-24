import { useEffect, useRef, useState } from "react";
import {
  RANKS,
  SEATS,
  SUITS,
  card,
  type CardId,
  type Contract,
  type GameEvent,
  type PlayedCard,
  type PlayerView,
  type Seat,
} from "@trix/engine";
import type { RoomView } from "@trix/protocol";
import type { Connection } from "../net";
import { Card, ContractIcon, InviteLink, LeaveButton, useTick } from "../components/bits";
import { CONTRACT_ORDER, CONTRACT_RULE, cardLabel, describe, multiplierLabel, ordinal } from "../text";

/** Where a seat sits on your screen: you at the bottom, then counter-clockwise (R-SEAT-1). */
const POSITIONS = ["bottom", "right", "top", "left"] as const;
type Position = (typeof POSITIONS)[number];

interface FeedItem {
  id: number;
  text: string;
}
interface ShownTrick {
  cards: PlayedCard[];
  winner: Seat;
}
interface Toast {
  id: number;
  text: string;
  contract?: Contract;
}

const LINGER_MS = 1600;
const SHORT: Record<Contract, string> = { dineri: "DIN", damet: "DAM", pli: "PLI", farcha: "FAR", ray: "RAY", general: "GEN", trix: "TRX" };

export function Table({ conn }: { conn: Connection }) {
  const room = conn.room!;
  const game = conn.game!;
  const me = room.you;
  const pos = (s: Seat): Position => POSITIONS[(s - me + 4) % 4]!;
  const name = (s: Seat) => room.seats[s]?.name ?? `Seat ${s + 1}`;

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [linger, setLinger] = useState<ShownTrick | null>(null);
  const [peek, setPeek] = useState<ShownTrick | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  // Phones and narrow windows: the side panel (leaderboard, feed, leave) is a sheet opened on demand.
  const [sideOpen, setSideOpen] = useState(false);
  const counter = useRef(0);

  // Game events drive the feed, the toasts, and the completed-trick pause.
  // Subscribe once: `conn` is a new object on every render, but `onEvents` is stable. Re-subscribing
  // on every render used to cancel the timers that hide toasts, so they stayed on screen.
  const onEvents = conn.onEvents;
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    const off = onEvents((events: GameEvent[], r: RoomView) => {
      const nameNow = (s: Seat) => r.seats[s]?.name ?? `Seat ${s + 1}`;
      const lines = events.map((e) => describe(e, nameNow, r.you)).filter((t): t is string => t !== null);
      if (lines.length) setFeed((f) => [...f, ...lines.map((text) => ({ id: ++counter.current, text }))].slice(-60));
      for (const e of events) {
        const id = ++counter.current;
        const show = (t: Toast, ms = 2600) => {
          setToast(t);
          later(() => setToast((cur) => (cur?.id === t.id ? null : cur)), ms);
        };
        if (e.type === "dealt" || e.type === "picked") setLinger(null);
        if (e.type === "dealt") setToast(null); // a new deal starts clean
        if (e.type === "trickWon") {
          setLinger({ cards: e.cards, winner: e.seat });
          later(() => setLinger((cur) => (cur?.cards === e.cards ? null : cur)), LINGER_MS);
        } else if (e.type === "picked") {
          const who = e.seat === r.you ? "You" : nameNow(e.seat);
          show({ id, contract: e.contract, text: `${who} chose ${e.contract.toUpperCase()}` });
        } else if (e.type === "kingDeclared") {
          show({ id, text: `${e.seat === r.you ? "You" : nameNow(e.seat)} declared the K♥` });
        } else if (e.type === "playerFinished") {
          show({ id, text: `${e.seat === r.you ? "You are" : `${nameNow(e.seat)} is`} out, ${ordinal(e.place)}` }, 2000);
        } else if (e.type === "lastTrickShown") {
          setPeek({ cards: e.cards, winner: e.winner });
          later(() => setPeek((cur) => (cur?.cards === e.cards ? null : cur)), 4000);
        }
      }
    });
    return () => {
      off();
      timers.forEach(clearTimeout);
    };
  }, [onEvents]);

  // R-TABLE-12: tell everyone when ownership changes hands.
  const prevOwner = useRef(room.owner);
  useEffect(() => {
    if (prevOwner.current === room.owner) return;
    prevOwner.current = room.owner;
    const text = room.owner === me ? "You are now the table owner" : `${name(room.owner)} is now the table owner`;
    const id = ++counter.current;
    setFeed((f) => [...f, { id, text: `${text}.` }].slice(-60));
    setToast({ id, text });
    const t = setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.owner]);

  const plays = new Set(game.legal.flatMap((a) => (a.type === "play" ? [a.card] : [])));
  const canDeclare = game.legal.some((a) => a.type === "declareKing");
  const canPeek = game.legal.some((a) => a.type === "peekLastTrick");
  const myTurn = game.turn === me && room.status === "playing";

  return (
    <div className="table-screen">
      <div className={`felt phase-${game.phase}`}>
        <ContractBadge game={game} name={name} />
        <button className="side-toggle secondary" onClick={() => setSideOpen(true)}>
          Scores
        </button>
        {SEATS.filter((s) => s !== me).map((s) => (
          <Opponent key={s} seat={s} position={pos(s)} room={room} game={game} />
        ))}

        <div className={`center ${game.phase === "picking" && game.picker === me ? "center-picker" : ""}`}>
          {game.phase === "picking" &&
            (game.picker === me ? <ContractPicker game={game} onPick={(c) => conn.send({ type: "action", action: { type: "pick", contract: c } })} /> : <Choosing name={name(game.picker)} />)}
          {(game.phase === "tricks" || (game.phase !== "trix" && linger)) && (
            <TrickArea trick={game.trick.length > 0 || !linger ? { cards: game.trick, winner: null } : linger} pos={pos} name={(s) => (s === me ? "You" : name(s))} />
          )}
          {(game.phase === "trix" || (game.phase === "contractEnd" && game.contract === "trix")) && <TrixBoard game={game} name={name} />}
        </div>

        <div className="me">
          <TurnHint game={game} room={room} name={name} />
          <div className="me-info">
            <SeatTag seat={me} room={room} game={game} />
            <div className="me-actions">
              {canDeclare && (
                <button className="declare" onClick={() => conn.send({ type: "action", action: { type: "declareKing" } })}>
                  Declare K♥
                </button>
              )}
              {game.phase === "tricks" && (
                <button className="secondary" disabled={!canPeek} onClick={() => conn.send({ type: "action", action: { type: "peekLastTrick" } })}>
                  Last trick ({game.peeksLeft} left)
                </button>
              )}
            </div>
          </div>
          <div className={`hand ${myTurn ? "my-turn" : ""}`}>
            {game.hand.map((c) => {
              const legal = plays.has(c);
              return (
                <Card
                  key={c}
                  id={c}
                  className={myTurn ? (legal ? "legal" : "illegal") : ""}
                  title={myTurn ? (legal ? `Play ${cardLabel(c)}` : `${cardLabel(c)} can't be played now`) : cardLabel(c)}
                  onClick={legal ? () => conn.send({ type: "action", action: { type: "play", card: c } }) : undefined}
                />
              );
            })}
          </div>
        </div>

        {toast && (
          <div className="toast" key={toast.id}>
            {toast.contract && <ContractIcon contract={toast.contract} />}
            <span>{toast.text}</span>
          </div>
        )}
        {peek && <PeekOverlay trick={peek} name={name} me={me} onClose={() => setPeek(null)} />}
        {game.phase === "contractEnd" && room.status !== "paused" && <ContractSummary conn={conn} />}
        {room.status === "finished" && <GameOver conn={conn} />}
        {room.status === "paused" && <Paused conn={conn} />}
        {!conn.online && <div className="offline">Connection lost. Reconnecting…</div>}
        <div className="rotate-notice">
          <span className="big">⟳</span>
          <strong>Turn your phone upright to play</strong>
          <span className="muted">The table needs the height.</span>
        </div>
      </div>

      <aside className={`side ${sideOpen ? "open" : ""}`}>
        <button className="side-close" onClick={() => setSideOpen(false)}>
          Back to the table
        </button>
        <Scoreboard conn={conn} />
        <Feed items={feed} />
        {conn.error && <p className="error">{conn.error.message}</p>}
        <LeaveButton onLeave={() => conn.send({ type: "leave" })} />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Around the table

function ContractBadge({ game, name }: { game: PlayerView; name: (s: Seat) => string }) {
  return (
    <div className="contract-badge">
      <div className="contract-no">
        Contract {game.contractNo} / {game.maxContracts}
      </div>
      {game.contract ? (
        <>
          <ContractIcon contract={game.contract} />
          <div>
            <strong>{game.contract.toUpperCase()}</strong>
            <div className="muted">
              picked by {name(game.picker)} · {multiplierLabel(game.contract, game.multiplier, game.forced)}
            </div>
            <div className="muted small">{CONTRACT_RULE[game.contract]}</div>
            {game.kingDeclaredBy !== null && <div className="declared">K♥ declared by {name(game.kingDeclaredBy)}</div>}
          </div>
        </>
      ) : (
        <div className="muted">{name(game.picker)} is picking</div>
      )}
    </div>
  );
}

function SeatTag({ seat, room, game }: { seat: Seat; room: RoomView; game: PlayerView }) {
  const info = room.seats[seat]!;
  const turn = game.turn === seat && (game.phase === "tricks" || game.phase === "trix" || game.phase === "picking");
  return (
    <div className={`seat-tag ${turn ? "turn" : ""}`}>
      <span className="seat-name">
        {info.name ?? "Empty seat"}
        {seat === room.you ? " (you)" : ""}
      </span>
      <span className="seat-meta">
        <span title="Total score">{game.totals[seat]} pts</span>
        {(game.phase === "tricks" || game.phase === "contractEnd") && game.contract !== "trix" && (
          <span title="Tricks won this contract">
            {game.tricksWon[seat]} trick{game.tricksWon[seat] === 1 ? "" : "s"}
          </span>
        )}
        {game.picker === seat && game.contract && <span className="chip">picker</span>}
        {info.kind === "bot" && <span className="chip">bot</span>}
        {info.botPlaying && <span className="chip warn">bot playing</span>}
        {info.kind === "human" && !info.connected && <span className="chip warn">away</span>}
        {game.finishers.includes(seat) && <span className="chip">{ordinal(game.finishers.indexOf(seat) + 1)} out</span>}
      </span>
    </div>
  );
}

function Opponent({ seat, position, room, game }: { seat: Seat; position: Position; room: RoomView; game: PlayerView }) {
  const count = game.handCounts[seat] ?? 0;
  return (
    <div className={`opponent ${position}`}>
      <SeatTag seat={seat} room={room} game={game} />
      <div className="backs">
        {Array.from({ length: count }, (_, i) => (
          <Card key={i} id="back" />
        ))}
      </div>
    </div>
  );
}

function TurnHint({ game, room, name }: { game: PlayerView; room: RoomView; name: (s: Seat) => string }) {
  if (room.status !== "playing" || game.turn === null) return null;
  if (game.phase !== "tricks" && game.phase !== "trix") return null;
  const mine = game.turn === room.you;
  let text = mine ? "Your turn" : `${name(game.turn)} is playing…`;
  if (mine && game.phase === "tricks" && game.trick.length > 0) {
    const led = game.trick[0]!.card;
    text += ` · follow ${cardLabel(led).slice(-1)} if you can`;
  }
  if (mine && game.phase === "trix") text += " · place a card on a stack";
  return <div className={`turn-hint ${mine ? "mine" : ""}`}>{text}</div>;
}

// ---------------------------------------------------------------------------
// The middle of the table

function Choosing({ name }: { name: string }) {
  return (
    <div className="choosing">
      <div className="spinner" />
      <p>
        <strong>{name}</strong> is choosing a contract…
      </p>
    </div>
  );
}

function ContractPicker({ game, onPick }: { game: PlayerView; onPick: (c: Contract) => void }) {
  const available = new Set(game.legal.flatMap((a) => (a.type === "pick" ? [a.contract] : [])));
  const used = game.used[game.seat] ?? [];
  const hasJack = game.hand.some((c) => c.startsWith("j_"));
  const remaining = CONTRACT_ORDER.length - used.length;
  // R-GAME-11: trix is due by the 6th pick (used.length 5).
  const trixLeft = !used.includes("trix");
  const trixDue = trixLeft && used.length >= 5;
  return (
    <div className="picker">
      <h2>Choose your contract</h2>
      <p className="muted">
        {trixDue
          ? "Trix is due: it must be your 6th pick at the latest."
          : `Your score in it counts ${remaining === 1 ? "×4 (your last pick)" : "×2"}. Trix is never multiplied.`}
        {trixLeft && used.length === 4 && " Trix is due by your next pick."}
      </p>
      <div className="picker-grid">
        {CONTRACT_ORDER.map((c) => {
          const ok = available.has(c);
          const why = used.includes(c)
            ? "already played"
            : trixDue && c !== "trix"
              ? "trix first"
              : c === "trix" && !ok && !hasJack
                ? "needs a jack"
                : "";
          return (
            <button key={c} className={`contract-tile ${ok ? "" : "disabled"}`} disabled={!ok} onClick={() => onPick(c)}>
              <ContractIcon contract={c} />
              <strong>{c.toUpperCase()}</strong>
              <span className="small">{why || CONTRACT_RULE[c]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TrickArea({ trick, pos, name }: { trick: { cards: PlayedCard[]; winner: Seat | null }; pos: (s: Seat) => Position; name: (s: Seat) => string }) {
  return (
    <div className={`trick ${trick.winner !== null ? "done" : ""}`}>
      {trick.cards.map((p, i) => (
        <div key={p.card} className={`trick-card ${pos(p.seat)} ${trick.winner === p.seat ? "winner" : ""}`} style={{ zIndex: i + 1 }}>
          <Card id={p.card} />
        </div>
      ))}
      {trick.winner !== null && <div className="trick-label">{name(trick.winner)} {name(trick.winner) === "You" ? "take" : "takes"} it</div>}
    </div>
  );
}

/** Trix: four stacks, one per suit, each growing up and down from its jack (R-TRIX-1). */
function TrixBoard({ game, name }: { game: PlayerView; name: (s: Seat) => string }) {
  return (
    <div className="trix">
      {SUITS.map((suit) => {
        const stack = game.stacks[suit];
        return (
          <div key={suit} className="trix-column">
            {!stack ? (
              <div className="trix-empty">
                J{cardLabel(card("j", suit)).slice(-1)}
                <span className="small">not started</span>
              </div>
            ) : (
              RANKS.map((r, i) => (i >= stack.low && i <= stack.high ? i : -1))
                .filter((i) => i >= 0)
                .reverse()
                .map((i) => <Card key={i} id={card(RANKS[i]!, suit) as CardId} className={RANKS[i] === "j" ? "jack" : ""} />)
            )}
          </div>
        );
      })}
      {game.finishers.length > 0 && (
        <div className="trix-finishers">
          {game.finishers.map((s, i) => (
            <span key={s}>
              {ordinal(i + 1)}: {name(s)} ({i === 0 ? "−100" : "−50"})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PeekOverlay({ trick, name, me, onClose }: { trick: ShownTrick; name: (s: Seat) => string; me: Seat; onClose: () => void }) {
  return (
    <div className="overlay light" onClick={onClose}>
      <div className="panel peek">
        <h3>Last trick</h3>
        <div className="peek-cards">
          {trick.cards.map((p) => (
            <figure key={p.card} className={p.seat === trick.winner ? "winner" : ""}>
              <Card id={p.card} />
              <figcaption>
                {p.seat === me ? "You" : name(p.seat)}
                {p.seat === trick.winner ? " ★" : ""}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="muted small">★ took the trick · click to close</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Between contracts, end of game, pauses

function ContractSummary({ conn }: { conn: Connection }) {
  const room = conn.room!;
  const game = conn.game!;
  const now = useTick(250);
  const result = game.history.at(-1);
  if (!result) return null;
  const name = (s: Seat) => room.seats[s]?.name ?? `Seat ${s + 1}`;
  const secs = room.continueAt ? Math.max(0, Math.ceil((room.continueAt - now) / 1000)) : 0;
  const waiting = SEATS.filter((s) => room.seats[s]?.kind === "human" && !room.seats[s]!.botPlaying && !room.continued.includes(s));
  const iContinued = room.continued.includes(room.you);

  const note = (s: Seat) => {
    const n: string[] = [];
    if (s === result.picker && result.contract !== "trix") n.push(`picker ×${result.multiplier}`);
    if (result.kingDeclaredBy === s && result.kingTakenBy !== s) n.push("declared K♥: −50");
    if (result.contract === "trix" && result.finishers.includes(s)) n.push(`${ordinal(result.finishers.indexOf(s) + 1)} out`);
    if (result.resetToZero.includes(s)) n.push("hit exactly 1000: back to 0!");
    return n.join(" · ");
  };

  return (
    <div className="overlay">
      <div className="panel summary">
        <div className="summary-head">
          <ContractIcon contract={result.contract} />
          <div>
            <h2>{result.contract.toUpperCase()} is over</h2>
            <p className="muted">picked by {name(result.picker)}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Points</th>
              <th>Counted</th>
              <th>Total</th>
              <th className="note"></th>
            </tr>
          </thead>
          <tbody>
            {SEATS.map((s) => (
              <tr key={s} className={s === room.you ? "you" : ""}>
                <td>
                  {name(s)}
                  {note(s) && <div className="note-inline muted small">{note(s)}</div>}
                </td>
                <td>{result.raw[s]}</td>
                <td className={result.scores[s]! > 0 ? "bad" : result.scores[s]! < 0 ? "good" : ""}>
                  {result.scores[s]! > 0 ? "+" : ""}
                  {result.scores[s]}
                </td>
                <td>{result.totals[s]}</td>
                <td className="note muted small">{note(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="summary-foot">
          <button disabled={iContinued} onClick={() => conn.send({ type: "continue" })}>
            {iContinued ? "Waiting…" : "Continue"}
          </button>
          <span className="muted">
            Next deal in {secs}s{waiting.length > 0 ? ` · waiting for ${waiting.map((s) => (s === room.you ? "you" : name(s))).join(", ")}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function GameOver({ conn }: { conn: Connection }) {
  const room = conn.room!;
  const game = conn.game!;
  const st = game.standings;
  if (!st) return null;
  const name = (s: Seat) => room.seats[s]?.name ?? `Seat ${s + 1}`;
  const readySeats = SEATS.filter((s) => room.ready.includes(s) || room.seats[s]?.kind === "bot" || room.seats[s]?.botPlaying);
  const iAmReady = room.ready.includes(room.you);
  return (
    <div className="overlay">
      <div className="panel gameover">
        <p className="muted">{st.reason === "overLimit" ? "Someone went over 1000." : "All 28 contracts have been played."}</p>
        <h2 className="loser">
          {st.losers.map(name).join(" & ")} {st.losers.length > 1 ? "lose" : "loses"}
        </h2>
        <p className="loser-score">{st.totals[st.losers[0]!]} points</p>
        <p className="winner">
          Winner{st.winners.length > 1 ? "s" : ""}: <strong>{st.winners.map(name).join(" & ")}</strong> ({st.totals[st.winners[0]!]})
        </p>
        <ol className="standings">
          {[...st.order].reverse().map((s) => (
            <li key={s}>
              {name(s)} <span>{st.totals[s]}</span>
            </li>
          ))}
        </ol>
        <button disabled={iAmReady} onClick={() => conn.send({ type: "ready" })}>
          {iAmReady ? "Waiting for the others…" : "Play again"}
        </button>
        <p className="muted small">
          Ready: {readySeats.length}/4 ({readySeats.map(name).join(", ") || "nobody yet"})
        </p>
      </div>
    </div>
  );
}

function Paused({ conn }: { conn: Connection }) {
  const room = conn.room!;
  const isOwner = room.you === room.owner;
  const emptySeat = room.waitingFor.some((s) => room.seats[s]?.kind === "empty");
  const names = room.waitingFor.map((s) => room.seats[s]?.name ?? `seat ${s + 1} (empty)`);
  return (
    <div className="overlay">
      <div className="panel paused">
        <h2>Game paused</h2>
        <p>Waiting for {names.join(", ")}.</p>
        {isOwner ? (
          <>
            {emptySeat && room.invitePath && (
              <>
                <p className="muted">Send this new link to whoever should take the empty seat:</p>
                <InviteLink path={room.invitePath} />
              </>
            )}
            <div className="row">
              <button onClick={() => conn.send({ type: "resumeWithBots" })}>Play on with a bot</button>
              <button className="secondary" onClick={() => conn.send({ type: "endGame" })}>
                End the game
              </button>
            </div>
          </>
        ) : (
          <p className="muted">The table owner can continue with a bot or end the game.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side panel

/** Competition ranking on totals, lowest first (R-GAME-9): ties share a rank (1, 1, 3, 4). */
function ranking(totals: number[]): { order: Seat[]; rank: number[] } {
  const order = [...SEATS].sort((a, b) => totals[a]! - totals[b]! || a - b);
  const rank = totals.map((t) => 1 + totals.filter((x) => x < t).length);
  return { order, rank };
}

/** Counts a number up (or down) to its new value, so score changes are visible. */
function useCountUp(value: number, ms = 800): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const v = Math.round(a + (value - a) * (1 - (1 - k) ** 3));
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

const ROW_H = 66;
const MOVE_SHOW_MS = 5000;

/** Leaderboard: ranked by total, rows slide when the order changes, with the last change shown. */
function Scoreboard({ conn }: { conn: Connection }) {
  const room = conn.room!;
  const game = conn.game!;
  const isOwner = room.you === room.owner;
  const { order, rank } = ranking(game.totals);

  // What changed since the totals last moved: rank movement and the contract's score.
  const prev = useRef<{ key: string; rank: number[] }>({ key: JSON.stringify(game.totals), rank });
  const [change, setChange] = useState<{ moved: number[]; delta: number[]; at: number } | null>(null);
  const key = JSON.stringify(game.totals);
  useEffect(() => {
    if (prev.current.key === key) return;
    const last = game.history.at(-1);
    setChange({
      moved: rank.map((r, s) => prev.current.rank[s]! - r),
      delta: last && JSON.stringify(last.totals) === key ? last.scores : game.totals.map(() => 0),
      at: Date.now(),
    });
    prev.current = { key, rank };
    const t = setTimeout(() => setChange((c) => (c && Date.now() - c.at >= MOVE_SHOW_MS - 50 ? null : c)), MOVE_SHOW_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const worst = Math.max(...game.totals);
  return (
    <section className="scoreboard">
      <h3>Leaderboard</h3>
      <div className="lb" style={{ height: ROW_H * 4 }}>
        {SEATS.map((s) => (
          <LeaderRow
            key={s}
            seat={s}
            position={order.indexOf(s)}
            rank={rank[s]!}
            tied={rank.filter((r) => r === rank[s]).length > 1}
            last={game.totals[s] === worst && worst > 0 && rank[s] !== 1}
            conn={conn}
            moved={change?.moved[s] ?? 0}
            delta={change?.delta[s] ?? 0}
            showKick={isOwner && s !== room.you && room.seats[s]!.kind !== "empty"}
            showMakeOwner={isOwner && s !== room.you && room.seats[s]!.kind === "human" && room.seats[s]!.connected}
          />
        ))}
      </div>
      <p className="muted small">Lowest score leads. Over 1000 and you're out; exactly 1000 resets to 0.</p>
    </section>
  );
}

function LeaderRow(props: {
  seat: Seat;
  position: number;
  rank: number;
  tied: boolean;
  last: boolean;
  conn: Connection;
  moved: number;
  delta: number;
  showKick: boolean;
  showMakeOwner: boolean;
}) {
  const { seat: s, conn } = props;
  const room = conn.room!;
  const game = conn.game!;
  const info = room.seats[s]!;
  const total = game.totals[s]!;
  const shown = useCountUp(total);
  const danger = Math.max(0, Math.min(1, total / 1000));
  const level = total >= 850 ? "high" : total >= 650 ? "mid" : "low";
  return (
    <div
      className={`lb-row ${s === room.you ? "you" : ""} ${props.rank === 1 ? "leader" : ""} ${props.last ? "last" : ""}`}
      style={{ transform: `translateY(${props.position * ROW_H}px)`, height: ROW_H - 6 }}
    >
      <div className={`lb-rank ${props.tied ? "tied" : ""}`} title={props.tied ? `tied for ${props.rank}` : undefined}>
        {props.tied ? `=${props.rank}` : props.rank}
      </div>
      <div className="lb-main">
        <div className="lb-top">
          <span className="lb-name">
            {s === room.owner && (
              <span className="owner-crown" title="Table owner">
                ♛{" "}
              </span>
            )}
            {info.name ?? "Empty"}
            {s === room.you && <span className="muted small"> (you)</span>}
          </span>
          {props.moved !== 0 && (
            <span className={`lb-move ${props.moved > 0 ? "up" : "down"}`} title={props.moved > 0 ? `up ${props.moved}` : `down ${-props.moved}`}>
              {props.moved > 0 ? "▲" : "▼"}
              {Math.abs(props.moved)}
            </span>
          )}
          <span className="lb-total">{shown}</span>
        </div>
        <div className="lb-bottom">
          <div className="lb-bar" title={`${total} / 1000`}>
            <div className={`lb-fill ${level}`} style={{ width: `${danger * 100}%` }} />
          </div>
          {props.delta !== 0 && (
            <span className={`lb-delta ${props.delta > 0 ? "bad" : "good"}`}>
              {props.delta > 0 ? "+" : ""}
              {props.delta}
            </span>
          )}
        </div>
        <div className="sb-contracts">
          {CONTRACT_ORDER.map((c) => (
            <span key={c} className={game.used[s]!.includes(c) ? "used" : ""} title={`${c}: ${game.used[s]!.includes(c) ? "already picked" : "still to pick"}`}>
              {SHORT[c]}
            </span>
          ))}
        </div>
      </div>
      <div className="lb-actions">
        {props.showMakeOwner && (
          <button className="icon" title={`Make ${info.name} the table owner`} onClick={() => conn.send({ type: "makeOwner", seat: s })}>
            ♛
          </button>
        )}
        {props.showKick && (
          <button className="icon" title={`Remove ${info.name}`} onClick={() => conn.send({ type: "kick", seat: s })}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function Feed({ items }: { items: FeedItem[] }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [items]);
  return (
    <section className="feed">
      <h3>What's happening</h3>
      <div className="feed-list" ref={list}>
        {items.length === 0 && <p className="muted">Moves and picks will show up here.</p>}
        {items.map((i) => (
          <p key={i.id}>{i.text}</p>
        ))}
      </div>
    </section>
  );
}
