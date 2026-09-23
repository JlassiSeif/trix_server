// The Trix server as a startable, stoppable unit: HTTP (web app + /api), the game WebSocket,
// rate limits and caps, and saving rooms to disk so a restart (every deploy is one) doesn't
// end the games in progress. index.ts starts it from environment variables; tests start it directly.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { ENGINE_VERSION } from "@trix/engine";
import type { ServerMessage } from "@trix/protocol";
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
  const hub = new Hub({ maxRooms: opts.maxRooms ?? 200, onChange: () => scheduleSave() });

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
    const urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
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

  const server: Server = createServer((req, res) => {
    if (req.url === "/api/health") {
      res.writeHead(200, { ...SECURITY_HEADERS, "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify({ ok: true, engine: ENGINE_VERSION }));
      return;
    }
    if (req.url === "/api/stats") {
      // Counts only, nothing about players.
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
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 4096 });
  const alive = new WeakMap<WebSocket, boolean>();

  wss.on("connection", (socket, req) => {
    if (wss.clients.size > maxSockets) {
      log("warn", "ws.tooManySockets", { sockets: wss.clients.size });
      socket.close(1013, "server busy");
      return;
    }
    log("debug", "ws.open", { ip: req.socket.remoteAddress });
    const conn: Conn = {
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
        log("warn", "ws.rateLimited", { ip: req.socket.remoteAddress, room: hub.roomIdOf(conn) });
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
