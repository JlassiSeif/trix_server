// The Trix server as a startable, stoppable unit: HTTP (web app + /api), the game WebSocket,
// rate limits and caps, and saving rooms to disk so a restart (every deploy is one) doesn't
// end the games in progress. index.ts starts it from environment variables; tests start it directly.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import type { ServerMessage } from "@platform/protocol";
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
};

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  // Invite links carry a code in the address: never pass it on to other sites.
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
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
    socket.on("message", (data) => {
      if (cutOff) return;
      if (!limiter.take()) {
        cutOff = true;
        log("warn", "ws.rateLimited", { ip, room: hub.roomIdOf(conn) });
        conn.send({ type: "error", code: "RATE_LIMITED", message: "Too many messages: disconnected" });
        socket.close(1008, "rate limited");
        return;
      }
      hub.receive(conn, data.toString());
    });
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
