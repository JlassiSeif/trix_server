// The test cases. Each states what should happen; the runner records what did.

import { CONTRACTS, DECK, type Seat } from "@trix/engine";
import { NORMAL, type StationClient } from "./client";
import { newClient, Table, type Ctx } from "./table";

export interface Check {
  ok: boolean;
  text: string;
}
export interface Outcome {
  got: string;
  checks: Check[];
  tables: Table[];
  extra?: string[];
}
export interface Scenario {
  id: string;
  title: string;
  group: "normal flow" | "stress" | "connections" | "hostile input" | "permissions" | "security";
  expected: string;
  /** Server notices this scenario provokes on purpose (not replies to a message). */
  expectsNotices?: string[];
  run(ctx: Ctx, opts: { tables: number }): Promise<Outcome>;
}

const GAME_MS = 180_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const check = (ok: boolean, text: string): Check => ({ ok, text });
// /api/stats only answers on the server's own machine. The header also covers --base runs against a
// container (the station then arrives through a trusted private network, like Caddy would).
const stats = async (ctx: Ctx) => (await fetch(`${ctx.httpUrl}/api/stats`, { headers: { "x-forwarded-for": "127.0.0.1" } })).json() as Promise<{ rooms: number; sockets: number; heapUsedMb: number; rssMb: number }>;

async function reconnect(c: StationClient, ms = 5000) {
  await c.connect();
  c.send({ type: "joinRoom", roomId: c.roomId!, token: c.token! });
  const before = c.updates;
  await c.waitFor(() => c.updates > before, ms, "update after reconnect");
}
function summary(t: Table): string {
  const g = t.live.find((c) => c.game)?.game;
  if (!g?.standings) return `not finished (contract ${g?.contractNo ?? "?"}, phase ${g?.phase ?? "?"})`;
  const st = g.standings;
  return `game over after ${g.contractNo} contracts (${st.reason}), totals ${st.totals.join("/")}`;
}
/** Everyone at the table agrees on the final result. */
function agree(t: Table): Check {
  const finals = new Set(t.live.map((c) => JSON.stringify(c.game?.standings)));
  return check(finals.size === 1, `all players see the same final result (${finals.size} distinct)`);
}
/** Wait for a trick contract with at least one trick played (so every kind of move is possible). */
function midContract(t: Table, p: StationClient) {
  return p.waitFor(() => !!p.game && p.game.phase === "tricks" && p.game.lastTrickExists && p.room?.status === "playing", 60_000, "a trick contract under way");
}

export const SCENARIOS: Scenario[] = [
  // ---------------------------------------------------------------- normal flow
  {
    id: "S01",
    title: "One full game, four players",
    group: "normal flow",
    expected: "The game reaches game over. Every move passes the referee, all 4 players see the same public state and the same result, nobody sees another player's cards, and no legal move is refused.",
    async run(ctx) {
      const t = await Table.create(ctx, "S01");
      await t.untilFinished(GAME_MS);
      return { got: summary(t), checks: [agree(t)], tables: [t] };
    },
  },
  {
    id: "S02",
    title: "Many tables at once",
    group: "stress",
    expected: "All tables finish their games with no findings. When everyone leaves, every room is removed and memory settles.",
    async run(ctx, { tables: n }) {
      const before = await stats(ctx);
      const start = Date.now();
      const tables = await Promise.all(Array.from({ length: n }, (_, i) => Table.create(ctx, `S02-t${i}`)));
      const peak = await stats(ctx);
      await Promise.all(tables.map((t) => t.untilFinished(GAME_MS * 2)));
      const secs = ((Date.now() - start) / 1000).toFixed(1);
      for (const t of tables) for (const c of t.live) c.send({ type: "leave" });
      await Promise.all(tables.flatMap((t) => t.clients.map((c) => c.waitFor(() => !!c.removed, 5000, "removed after leaving"))));
      await sleep(300);
      const after = await stats(ctx);
      const finished = tables.filter((t) => t.clients.every((c) => c.game?.standings)).length;
      return {
        got: `${finished}/${n} tables finished in ${secs} s. Rooms ${before.rooms} → ${peak.rooms} → ${after.rooms}; sockets ${peak.sockets} → ${after.sockets}; heap ${before.heapUsedMb} → ${peak.heapUsedMb} → ${after.heapUsedMb} MB`,
        checks: [check(finished === n, `${finished}/${n} tables finished`), check(after.rooms === before.rooms, `rooms back to ${before.rooms} after everyone left (got ${after.rooms})`)],
        tables,
      };
    },
  },
  {
    id: "S03",
    title: "Play again after the game",
    group: "normal flow",
    expected: "After game over all 4 click Ready; a new game starts at contract 1 with totals 0/0/0/0 and plays to the end (R-TABLE-8).",
    async run(ctx) {
      const t = await Table.create(ctx, "S03", { policy: { ...NORMAL, clickReady: true } });
      await t.untilFinished(GAME_MS);
      const first = summary(t);
      const p = t.clients[0]!;
      await p.waitFor(() => p.room?.status === "playing" && p.game?.contractNo === 1 && p.game.history.length === 0, 10_000, "second game");
      const fresh = p.game!.totals.every((x) => x === 0);
      // Every player must be in game 2 before we wait for its end (otherwise game 1's "finished" counts).
      await Promise.all(t.clients.map((c) => c.waitFor(() => c.room?.status === "playing" && c.game?.history.length === 0, 10_000, "second game (all players)")));
      for (const c of t.clients) c.policy = { ...NORMAL };
      await t.untilFinished(GAME_MS);
      return { got: `first: ${first}; second: ${summary(t)}`, checks: [check(fresh, "second game starts at 0/0/0/0"), agree(t)], tables: [t] };
    },
  },
  {
    id: "S04",
    title: "Two players and two server bots",
    group: "normal flow",
    expected: "The server's bots and the two players finish a game together; the bots only make legal moves (R-BOT-1).",
    async run(ctx) {
      const t = await Table.create(ctx, "S04", { players: 2, bots: 2 });
      await t.untilFinished(GAME_MS);
      return { got: summary(t), checks: [agree(t)], tables: [t] };
    },
  },
  {
    id: "S25",
    title: "One player against an easy, a medium and a hard bot",
    group: "normal flow",
    expected: "A whole game against one bot of each level (docs/bots.md): every bot move passes the referee, the seats show each bot's level, and the game ends normally.",
    async run(ctx) {
      const t = await Table.create(ctx, "S25", { players: 1, bots: 3, levels: ["easy", "medium", "hard"] });
      await t.untilFinished(GAME_MS);
      const seats = t.clients[0]!.room!.seats.map((s) => s.level);
      return {
        got: `${summary(t)}; levels ${JSON.stringify(seats)}`,
        checks: [agree(t), check(JSON.stringify(seats) === JSON.stringify([null, "easy", "medium", "hard"]), "the seats show each bot's level")],
        tables: [t],
      };
    },
  },
  {
    id: "S05",
    title: "Nobody clicks Continue",
    group: "normal flow",
    expected: "Between contracts the next deal starts on its own when the countdown ends (10 s, divided by the test speed) (R-TABLE-11).",
    async run(ctx) {
      const t = await Table.create(ctx, "S05", { policy: { ...NORMAL, clickContinue: false } });
      const p = t.clients[0]!;
      await p.waitFor(() => (p.game?.contractNo ?? 0) >= 4, 60_000, "contract 4");
      // Gap between "contract scored" and the next "dealt", as seen by one player.
      const gaps: number[] = [];
      let scoredAt: number | null = null;
      for (const e of p.timeline) {
        if (e.type === "contractScored") scoredAt = e.t;
        if (e.type === "dealt" && scoredAt !== null) {
          gaps.push(e.t - scoredAt);
          scoredAt = null;
        }
      }
      await t.untilFinished(GAME_MS);
      const target = 10_000 / (Number(process.env.STATION_SPEED) || 1);
      const ok = gaps.length >= 2 && gaps.every((g) => g >= target * 0.8 && g <= target * 2 + 200);
      return { got: `gaps between contracts: ${gaps.map((g) => `${g} ms`).join(", ")} (target ${target} ms); ${summary(t)}`, checks: [check(ok, `each gap within 0.8×–2× of ${target} ms`)], tables: [t] };
    },
  },

  // ---------------------------------------------------------------- hostile input
  {
    id: "S10",
    title: "Players spam moves out of turn",
    group: "hostile input",
    expected: "No illegal move ever takes effect (the referee checks every event: who played, who picked, who declared); illegal moves are refused with an error; the game finishes normally. A move that became legal by the time it reached the server (the turn had just passed to that player) may be accepted.",
    async run(ctx) {
      const t = await Table.create(ctx, "S10");
      let spam = 0;
      for (const c of t.clients) {
        c.afterUpdate = (me) => {
          const g = me.game;
          if (!g || g.turn === me.seat || me.random() > 0.35) return;
          const pick = me.random();
          spam++;
          if (pick < 0.5) me.send({ type: "action", action: { type: "play", card: DECK[Math.floor(me.random() * 32)]! } }, true);
          else if (pick < 0.7) me.send({ type: "action", action: { type: "pick", contract: CONTRACTS[Math.floor(me.random() * 7)]! } }, true);
          else if (pick < 0.85) me.send({ type: "action", action: { type: "declareKing" } }, true);
          else me.send({ type: "action", action: { type: "nextContract" } }, true);
        };
      }
      await t.untilFinished(GAME_MS);
      for (const c of t.clients) c.afterUpdate = null;
      await sleep(200);
      const refused = t.clients.reduce((n, c) => n + c.errors.filter((e) => e.deliberate).length, 0);
      return {
        got: `${spam} moves sent out of turn: ${refused} refused, ${spam - refused} accepted because they had become legal on arrival (each checked by the referee); ${summary(t)}`,
        checks: [check(refused >= spam * 0.95, `nearly all refused (${refused}/${spam})`), agree(t)],
        tables: [t],
      };
    },
  },
  {
    id: "S11",
    title: "Junk and malformed messages",
    group: "hostile input",
    expected: "Each junk message gets an error back; the sender stays connected and seated; the table keeps playing and finishes.",
    async run(ctx) {
      const t = await Table.create(ctx, "S11");
      const p = t.clients[1]!;
      await midContract(t, p);
      const roomId = p.roomId!;
      const junk: [string, string][] = [
        ["empty string", ""],
        ["broken JSON", "{"],
        ["null", "null"],
        ["array", "[]"],
        ["number", "42"],
        ["type is a number", '{"type":5}'],
        ["action without body", '{"type":"action"}'],
        ["action: null", '{"type":"action","action":null}'],
        ["card is an object", '{"type":"action","action":{"type":"play","card":{"$gt":""}}}'],
        ["card __proto__", '{"type":"action","action":{"type":"play","card":"__proto__"}}'],
        ["contract toString", '{"type":"action","action":{"type":"pick","contract":"toString"}}'],
        ["type __proto__", '{"type":"__proto__"}'],
        ["type constructor", '{"type":"constructor"}'],
        ["kick seat -1", '{"type":"kick","seat":-1}'],
        ["kick seat '0'", '{"type":"kick","seat":"0"}'],
        ["addBot seat 9", '{"type":"addBot","seat":9}'],
        ["joinRoom with object id", '{"type":"joinRoom","roomId":{}}'],
        ["deep nesting", "[".repeat(1500) + "]".repeat(1500)],
        ["createRoom, name is a number", '{"type":"createRoom","name":12}'],
        ["joinRoom own room, bad invite", JSON.stringify({ type: "joinRoom", roomId, invite: "nope", name: "x" })],
      ];
      const rows: string[] = [];
      const checks: Check[] = [];
      const oldPolicy = p.policy;
      for (const [label, raw] of junk) {
        const errorsBefore = p.errors.length;
        p.sendRaw(raw);
        await p.waitFor(() => p.errors.length > errorsBefore || !p.ws, 2000, `error for ${label}`).catch(() => undefined);
        await sleep(150);
        const gotError = p.errors.length > errorsBefore ? p.errors.at(-1)!.code : "no error";
        const other = t.clients[0]!;
        const stillSeated = !!p.ws && !other.room!.waitingFor.includes(p.seat!) && other.room!.seats[p.seat!]!.connected;
        rows.push(`${label}: ${gotError}; ${stillSeated ? "still seated" : "NOT SEATED ANY MORE"}`);
        checks.push(check(gotError !== "no error" && stillSeated, `${label}: error reply and sender still seated`));
        if (!stillSeated) {
          // Put the player back so the remaining cases (and the game) can go on.
          p.policy = null;
          if (!p.ws) await p.connect();
          p.send({ type: "joinRoom", roomId, token: p.token! });
          await sleep(300);
          p.policy = oldPolicy;
          p.maybeAct();
        }
      }
      await t.untilFinished(GAME_MS);
      return { got: summary(t), checks: [...checks, agree(t)], tables: [t], extra: rows };
    },
  },
  {
    id: "S12",
    title: "Message over the 4 KB limit",
    group: "hostile input",
    expected: "The server closes that connection (the limit protects it); the table pauses; the player reconnects with their seat token and the game goes on to the end.",
    async run(ctx) {
      const t = await Table.create(ctx, "S12");
      const p = t.clients[2]!;
      await midContract(t, p);
      let closeCode = 0;
      const prevOnClose = p.onClose;
      p.onClose = (code) => {
        closeCode = code;
        prevOnClose?.(code);
      };
      p.sendRaw(JSON.stringify({ type: "action", action: { type: "play", card: "x".repeat(5000) } }));
      await p.waitFor(() => !p.ws, 3000, "server closing the connection").catch(() => undefined);
      const closed = !p.ws;
      const other = t.clients[0]!;
      await other.waitFor(() => other.room?.status === "paused", 3000, "pause").catch(() => undefined);
      const paused = other.room?.status === "paused";
      await reconnect(p);
      await other.waitFor(() => other.room?.status === "playing", 3000, "resume").catch(() => undefined);
      const resumed = other.room?.status === "playing";
      await t.untilFinished(GAME_MS);
      return {
        got: `connection closed: ${closed} (code ${closeCode}); table paused: ${paused}; resumed after reconnect: ${resumed}; ${summary(t)}`,
        checks: [check(closed, "oversized message closes the connection"), check(paused, "table pauses"), check(resumed, "table resumes after reconnect")],
        tables: [t],
      };
    },
  },
  {
    id: "S13",
    title: "Every move sent twice (double click)",
    group: "hostile input",
    expected: "The first copy of each move is played, the second is refused; no card is ever played twice; the game finishes.",
    async run(ctx) {
      const t = await Table.create(ctx, "S13");
      for (const c of t.clients) c.policy = { ...NORMAL, doubleSend: true };
      await t.untilFinished(GAME_MS);
      await sleep(200);
      const doubles = t.clients.reduce((n, c) => n + c.doublesSent, 0);
      const refused = t.clients.reduce((n, c) => n + c.errors.filter((e) => e.deliberate).length, 0);
      return { got: `${doubles} moves sent twice, ${refused} second copies refused; ${summary(t)}`, checks: [check(refused === doubles, `every second copy refused (${refused}/${doubles})`), agree(t)], tables: [t] };
    },
  },
  {
    id: "S22",
    title: "Message flood while a table plays",
    group: "stress",
    expectsNotices: ["RATE_LIMITED"],
    expected: "An outsider floods 20,000 junk messages and a seated player floods 5,000 illegal moves: both are cut off by the rate limit (RATE_LIMITED, disconnected) after about 80 messages, the server stays responsive throughout (health check under 100 ms), the seated player reconnects with their token and the game finishes.",
    async run(ctx) {
      const t = await Table.create(ctx, "S22");
      const p = t.clients[1]!;
      await midContract(t, p);
      const outsider = newClient(ctx, "S22-outsider");
      await outsider.connect();
      const latencies: number[] = [];
      let probing = true;
      const probe = (async () => {
        while (probing) {
          const s = Date.now();
          await fetch(`${ctx.httpUrl}/api/health`);
          latencies.push(Date.now() - s);
          await sleep(50);
        }
      })();
      await sleep(200); // some probes before the flood
      const start = Date.now();
      // Flood in chunks so the health probes interleave and measure the server during the flood.
      for (let i = 0; i < 20_000; i += 500) {
        for (let j = 0; j < 500; j++) outsider.sendRaw("x");
        if (i < 5_000) for (let j = 0; j < 125; j++) p.send({ type: "action", action: { type: "play", card: "7_h" } }, true);
        await sleep(5);
      }
      await outsider.waitFor(() => !outsider.ws, 5_000, "outsider cut off").catch(() => undefined);
      await p.waitFor(() => !p.ws, 5_000, "flooding player cut off").catch(() => undefined);
      const floodMs = Date.now() - start;
      await sleep(300);
      probing = false;
      await probe;
      const outsiderCut = !outsider.ws && outsider.errors.some((e) => e.code === "RATE_LIMITED");
      const playerCut = !p.ws && p.errors.some((e) => e.code === "RATE_LIMITED");
      const outsiderReplies = outsider.errors.length;
      await outsider.close();
      if (!p.ws) await reconnect(p);
      p.maybeAct();
      await t.untilFinished(GAME_MS);
      latencies.sort((a, b) => a - b);
      const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
      const max = latencies.at(-1) ?? 0;
      return {
        got: `outsider cut off: ${outsiderCut} after ${outsiderReplies} replies; flooding player cut off: ${playerCut}; flood took ${floodMs} ms; health p95 ${p95} ms, max ${max} ms over ${latencies.length} probes; ${summary(t)}`,
        checks: [check(outsiderCut, "outsider cut off by the rate limit"), check(playerCut, "flooding player cut off by the rate limit"), check(p95 < 100, `health p95 under 100 ms (got ${p95})`), agree(t)],
        tables: [t],
      };
    },
  },

  // ---------------------------------------------------------------- connections
  {
    id: "S14",
    title: "A player keeps dropping and coming back",
    group: "connections",
    expected: "15 times: the drop pauses the table, the player comes back with their seat token to the same seat and the same hand, and the table resumes (R-TABLE-4, R-TABLE-5). The game finishes.",
    async run(ctx) {
      // Play again automatically, so a short game doesn't cut the test short.
      const t = await Table.create(ctx, "S14", { policy: { ...NORMAL, clickReady: true } });
      const x = t.clients[2]!;
      const other = t.clients[0]!;
      let pauses = 0;
      let resumes = 0;
      let drops = 0;
      let sameHand = 0;
      const notes: string[] = [];
      for (let i = 0; i < 15; i++) {
        await sleep(200 + Math.floor(x.random() * 600));
        await other.waitFor(() => other.room?.status === "playing", 15_000, "table playing");
        const handBefore = x.game?.hand ?? [];
        drops++;
        x.drop();
        let countWhilePaused = -1;
        try {
          await other.waitFor(() => other.room?.status === "paused" && other.room.waitingFor.includes(x.seat!), 3000, "pause");
          pauses++;
          countWhilePaused = other.game!.handCounts[x.seat!]!; // frozen while paused
        } catch (e) {
          notes.push(`drop ${i + 1}: ${(e as Error).message}; status ${other.room?.status}`);
        }
        await reconnect(x);
        // Same cards as when the table froze (a move already on its way when the drop happened may have landed).
        // The view the server restored on return (the player may make a new move right after).
        const after = x.firstViewAfterJoin?.hand ?? [];
        const ok = after.length === countWhilePaused && after.every((c) => handBefore.includes(c));
        if (ok) sameHand++;
        else notes.push(`drop ${i + 1}: hand on return ${JSON.stringify(after)} vs ${countWhilePaused} cards while paused, before drop ${JSON.stringify(handBefore)}`);
        try {
          await other.waitFor(() => other.room?.status !== "paused", 3000, "resume");
          resumes++;
        } catch (e) {
          notes.push(`drop ${i + 1}: ${(e as Error).message}`);
        }
      }
      for (const c of t.clients) c.policy = { ...NORMAL };
      await other.waitFor(() => other.room?.status === "playing", 15_000, "table playing");
      await t.untilFinished(GAME_MS);
      return {
        got: `${drops} drops: pauses ${pauses}, resumes ${resumes}, same hand ${sameHand}; ${summary(t)}`,
        checks: [check(drops >= 5 && pauses === drops && resumes === drops, `every drop paused and every return resumed (${pauses}/${resumes} of ${drops})`), check(sameHand === drops, "hand unchanged while away")],
        tables: [t],
        extra: notes,
      };
    },
  },
  {
    id: "S15",
    title: "Owner plays on with a bot, then the player returns",
    group: "connections",
    expected: "While the player is away, the bot plays their seat; when they return they take the seat back and the bot stops (R-TABLE-5, R-TABLE-7). The game finishes.",
    async run(ctx) {
      const t = await Table.create(ctx, "S15");
      const x = t.clients[2]!;
      const owner = t.clients[0]!;
      await midContract(t, x);
      x.drop();
      await owner.waitFor(() => owner.room?.status === "paused", 3000, "pause");
      owner.send({ type: "resumeWithBots" });
      await owner.waitFor(() => owner.room?.status === "playing" && owner.room.seats[x.seat!]!.botPlaying, 3000, "bot playing");
      const playedBefore = owner.events.filter((e) => e.type === "cardPlayed" && e.seat === x.seat).length;
      await owner.waitFor(() => owner.events.filter((e) => e.type === "cardPlayed" && e.seat === x.seat).length >= playedBefore + 3, 20_000, "bot plays for the missing player");
      await reconnect(x);
      await owner.waitFor(() => owner.room?.seats[x.seat!]?.botPlaying === false, 3000, "seat back to the player");
      const back = owner.room?.seats[x.seat!]?.botPlaying === false && owner.room.seats[x.seat!]!.connected;
      await t.untilFinished(GAME_MS);
      return { got: `bot played ≥3 cards for the missing player; player back in control: ${back}; ${summary(t)}`, checks: [check(back, "player takes the seat back")], tables: [t] };
    },
  },
  {
    id: "S16",
    title: "Kick in the middle of a game, replacement joins",
    group: "connections",
    expected: "The kicked player is told and disconnected; their token and the old invite link stop working; a new player with the new link takes the seat with its hand, and the game finishes (R-TABLE-6).",
    async run(ctx) {
      const t = await Table.create(ctx, "S16");
      const owner = t.clients[0]!;
      const victim = t.clients[3]!;
      await midContract(t, victim);
      const oldInvite = t.invite();
      const seat = victim.seat!;
      owner.send({ type: "kick", seat });
      await victim.waitFor(() => victim.removed === "kicked" && !victim.ws, 3000, "kicked");
      const paused = await owner.waitFor(() => owner.room?.status === "paused", 3000, "pause").then(() => true, () => false);

      const probe = newClient(ctx, "S16-probe");
      await probe.connect();
      probe.send({ type: "joinRoom", roomId: owner.roomId!, token: victim.token! });
      probe.send({ type: "joinRoom", roomId: owner.roomId!, invite: oldInvite, name: "sneaky" });
      await probe.waitFor(() => probe.errors.length >= 2, 3000, "two refusals");
      const codes = probe.errors.map((e) => e.code);
      await probe.close();

      const newInvite = t.invite();
      const repl = newClient(ctx, "S16-replacement");
      repl.policy = NORMAL;
      await repl.connect();
      repl.send({ type: "joinRoom", roomId: owner.roomId!, invite: newInvite, name: "replacement" });
      await repl.waitFor(() => !!repl.game, 3000, "replacement seated");
      const tookSeat = repl.seat === seat && repl.game!.hand.length === owner.game!.handCounts[seat];
      t.clients = t.clients.map((c) => (c === victim ? repl : c));
      t.watch(repl);
      await t.untilFinished(GAME_MS);
      return {
        got: `kicked player removed; table paused: ${paused}; old token/old link: ${codes.join(", ")}; new link differs: ${newInvite !== oldInvite}; replacement took seat ${repl.seat} with ${repl.game?.hand.length ?? "?"} cards; ${summary(t)}`,
        checks: [
          check(paused, "table pauses on the empty seat"),
          check(codes.join() === "BAD_TOKEN,BAD_INVITE", `old token → BAD_TOKEN, old link → BAD_INVITE (got ${codes.join(", ")})`),
          check(newInvite !== oldInvite, "a new invite link"),
          check(tookSeat, "replacement takes the same seat and its cards"),
        ],
        tables: [t],
      };
    },
  },
  {
    id: "S17",
    title: "The owner leaves in the middle of a game",
    group: "connections",
    expected: "Ownership passes to another player, who gets the invite link and the owner controls; they play on with a bot and the game finishes.",
    async run(ctx) {
      const t = await Table.create(ctx, "S17");
      const owner = t.clients[0]!;
      const heir = t.clients[1]!;
      await midContract(t, heir);
      owner.send({ type: "leave" });
      await owner.waitFor(() => owner.removed === "left", 3000, "left");
      await heir.waitFor(() => heir.room?.owner === heir.seat, 3000, "new owner");
      const gotLink = !!heir.room?.invitePath;
      const paused = heir.room?.status === "paused";
      heir.send({ type: "resumeWithBots" });
      await heir.waitFor(() => heir.room?.status === "playing", 3000, "resumed");
      await t.untilFinished(GAME_MS);
      return {
        got: `new owner: seat ${heir.room?.owner}; has invite link: ${gotLink}; paused: ${paused}; ${summary(t)}`,
        checks: [check(heir.room?.owner === heir.seat, "ownership passes on"), check(gotLink, "new owner gets the invite link"), check(paused, "table pauses on the empty seat")],
        tables: [t],
      };
    },
  },
  {
    id: "S18",
    title: "The same seat opened in a second tab",
    group: "connections",
    expectsNotices: ["REPLACED"],
    expected: "The first tab is told the seat was opened elsewhere and is disconnected; the second tab plays on; the game finishes.",
    async run(ctx) {
      const t = await Table.create(ctx, "S18");
      const first = t.clients[2]!;
      await midContract(t, first);
      const second = newClient(ctx, "S18-second-tab");
      second.policy = NORMAL;
      first.policy = null;
      await second.connect();
      second.send({ type: "joinRoom", roomId: first.roomId!, token: first.token! });
      await second.waitFor(() => !!second.game, 3000, "second tab seated");
      await first.waitFor(() => !first.ws, 3000, "first tab closed").catch(() => undefined);
      const told = first.errors.some((e) => e.code === "REPLACED");
      t.clients = t.clients.map((c) => (c === first ? second : c));
      t.watch(second);
      second.maybeAct();
      await t.untilFinished(GAME_MS);
      return {
        got: `first tab told "REPLACED": ${told}; first tab disconnected: ${!first.ws}; second tab seat ${second.seat}; ${summary(t)}`,
        checks: [check(told && !first.ws, "first tab is told and disconnected"), check(second.seat === first.seat, "second tab has the same seat")],
        tables: [t],
      };
    },
  },
  {
    id: "S19",
    title: "Everyone drops at once, then everyone returns",
    group: "connections",
    expected: "The room survives with nobody connected; when all 4 return with their tokens the game resumes where it was and finishes.",
    async run(ctx) {
      const t = await Table.create(ctx, "S19");
      const p = t.clients[0]!;
      await midContract(t, p);
      const snapshot = JSON.stringify({ c: p.game!.contractNo, h: p.game!.handCounts, tr: p.game!.trick });
      const rooms = (await stats(ctx)).rooms;
      for (const c of t.clients) c.drop();
      await sleep(500);
      const roomsWhileAway = (await stats(ctx)).rooms;
      for (const c of t.clients) await reconnect(c);
      await p.waitFor(() => p.room?.status === "playing", 3000, "resumed");
      const same = JSON.stringify({ c: p.game!.contractNo, h: p.game!.handCounts, tr: p.game!.trick }) === snapshot;
      for (const c of t.clients) c.maybeAct();
      await t.untilFinished(GAME_MS);
      return {
        got: `rooms ${rooms} → ${roomsWhileAway} while away; game unchanged on return: ${same}; ${summary(t)}`,
        checks: [check(roomsWhileAway === rooms, "room kept while nobody is connected"), check(same, "game picks up exactly where it was")],
        tables: [t],
      };
    },
  },

  {
    id: "S24",
    title: "The server restarts during three games",
    group: "connections",
    expected: "Three tables are mid-game when the server restarts, as on every deploy. Every player comes back with their seat token to the same contract and the same cards, the referee stays clean across the restart, and all three games finish.",
    async run(ctx) {
      if (!ctx.restartServer) return { got: "skipped: needs the station's own server", checks: [check(false, "restart possible")], tables: [] };
      const tables = await Promise.all([0, 1, 2].map((i) => Table.create(ctx, `S24-t${i}`)));
      const everyone = tables.flatMap((t) => t.clients);
      await Promise.all(tables.map((t) => midContract(t, t.clients[0]!)));
      // Players sit still through the restart, so "before" and "after" can be compared fairly
      // (otherwise the first tables back play on while the others are still reconnecting).
      const policies = everyone.map((c) => c.policy);
      for (const c of everyone) c.policy = null;
      await ctx.restartServer();
      await Promise.all(everyone.map((c) => c.waitFor(() => !c.ws, 5000, "disconnected by the restart")));
      // The last thing each player saw before the restart is what the server saved.
      const before = everyone.map((c) => JSON.stringify({ n: c.game!.contractNo, p: c.game!.phase, h: c.game!.hand, t: c.game!.totals }));
      for (const c of everyone) await reconnect(c);
      const after = everyone.map((c) => {
        const g = c.firstViewAfterJoin!;
        return JSON.stringify({ n: g.contractNo, p: g.phase, h: g.hand, t: g.totals });
      });
      const same = before.filter((b, i) => b === after[i]).length;
      everyone.forEach((c, i) => (c.policy = policies[i]!));
      for (const c of everyone) c.maybeAct();
      await Promise.all(tables.map((t) => t.untilFinished(GAME_MS)));
      return {
        got: `${same}/${everyone.length} players back to exactly the same game; ${tables.map(summary).join(" · ")}`,
        checks: [check(same === everyone.length, "everyone back to the same contract, cards and totals"), ...tables.map(agree)],
        tables,
      };
    },
  },

  // ---------------------------------------------------------------- permissions
  {
    id: "S20",
    title: "Refused joins and owner-only actions",
    group: "permissions",
    expected: "Each request is refused with the right code: full table ROOM_FULL, unknown room ROOM_NOT_FOUND, bad token BAD_TOKEN, blank or non-text name BAD_NAME, moves before joining NOT_SEATED, owner actions by others NOT_OWNER, kicking yourself BAD_MESSAGE.",
    async run(ctx) {
      const t = await Table.create(ctx, "S20", { policy: null });
      const owner = t.clients[0]!;
      const guest = t.clients[1]!;
      const lobbyOwner = newClient(ctx, "S20-lobby-owner");
      await lobbyOwner.connect();
      lobbyOwner.send({ type: "createRoom", name: "lobby owner" });
      await lobbyOwner.waitFor(() => !!lobbyOwner.room, 3000, "second room");
      const lobbyInvite = new URL(lobbyOwner.room!.invitePath!, "http://x").searchParams.get("i")!;
      const cases: [string, string, (c: StationClient) => void, StationClient | null][] = [
        ["join a full table", "ROOM_FULL", (c) => c.send({ type: "joinRoom", roomId: owner.roomId!, invite: t.invite(), name: "late" }, true), null],
        ["join an unknown room", "ROOM_NOT_FOUND", (c) => c.send({ type: "joinRoom", roomId: "nothere", invite: "x", name: "x" }, true), null],
        ["rejoin with a made-up token", "BAD_TOKEN", (c) => c.send({ type: "joinRoom", roomId: owner.roomId!, token: "f".repeat(32) }, true), null],
        ["join with a blank name", "BAD_NAME", (c) => c.send({ type: "joinRoom", roomId: lobbyOwner.roomId!, invite: lobbyInvite, name: "   " }, true), null],
        ["join with a number as name", "BAD_NAME", (c) => c.send({ type: "joinRoom", roomId: lobbyOwner.roomId!, invite: lobbyInvite, name: 42 }, true), null],
        ["move before joining", "NOT_SEATED", (c) => c.send({ type: "action", action: { type: "pick", contract: "dineri" } }, true), null],
        ["non-owner adds a bot", "NOT_OWNER", (c) => c.send({ type: "addBot", seat: 3 }, true), guest],
        ["non-owner kicks", "NOT_OWNER", (c) => c.send({ type: "kick", seat: 0 }, true), guest],
        ["non-owner ends the game", "NOT_OWNER", (c) => c.send({ type: "endGame" }, true), guest],
        ["non-owner resumes with bots", "NOT_OWNER", (c) => c.send({ type: "resumeWithBots" }, true), guest],
        ["owner kicks themself", "BAD_MESSAGE", (c) => c.send({ type: "kick", seat: c.seat! }, true), owner],
      ];
      const checks: Check[] = [];
      const rows: string[] = [];
      for (const [label, want, act, who] of cases) {
        const c = who ?? newClient(ctx, `S20-${label.replace(/\W+/g, "-")}`);
        if (!who) await c.connect();
        const n = c.errors.length;
        act(c);
        await c.waitFor(() => c.errors.length > n, 2000, label).catch(() => undefined);
        const got = c.errors.length > n ? c.errors.at(-1)!.code : "no error";
        rows.push(`${label}: expected ${want}, got ${got}`);
        checks.push(check(got === want, `${label} → ${want} (got ${got})`));
        if (!who) await c.close();
      }
      await lobbyOwner.close();
      return { got: `${checks.filter((c) => c.ok).length}/${checks.length} refused with the expected code`, checks, tables: [t], extra: rows };
    },
  },
  {
    id: "S21",
    title: "Looking at the last trick: limit and privacy",
    group: "permissions",
    expected: "A player gets exactly 2 looks per contract (the 3rd is refused with CANNOT_PEEK); only that player receives what they looked at (R-TRICK-6).",
    async run(ctx) {
      const t = await Table.create(ctx, "S21");
      const p = t.clients[1]!;
      p.policy = { ...NORMAL, peekChance: 0 };
      await midContract(t, p);
      const contractNo = p.game!.contractNo;
      const shownBefore = p.events.filter((e) => e.type === "lastTrickShown").length;
      const n = p.errors.length;
      for (let i = 0; i < 3; i++) p.send({ type: "action", action: { type: "peekLastTrick" } });
      await p.waitFor(() => p.errors.length > n || p.game!.contractNo !== contractNo, 2000, "third look refused").catch(() => undefined);
      await sleep(100);
      const shown = p.events.filter((e) => e.type === "lastTrickShown").length - shownBefore;
      const third = p.errors.slice(n).map((e) => e.code);
      const sameContract = p.game!.contractNo === contractNo;
      await t.untilFinished(GAME_MS);
      return {
        got: `looks shown ${shown}, refusals ${third.join(",") || "none"} (still same contract: ${sameContract}); ${summary(t)}`,
        checks: [check(shown === 2, `exactly 2 looks shown (got ${shown})`), check(third.includes("CANNOT_PEEK"), "3rd look refused with CANNOT_PEEK")],
        tables: [t],
      };
    },
  },
  {
    id: "S23",
    title: "Lobby: end a game, kick, add a bot, start again",
    group: "permissions",
    expected: "The owner ends the game (back to the lobby), kicks a player, fills the seat with a bot; the full table starts a new game on its own and finishes it.",
    async run(ctx) {
      const t = await Table.create(ctx, "S23");
      const owner = t.clients[0]!;
      const victim = t.clients[2]!;
      await midContract(t, owner);
      owner.send({ type: "endGame" });
      await owner.waitFor(() => owner.room?.status === "lobby", 3000, "lobby");
      const lobby = owner.room?.status === "lobby";
      owner.send({ type: "kick", seat: victim.seat! });
      await victim.waitFor(() => victim.removed === "kicked", 3000, "kicked");
      owner.send({ type: "addBot", seat: victim.seat! });
      await owner.waitFor(() => owner.room?.status === "playing" && owner.game?.contractNo === 1, 3000, "new game");
      const started = owner.room?.status === "playing";
      t.clients = t.clients.filter((c) => c !== victim);
      await t.untilFinished(GAME_MS);
      return { got: `back to lobby: ${lobby}; new game started on its own: ${started}; ${summary(t)}`, checks: [check(lobby, "end game → lobby"), check(started, "bot fills the seat and the game starts")], tables: [t] };
    },
  },
];

export type { Seat };
