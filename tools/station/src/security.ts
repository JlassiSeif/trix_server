// Security scenarios: what an attacker would try, and what must happen instead.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import net from "node:net";
import { NORMAL } from "./client";
import type { Check, Scenario } from "./scenarios";
import { newClient, Table, type Ctx } from "./table";

const check = (ok: boolean, text: string): Check => ({ ok, text });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A raw HTTP request, exactly as written (no path clean-up by a client library). */
function rawHttp(ctx: Ctx, request: string, waitMs = 3000): Promise<{ status: number; head: string; body: string }> {
  const { hostname, port } = new URL(ctx.httpUrl);
  return new Promise((ok) => {
    const sock = net.connect(Number(port), hostname);
    let data = "";
    sock.on("data", (d) => (data += d.toString("latin1")));
    sock.on("close", () => {
      const [head = "", body = ""] = data.split("\r\n\r\n");
      ok({ status: Number(head.split(" ")[1] ?? 0), head, body });
    });
    sock.on("error", () => ok({ status: 0, head: "", body: "" }));
    sock.write(request);
    setTimeout(() => sock.destroy(), waitMs);
  });
}
const get = (ctx: Ctx, path: string, extra = "") => rawHttp(ctx, `GET ${path} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n${extra}\r\n`);

async function openMany(ctx: Ctx, label: string, n: number, ip: string) {
  const clients = [];
  let refused = 0;
  for (let i = 0; i < n; i++) {
    const c = newClient(ctx, `${label}-${i}`, { ip });
    await c.connect().catch(() => undefined);
    clients.push(c);
  }
  await sleep(300);
  for (const c of clients) if (!c.ws) refused++;
  return { clients, refused, open: n - refused };
}

export const SECURITY: Scenario[] = [
  {
    id: "X01",
    title: "One address opens a flood of connections",
    group: "security",
    expected: "One address gets at most 20 connections; the rest are closed (1013). Other addresses can still connect, so nobody is locked out of the server.",
    async run(ctx) {
      const { clients, refused, open } = await openMany(ctx, "X01-attacker", 30, "203.0.113.66");
      const other = newClient(ctx, "X01-friend", { ip: "198.51.100.7" });
      await other.connect();
      await sleep(200);
      const friendOk = !!other.ws;
      for (const c of [...clients, other]) await c.close();
      return { got: `${open} of 30 connections kept open, ${refused} refused; another address can connect: ${friendOk}`, checks: [check(open === 20, `20 kept (got ${open})`), check(friendOk, "other addresses unaffected")], tables: [] };
    },
  },
  {
    id: "X02",
    title: "One address creates tables in bulk",
    group: "security",
    expected: "One address can have at most 5 tables open; more are refused (TOO_MANY_TABLES), so the server's 200 tables can't all be taken by one person. Others can still create tables.",
    async run(ctx) {
      const codes: string[] = [];
      const clients = [];
      for (let i = 0; i < 8; i++) {
        const c = newClient(ctx, `X02-${i}`, { ip: "203.0.113.67" });
        await c.connect();
        c.send({ type: "createRoom", name: `spam${i}` }, true);
        await c.waitFor(() => !!c.room || c.errors.length > 0, 2000, "reply").catch(() => undefined);
        codes.push(c.room ? "ok" : (c.errors[0]?.code ?? "none"));
        clients.push(c);
      }
      const other = newClient(ctx, "X02-other", { ip: "198.51.100.8" });
      await other.connect();
      other.send({ type: "createRoom", name: "legit" });
      await other.waitFor(() => !!other.room, 2000, "other creates").catch(() => undefined);
      const otherOk = !!other.room;
      for (const c of [...clients, other]) c.send({ type: "leave" });
      await sleep(200);
      for (const c of [...clients, other]) await c.close();
      const ok = codes.filter((c) => c === "ok").length;
      return { got: `${codes.join(", ")}; another address can create: ${otherOk}`, checks: [check(ok === 5 && codes.slice(5).every((c) => c === "TOO_MANY_TABLES"), `5 allowed, then TOO_MANY_TABLES (got ${ok} allowed)`), check(otherOk, "other addresses unaffected")], tables: [] };
    },
  },
  {
    id: "X03",
    title: "Guessing invite codes",
    group: "security",
    expected: "After 20 wrong invite codes an address is locked out for 10 minutes (TOO_MANY_ATTEMPTS), even if it then finds the right code. A friend with the real link, from another address, gets in.",
    async run(ctx) {
      const t = await Table.create(ctx, "X03", { players: 1, bots: 0, policy: null });
      const roomId = t.clients[0]!.roomId!;
      const g = newClient(ctx, "X03-guesser", { ip: "203.0.113.68" });
      await g.connect();
      for (let i = 0; i < 25; i++) {
        g.send({ type: "joinRoom", roomId, invite: `guess${i}`, name: `g${i}` }, true);
      }
      await g.waitFor(() => g.errors.length >= 25, 3000, "25 replies").catch(() => undefined);
      g.send({ type: "joinRoom", roomId, invite: t.invite(), name: "lucky" }, true);
      await g.waitFor(() => g.errors.length >= 26 || !!g.room, 2000, "reply to the right code").catch(() => undefined);
      const codes = g.errors.map((e) => e.code);
      const rightCodeRefused = !g.room && codes.at(-1) === "TOO_MANY_ATTEMPTS";
      const friend = newClient(ctx, "X03-friend", { ip: "198.51.100.9" });
      await friend.connect();
      friend.send({ type: "joinRoom", roomId, invite: t.invite(), name: "friend" });
      await friend.waitFor(() => !!friend.room, 2000, "friend joins").catch(() => undefined);
      await Promise.all([g.close(), friend.close()]);
      const bad = codes.filter((c) => c === "BAD_INVITE").length;
      return {
        got: `${bad} BAD_INVITE, then ${codes.filter((c) => c === "TOO_MANY_ATTEMPTS").length} TOO_MANY_ATTEMPTS; the right code while locked out refused: ${rightCodeRefused}; friend from another address joined: ${!!friend.room}`,
        checks: [check(bad === 20, `20 guesses allowed (got ${bad})`), check(rightCodeRefused, "locked out even with the right code"), check(!!friend.room, "friends unaffected")],
        tables: [t],
      };
    },
  },
  {
    id: "X04",
    title: "Guessing seat tokens to steal a seat",
    group: "security",
    expected: "Made-up seat tokens are refused (BAD_TOKEN) and 20 of them lock the address out. The real player still gets back into their seat.",
    async run(ctx) {
      const t = await Table.create(ctx, "X04", { players: 2, bots: 2 });
      const victim = t.clients[1]!;
      const g = newClient(ctx, "X04-thief", { ip: "203.0.113.69" });
      await g.connect();
      for (let i = 0; i < 25; i++) g.send({ type: "joinRoom", roomId: victim.roomId!, token: (Math.random().toString(16).slice(2) + "0".repeat(32)).slice(0, 32) }, true);
      await g.waitFor(() => g.errors.length >= 25, 3000, "25 replies").catch(() => undefined);
      const codes = g.errors.map((e) => e.code);
      victim.drop();
      await sleep(100);
      await victim.connect();
      victim.send({ type: "joinRoom", roomId: victim.roomId!, token: victim.token! });
      await victim.waitFor(() => victim.room?.status === "playing", 3000, "victim back").catch(() => undefined);
      await g.close();
      return {
        got: `${codes.filter((c) => c === "BAD_TOKEN").length} BAD_TOKEN, ${codes.filter((c) => c === "TOO_MANY_ATTEMPTS").length} TOO_MANY_ATTEMPTS, seat stolen: ${!!g.room}; real player back: ${victim.room?.status === "playing"}`,
        checks: [check(!g.room, "no seat stolen"), check(codes.includes("TOO_MANY_ATTEMPTS"), "guessing locks the address out"), check(victim.room?.status === "playing", "real player unaffected")],
        tables: [t],
      };
    },
  },
  {
    id: "X05",
    title: "Joining under someone else's name",
    group: "security",
    expected: "Nobody can take a name already at the table, whatever the upper/lower case or spacing (NAME_TAKEN), so nobody can pass for someone else.",
    async run(ctx) {
      const t = await Table.create(ctx, "X05", { players: 2, bots: 0, policy: null });
      const target = t.clients[0]!.name; // "X05-p0"
      const codes: string[] = [];
      for (const name of [target, target.toUpperCase(), `  ${target}  `, target.replace("-", " -")]) {
        const c = newClient(ctx, `X05-imp-${codes.length}`);
        await c.connect();
        c.send({ type: "joinRoom", roomId: t.clients[0]!.roomId!, invite: t.invite(), name }, true);
        await c.waitFor(() => c.errors.length > 0 || !!c.room, 2000, "reply").catch(() => undefined);
        codes.push(c.room ? `seated as "${name}"` : (c.errors[0]?.code ?? "none"));
        if (c.room) c.send({ type: "leave" });
        await c.close();
      }
      const blocked = codes.slice(0, 3).every((c) => c === "NAME_TAKEN");
      return { got: codes.join(", "), checks: [check(blocked, "same name in any case or spacing refused")], tables: [t], extra: ['"X05 -p0" (a different name) is allowed: telling apart look-alike names is left to the players'] };
    },
  },
  {
    id: "X06",
    title: "Another website tries to connect",
    group: "security",
    expected: "A connection from a page on another site (Origin https://evil.test) is refused at the handshake. Our own site (https://trix.test) and non-browser clients (no Origin) are accepted.",
    async run(ctx) {
      const tryOrigin = async (origin: string | undefined) => {
        const c = newClient(ctx, `X06-${origin ?? "none"}`.replace(/\W+/g, "-"), { origin });
        const res = await c.connect().then(
          () => "accepted",
          (e: Error) => e.message,
        );
        await c.close();
        return res;
      };
      const evil = await tryOrigin("https://evil.test");
      const ours = await tryOrigin("https://trix.test");
      const none = await tryOrigin(undefined);
      return {
        got: `evil.test: ${evil}; trix.test: ${ours}; no origin: ${none}`,
        checks: [check(evil !== "accepted", "other sites refused"), check(ours === "accepted", "our site accepted"), check(none === "accepted", "non-browser clients accepted")],
        tables: [],
      };
    },
  },
  {
    id: "X07",
    title: "Probing the web server",
    group: "security",
    expected: "No request reads files outside the web app; broken addresses get 400 and other methods 405; the stats page isn't public; every response carries the security headers and says nothing about the server software.",
    async run(ctx) {
      const probes: [string, string][] = [
        ["../ traversal", "/../../../../etc/passwd"],
        ["encoded traversal", "/%2e%2e/%2e%2e/%2e%2e/etc/passwd"],
        ["double-encoded traversal", "/%252e%252e/%252e%252e/etc/passwd"],
        ["backslash traversal", "/..%5c..%5c..%5cetc/passwd"],
        ["dot-dot-slash tricks", "/....//....//etc/passwd"],
        ["server source", "/../../apps/server/src/room.ts"],
        ["state file", "/../../.station-runs/rooms.json"],
      ];
      const rows: string[] = [];
      const checks: Check[] = [];
      for (const [label, path] of probes) {
        const r = await get(ctx, path);
        const leaked = r.body.includes("root:") || r.body.includes("RoomError") || r.body.includes("\"rooms\"");
        rows.push(`${label}: HTTP ${r.status}${leaked ? " LEAKED FILE" : ""}`);
        checks.push(check(!leaked, `${label}: nothing outside the web app served`));
      }
      const malformed = await get(ctx, "/%E0%A4%A");
      const nul = await get(ctx, "/index.html%00.png");
      const post = await rawHttp(ctx, "POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
      const trace = await rawHttp(ctx, "TRACE / HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n");
      const stats = await get(ctx, "/api/stats", "X-Forwarded-For: 203.0.113.70\r\n");
      const home = await get(ctx, "/");
      rows.push(`malformed %-encoding: ${malformed.status}; NUL byte: ${nul.status}; POST: ${post.status}; TRACE: ${trace.status}; /api/stats from outside: ${stats.status}`);
      checks.push(check(malformed.status === 400, "malformed address → 400"));
      checks.push(check(nul.status === 400, "NUL byte → 400"));
      checks.push(check(post.status === 405 && trace.status === 405, "POST/TRACE → 405"));
      checks.push(check(stats.status === 404, "stats not public"));
      const h = home.head.toLowerCase();
      for (const header of ["content-security-policy", "x-content-type-options: nosniff", "referrer-policy: no-referrer", "x-frame-options: deny"]) checks.push(check(h.includes(header), `header ${header}`));
      checks.push(check(!/x-powered-by|^server:/m.test(h), "no server software advertised"));
      return { got: `${checks.filter((c) => c.ok).length}/${checks.length} checks passed`, checks, tables: [], extra: rows };
    },
  },
  {
    id: "X08",
    title: "Slow request (slowloris)",
    group: "security",
    expected: "A client that sends its request headers a few bytes at a time is cut off within about 10 seconds, so a few such clients can't tie up the server.",
    async run(ctx) {
      const { hostname, port } = new URL(ctx.httpUrl);
      const start = Date.now();
      const closedAfter = await new Promise<number>((ok) => {
        const sock = net.connect(Number(port), hostname, () => {
          sock.write("GET / HTTP/1.1\r\nHost: x\r\n");
          const drip = setInterval(() => sock.write("X-a: b\r\n"), 1000);
          sock.on("close", () => {
            clearInterval(drip);
            ok(Date.now() - start);
          });
        });
        sock.on("error", () => undefined);
        setTimeout(() => {
          sock.destroy();
          ok(-1);
        }, 25_000);
      });
      return { got: closedAfter < 0 ? "still open after 25 s" : `cut off after ${(closedAfter / 1000).toFixed(1)} s`, checks: [check(closedAfter > 0 && closedAfter < 16_000, "cut off within ~10–15 s")], tables: [] };
    },
  },
  {
    id: "X09",
    title: "A player at one table meddles with another",
    group: "security",
    expected: "A seat token only works at its own table; a player can only act at the table they're seated at. No cross-table effect.",
    async run(ctx) {
      const a = await Table.create(ctx, "X09a", { players: 1, bots: 3, policy: null });
      const b = await Table.create(ctx, "X09b", { players: 1, bots: 3, policy: null });
      const pa = a.clients[0]!;
      const pb = b.clients[0]!;
      const probe = newClient(ctx, "X09-probe");
      await probe.connect();
      probe.send({ type: "joinRoom", roomId: pb.roomId!, token: pa.token! }, true); // A's token at table B
      await probe.waitFor(() => probe.errors.length > 0 || !!probe.room, 2000, "reply").catch(() => undefined);
      const tokenCode = probe.room ? "SEATED" : probe.errors[0]?.code;
      const bSeatsBefore = JSON.stringify(pb.room!.seats);
      pa.send({ type: "kick", seat: 1 }); // A's owner kicks their own seat 1: must only touch table A
      await pa.waitFor(() => pa.room!.seats[1]!.kind === "empty", 2000, "A's seat 1 emptied").catch(() => undefined);
      await sleep(300);
      const aKicked = pa.room!.seats[1]!.kind === "empty";
      // (Table B's own bots keep playing meanwhile; its seats must not change.)
      const bUntouched = JSON.stringify(pb.room!.seats) === bSeatsBefore;
      await probe.close();
      return {
        got: `A's token at table B: ${tokenCode}; A's kick emptied A's seat: ${aKicked}; table B's seats untouched: ${bUntouched}`,
        checks: [check(tokenCode === "BAD_TOKEN", "tokens are per table"), check(aKicked && bUntouched, "the kick only affects its own table")],
        tables: [a, b],
      };
    },
  },
  {
    id: "X10",
    title: "Secrets never reach the logs",
    group: "security",
    expected: "No seat token or invite code seen during this whole run appears anywhere in the server log.",
    async run(ctx) {
      if (!ctx.serverLog) return { got: "skipped: needs the station's own server", checks: [check(false, "server log available")], tables: [] };
      // Make some fresh secrets, then look for every token/invite the clients have seen.
      const t = await Table.create(ctx, "X10", { players: 3, bots: 1, policy: NORMAL });
      await sleep(1500);
      const log = readFileSync(ctx.serverLog, "utf8");
      // Every seat token and invite code any simulated player received during the whole run.
      const secrets = new Set<string>();
      for (const f of readdirSync(ctx.dir).filter((n) => n.endsWith(".jsonl"))) {
        const text = readFileSync(join(ctx.dir, f), "utf8");
        for (const m of text.matchAll(/"token":"([0-9a-f]{32})"/g)) secrets.add(m[1]!);
        for (const m of text.matchAll(/\?i=([a-z0-9]{8})/g)) secrets.add(m[1]!);
      }
      for (const c of t.clients) if (c.token) secrets.add(c.token);
      const leaked = [...secrets].filter((s) => log.includes(s));
      return { got: `${secrets.size} secrets checked against ${log.split("\n").length} log lines: ${leaked.length} found`, checks: [check(leaked.length === 0, "no secret in the log")], tables: [t] };
    },
  },
];
