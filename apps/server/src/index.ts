// Trix server: serves the built web app and the game WebSocket (/ws).

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import { ENGINE_VERSION } from "@trix/engine";
import type { ServerMessage } from "@trix/protocol";
import { Hub } from "./hub";
import { RateLimiter } from "./limiter";
import { log } from "./log";
import { TIMING, type Conn } from "./room";

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "127.0.0.1";
// Both src/ (dev) and dist/ (prod) sit one level inside apps/server, so this resolves to apps/web/dist.
const WEB_DIST = resolve(process.env.WEB_DIST ?? fileURLToPath(new URL("../../web/dist", import.meta.url)));

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

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  const filePath = resolve(WEB_DIST, "." + urlPath);
  // Refuse anything that escapes the web build directory.
  if (filePath !== WEB_DIST && !filePath.startsWith(WEB_DIST + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" }).end(body);
  } catch {
    // Unknown paths (e.g. invite links like /r/<id>) get the app shell; the client router handles them.
    try {
      const index = await readFile(resolve(WEB_DIST, "index.html"));
      res.writeHead(200, { "content-type": MIME[".html"] }).end(index);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" }).end("Web app not built. Run `npm run build`, or use `npm run dev`.");
    }
  }
}

const server = createServer((req, res) => {
  if (req.url === "/api/stats") {
    // Counts only, nothing about players: used by the testing station to spot leaks.
    const m = process.memoryUsage();
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({ rooms: hub.rooms.size, sockets: wss.clients.size, heapUsedMb: +(m.heapUsed / 1e6).toFixed(1), rssMb: +(m.rss / 1e6).toFixed(1) }),
    );
    return;
  }
  if (req.url === "/api/health") {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, engine: ENGINE_VERSION }));
    return;
  }
  serveStatic(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
});

// TRIX_SPEED=10 makes bots and countdowns 10x faster (automated tests only).
const speed = Number(process.env.TRIX_SPEED ?? 1);
if (speed > 1) for (const k of Object.keys(TIMING) as (keyof typeof TIMING)[]) TIMING[k] = Math.round(TIMING[k] / speed);

const RATE = { perSecond: 40, burst: 80 };

const hub = new Hub();
setInterval(() => hub.sweep(), 10 * 60 * 1000).unref();

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 4096 });
const alive = new WeakMap<WebSocket, boolean>();

wss.on("connection", (socket, req) => {
  log("debug", "ws.open", { ip: req.socket.remoteAddress });
  const conn: Conn = {
    send: (msg: ServerMessage) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
    },
    close: () => socket.close(),
  };
  alive.set(socket, true);
  socket.on("pong", () => alive.set(socket, true));
  // A player sends a few messages a second. A flood gets cut off before it can slow the
  // server down for every other table, and is logged once rather than once per message.
  const limiter = new RateLimiter(RATE.perSecond, RATE.burst);
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

// A dropped phone or wifi often never sends a close: ping every 15 s and drop silent sockets,
// so the table notices the player is gone and pauses (R-TABLE-4).
setInterval(() => {
  for (const socket of wss.clients) {
    if (!alive.get(socket)) {
      log("info", "ws.heartbeatTimeout", {});
      socket.terminate();
      continue;
    }
    alive.set(socket, false);
    socket.ping();
  }
}, 15_000).unref();

process.on("uncaughtException", (e) => log("error", "process.uncaughtException", { error: e }));
process.on("unhandledRejection", (e) => log("error", "process.unhandledRejection", { error: e }));

server.listen(PORT, HOST, () => {
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : PORT;
  log("info", "server.listening", { url: `http://${HOST}:${port}`, port, web: WEB_DIST, speed });
});
