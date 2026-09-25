// The Trix server as a startable, stoppable unit: HTTP (web app + /api), the game WebSocket,
// rate limits and caps, and saving rooms to disk so a restart (every deploy is one) doesn't
// end the games in progress. index.ts starts it from environment variables; tests start it directly.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import type { ServerMessage } from "@platform/protocol";
import { AccountError, TokenError, type Accounts, type VerifiedUser } from "./accounts";
import { Hub, type HubSnapshot } from "./hub";
import { RateLimiter } from "./limiter";
import { log } from "./log";
import type { Conn } from "./room";

export interface AppOptions {
  port: number;
  host: string;
  webDist: string;
  /** Where rooms are saved. Without it, rooms live in memory only and a restart ends every game. */
  stateFile?: string;
  maxRooms?: number;
  maxSockets?: number;
  rate?: { perSecond: number; burst: number };
  /** Behind a reverse proxy: take the client address from X-Forwarded-For when the connection comes
   *  from the proxy. true: a proxy on this machine (loopback). "private": a proxy on a private network,
   *  e.g. Caddy on a Docker network, for a container that publishes no ports. */
  trustProxy?: boolean | "private";
  /** Pages allowed to open game connections (e.g. ["https://trix.example.com"]). Unset: any. */
  allowedOrigins?: string[];
  maxSocketsPerIp?: number;
  maxRoomsPerIp?: number;
  /** Wrong invite links / seat tokens / room ids allowed per address per 10 minutes. */
  maxJoinFailures?: number;
  /** Games switched off: no new tables; tables already playing finish. */
  closedGames?: string[];
  /** Accounts (Firebase), or null/absent: no sign-in on offer. */
  accounts?: Accounts | null;
  /** Firebase's public web settings, handed to the page by /api/config. */
  firebaseWeb?: { apiKey: string; authDomain: string; projectId: string; appId: string; authEmulator?: string };
  /** The games on offer (default: all). Tests pass their own. */
  games?: ConstructorParameters<typeof Hub>[0] extends infer O ? (O extends { games?: infer G } ? G : never) : never;
}

const isLoopback = (a: string | undefined) => a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";

/** Loopback or a private network address (10/8, 172.16/12, 192.168/16, fc00::/7), IPv4-mapped forms included. */
export function isPrivate(a: string | undefined): boolean {
  if (!a) return false;
  if (isLoopback(a)) return true;
  const v4 = a.startsWith("::ffff:") ? a.slice(7) : a;
  const m = v4.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (m) {
    const [x, y] = [Number(m[1]), Number(m[2])];
    return x === 10 || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168);
  }
  return /^f[cd][0-9a-f]{2}:/i.test(a);
}

export interface App {
  port: number;
  hub: Hub;
  /** Save the rooms, tell every browser the server is restarting, and stop. */
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

/** The content policy. With accounts on, Firebase sign-in also needs Google's sign-in script, the
 *  sign-in page's frame (our own domain behind Caddy, or <project>.firebaseapp.com) and Google's
 *  token endpoints; with the emulator, its local address. Nothing else ever loads. */
export function contentPolicy(web?: AppOptions["firebaseWeb"]): string {
  const auth = web ? ` https://identitytoolkit.googleapis.com https://securetoken.googleapis.com${web.authEmulator ? ` ${web.authEmulator}` : ""}` : "";
  const frames = web ? ` https://${web.authDomain}${web.authEmulator ? ` ${web.authEmulator}` : ""}` : "";
  return [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self'${web ? " https://apis.google.com" : ""}`,
    `connect-src 'self'${auth}`,
    `frame-src 'self'${frames}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join("; ");
}
const BASE_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  // Invite links carry a code in the address: never pass it on to other sites.
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy": contentPolicy(),
};

/** Vite's hashed files never change; the page itself must always be fresh so a deploy takes effect. */
function cacheFor(urlPath: string): string {
  if (urlPath.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (urlPath.endsWith(".png")) return "public, max-age=86400";
  return "no-cache";
}

export async function startApp(opts: AppOptions): Promise<App> {
  const webDist = resolve(opts.webDist);
  const maxSockets = opts.maxSockets ?? 1000;
  const rate = opts.rate ?? { perSecond: 40, burst: 80 };
  const accounts = opts.accounts ?? null;
  const web = accounts ? opts.firebaseWeb : undefined;
  const SECURITY_HEADERS = { ...BASE_HEADERS, "content-security-policy": contentPolicy(web) };
  // Declared first: restoring rooms below already triggers a save.
  let closing = false;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const hub = new Hub({
    maxRooms: opts.maxRooms ?? 200,
    maxRoomsPerIp: opts.maxRoomsPerIp ?? 5,
    maxJoinFailures: opts.maxJoinFailures ?? 20,
    onChange: () => scheduleSave(),
    closedGames: new Set(opts.closedGames ?? []),
    ...(opts.games ? { games: opts.games } : {}),
  });
  const maxPerIp = opts.maxSocketsPerIp ?? 20;
  const socketsPerIp = new Map<string, number>();

  /** The real client address. X-Forwarded-For is only believed from our proxy (see trustProxy),
   *  and only its last entry (the one our proxy added; anything before it the client could forge). */
  function clientIp(req: IncomingMessage): string {
    const peer = req.socket.remoteAddress ?? "unknown";
    const xff = req.headers["x-forwarded-for"];
    const fromProxy = opts.trustProxy === "private" ? isPrivate(peer) : opts.trustProxy === true && isLoopback(peer);
    if (fromProxy && typeof xff === "string" && xff.trim()) return xff.split(",").at(-1)!.trim();
    return peer;
  }

  // ------------------------------------------------------------------ saved rooms
  if (opts.stateFile && existsSync(opts.stateFile)) {
    try {
      const snap = JSON.parse(readFileSync(opts.stateFile, "utf8")) as HubSnapshot;
      const n = hub.restore(snap);
      log("info", "state.restored", { file: opts.stateFile, rooms: n, savedAt: snap.savedAt });
    } catch (e) {
      // Never refuse to start over a bad file: keep it aside and start empty.
      const aside = `${opts.stateFile}.broken-${Date.now()}`;
      renameSync(opts.stateFile, aside);
      log("error", "state.unreadable", { file: opts.stateFile, movedTo: aside, error: e });
    }
  }
  function saveNow() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    if (!opts.stateFile) return;
    try {
      const tmp = `${opts.stateFile}.tmp`;
      // Seat tokens are in here: owner-only permissions.
      writeFileSync(tmp, JSON.stringify(hub.snapshot()), { mode: 0o600 });
      renameSync(tmp, opts.stateFile); // atomic: a crash mid-write never leaves half a file
    } catch (e) {
      log("error", "state.saveFailed", { file: opts.stateFile, error: e });
    }
  }
  function scheduleSave() {
    if (opts.stateFile && !saveTimer && !closing) {
      saveTimer = setTimeout(saveNow, 500);
      saveTimer.unref();
    }
  }

  // ------------------------------------------------------------------ HTTP
  async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let urlPath: string;
    try {
      urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    } catch {
      res.writeHead(400, SECURITY_HEADERS).end();
      return;
    }
    if (urlPath.includes("\0")) {
      res.writeHead(400, SECURITY_HEADERS).end();
      return;
    }
    const filePath = resolve(webDist, "." + urlPath);
    if (filePath !== webDist && !filePath.startsWith(webDist + sep)) {
      res.writeHead(403, SECURITY_HEADERS).end();
      return;
    }
    try {
      const body = await readFile(filePath);
      res.writeHead(200, { ...SECURITY_HEADERS, "content-type": MIME[extname(filePath)] ?? "application/octet-stream", "cache-control": cacheFor(urlPath) }).end(body);
    } catch {
      // Unknown paths (invite links like /r/<id>) get the app; the client routes them.
      try {
        const index = await readFile(resolve(webDist, "index.html"));
        res.writeHead(200, { ...SECURITY_HEADERS, "content-type": MIME[".html"], "cache-control": "no-cache" }).end(index);
      } catch {
        res.writeHead(404, { ...SECURITY_HEADERS, "content-type": "text/plain" }).end("Web app not built. Run `npm run build`.");
      }
    }
  }

  function json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { ...SECURITY_HEADERS, "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(body));
  }

  /** A small JSON body (profile edits are a few dozen bytes). */
  function readBody(req: IncomingMessage, max = 2048): Promise<unknown> {
    return new Promise((ok, fail) => {
      let size = 0;
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => {
        size += c.length;
        if (size > max) {
          // Stop reading; the answer goes out with "connection: close", which ends the rest.
          req.removeAllListeners("data");
          req.pause();
          fail(new AccountError("TOO_LARGE", "Request too large"));
        } else chunks.push(c);
      });
      req.on("end", () => {
        try {
          ok(size ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
        } catch {
          fail(new AccountError("BAD_REQUEST", "Not JSON"));
        }
      });
      req.on("error", fail);
    });
  }

  // Profile requests: a handful per visit. Each address gets a burst of 20, then 5 a second.
  const apiLimits = new Map<string, RateLimiter>();

  /** GET, PUT or DELETE your profile, with your sign-in token in the Authorization header (never a
   *  cookie, so other websites can't make your browser do it). */
  async function handleMe(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!accounts) return json(res, 404, { error: "ACCOUNTS_OFF", message: "Accounts are not available right now." });
    const ip = clientIp(req);
    let limiter = apiLimits.get(ip);
    if (!limiter) apiLimits.set(ip, (limiter = new RateLimiter(5, 20)));
    if (apiLimits.size > 10_000) apiLimits.clear();
    if (!limiter.take()) return json(res, 429, { error: "RATE_LIMITED", message: "Too many requests. Wait a moment." });
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    let user: VerifiedUser;
    try {
      user = await accounts.verify(bearer);
    } catch (e) {
      if (e instanceof TokenError) return json(res, 401, { error: "SIGNED_OUT", message: "Please sign in again." });
      throw e;
    }
    try {
      if (req.method === "GET") return json(res, 200, await accounts.profile(user, new URL(req.url!, "http://x").searchParams.get("lang")));
      if (req.method === "PUT") return json(res, 200, await accounts.update(user, (await readBody(req)) as { displayName?: unknown; language?: unknown }));
      if (req.method === "DELETE") {
        await accounts.delete(user);
        log("info", "account.deleted", {});
        return json(res, 200, { deleted: true });
      }
      res.writeHead(405, { ...SECURITY_HEADERS, allow: "GET, PUT, DELETE" }).end();
    } catch (e) {
      if (e instanceof AccountError && e.code === "TOO_LARGE") {
        res.setHeader("connection", "close");
        return json(res, 413, { error: e.code, message: e.message });
      }
      if (e instanceof AccountError) return json(res, 400, { error: e.code, message: e.message });
      throw e;
    }
  }

  // Slow-request attacks: give up on clients that dribble their request in. Node only enforces
  // these timeouts when it checks its connections, every 30 s by default: check every 2 s.
  const server: Server = createServer({ headersTimeout: 10_000, requestTimeout: 15_000, connectionsCheckingInterval: 2_000 }, (req, res) => {
    if (req.url === "/api/health") {
      res.writeHead(200, { ...SECURITY_HEADERS, "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify({ ok: true, games: Object.fromEntries(hub.listGames().map((g) => [g.id, g.version])) }));
      return;
    }
    if (req.url === "/api/games") {
      // The home page's list of games, with whether each is open right now.
      res.writeHead(200, { ...SECURITY_HEADERS, "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(hub.listGames()));
      return;
    }
    if (req.url === "/api/config") {
      // What the page needs to offer sign-in: whether accounts are on, and Firebase's public settings.
      json(res, 200, { accounts: !!web, firebase: web ?? null });
      return;
    }
    if (req.url === "/api/me" || req.url?.startsWith("/api/me?")) {
      handleMe(req, res).catch((e) => {
        log("error", "api.me.failed", { error: e });
        if (!res.headersSent) json(res, 500, { error: "SERVER_ERROR", message: "Something went wrong. Try again in a moment." });
      });
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { ...SECURITY_HEADERS, allow: "GET, HEAD" }).end();
      return;
    }
    if (req.url === "/api/stats") {
      // Counts only, nothing about players, and only for someone on the machine itself.
      if (!isLoopback(clientIp(req))) {
        res.writeHead(404, SECURITY_HEADERS).end();
        return;
      }
      const m = process.memoryUsage();
      res
        .writeHead(200, { ...SECURITY_HEADERS, "content-type": "application/json", "cache-control": "no-store" })
        .end(JSON.stringify({ rooms: hub.rooms.size, sockets: wss.clients.size, heapUsedMb: +(m.heapUsed / 1e6).toFixed(1), rssMb: +(m.rss / 1e6).toFixed(1) }));
      return;
    }
    serveStatic(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  // ------------------------------------------------------------------ WebSocket
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 4096,
    perMessageDeflate: false, // no compression: no decompression bombs
    // Other websites can't open game connections from their visitors' browsers.
    // (Non-browser clients send no Origin; they are subject to the same limits as everyone.)
    verifyClient: ({ origin }: { origin?: string }) => !opts.allowedOrigins || !origin || opts.allowedOrigins.includes(origin),
  });
  const alive = new WeakMap<WebSocket, boolean>();

  wss.on("connection", (socket, req) => {
    if (wss.clients.size > maxSockets) {
      log("warn", "ws.tooManySockets", { sockets: wss.clients.size });
      socket.close(1013, "server busy");
      return;
    }
    const ip = clientIp(req);
    const mine = (socketsPerIp.get(ip) ?? 0) + 1;
    if (mine > maxPerIp) {
      log("warn", "ws.tooManyFromAddress", { ip, sockets: mine - 1 });
      socket.close(1013, "too many connections from your address");
      return;
    }
    socketsPerIp.set(ip, mine);
    socket.once("close", () => {
      const n = (socketsPerIp.get(ip) ?? 1) - 1;
      if (n <= 0) socketsPerIp.delete(ip);
      else socketsPerIp.set(ip, n);
    });
    log("debug", "ws.open", { ip });
    const conn: Conn = {
      ip,
      send: (msg: ServerMessage) => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
      },
      close: () => socket.close(),
    };
    alive.set(socket, true);
    socket.on("pong", () => alive.set(socket, true));
    // A player sends a few messages a second. A flood is cut off before it can slow the server
    // down for every other table, and is logged once rather than once per message.
    const limiter = new RateLimiter(rate.perSecond, rate.burst);
    let cutOff = false;
    // Messages are handled in order. "identify" (a signed-in player's token) is checked with Google's
    // keys, which can take a moment: anything sent after it waits for it.
    let queue: Promise<void> = Promise.resolve();
    socket.on("message", (data) => {
      if (cutOff) return;
      if (!limiter.take()) {
        cutOff = true;
        log("warn", "ws.rateLimited", { ip, room: hub.roomIdOf(conn) });
        conn.send({ type: "error", code: "RATE_LIMITED", message: "Too many messages: disconnected" });
        socket.close(1008, "rate limited");
        return;
      }
      const raw = data.toString();
      queue = queue
        .then(async () => {
          if (raw.includes('"identify"') && isIdentify(raw)) return identify(raw);
          hub.receive(conn, raw);
        })
        .catch((e) => log("error", "ws.messageFailed", { error: e }));
    });
    const isIdentify = (raw: string) => {
      try {
        return (JSON.parse(raw) as { type?: unknown }).type === "identify";
      } catch {
        return false;
      }
    };
    const identify = async (raw: string) => {
      let token: unknown;
      try {
        token = (JSON.parse(raw) as { idToken?: unknown }).idToken;
      } catch {
        return conn.send({ type: "error", code: "BAD_MESSAGE", message: "Not JSON" });
      }
      if (token === null || token === undefined || !accounts) {
        conn.uid = undefined; // signed out, or no accounts on this server: a guest
        return conn.send({ type: "identified", signedIn: false });
      }
      try {
        conn.uid = (await accounts.verify(token)).uid;
        hub.identified(conn);
        conn.send({ type: "identified", signedIn: true });
      } catch (e) {
        conn.uid = undefined;
        if (!(e instanceof TokenError)) log("warn", "ws.identifyFailed", { error: e });
        conn.send({ type: "identified", signedIn: false });
      }
    };
    socket.on("close", (code) => {
      log("debug", "ws.close", { code });
      hub.disconnected(conn);
    });
    socket.on("error", (e) => {
      log("warn", "ws.error", { error: e.message });
      socket.terminate();
    });
  });

  // A dropped phone or wifi often never sends a close: ping every 15 s and drop silent
  // sockets, so the table notices the player is gone and pauses (R-TABLE-4).
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.get(socket)) {
        log("info", "ws.heartbeatTimeout", {});
        socket.terminate();
        continue;
      }
      alive.set(socket, false);
      socket.ping();
    }
  }, 15_000);
  heartbeat.unref();
  const sweep = setInterval(() => hub.sweep(), 10 * 60 * 1000);
  sweep.unref();

  await new Promise<void>((ok) => server.listen(opts.port, opts.host, ok));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : opts.port;

  async function close(): Promise<void> {
    if (closing) return;
    closing = true;
    clearInterval(heartbeat);
    clearInterval(sweep);
    hub.stopTimers();
    saveNow();
    // 1012 = "service restart": browsers reconnect by themselves and rejoin their seats.
    for (const socket of wss.clients) socket.close(1012, "server restarting");
    await new Promise<void>((ok) => wss.close(() => ok()));
    await new Promise<void>((ok) => server.close(() => ok()));
    server.closeAllConnections?.();
    log("info", "server.stopped", { rooms: hub.rooms.size, saved: !!opts.stateFile });
  }

  return { port, hub, close };
}
