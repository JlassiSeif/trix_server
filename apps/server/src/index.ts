// Trix server: serves the built web app and the game WebSocket.
// Scaffold only (M1b). Rooms and game logic arrive in M3.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { ENGINE_VERSION } from "@trix/engine";

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
  if (req.url === "/api/health") {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, engine: ENGINE_VERSION }));
    return;
  }
  serveStatic(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
});

const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "hello", engine: ENGINE_VERSION }));
});

server.listen(PORT, HOST, () => {
  console.log(`trix server on http://${HOST}:${PORT} (web: ${WEB_DIST})`);
});
