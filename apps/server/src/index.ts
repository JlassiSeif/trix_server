// Trix server entry point: settings from the environment, clean shutdown on SIGTERM/SIGINT.
//
//   PORT              default 8080
//   HOST              default 127.0.0.1 (behind a reverse proxy); 0.0.0.0 to listen on all interfaces
//   TRIX_STATE_FILE   where rooms are saved, so a restart doesn't end games (recommended in production)
//   TRIX_MAX_ROOMS    default 200
//   TRIX_LOG_LEVEL    debug | info (default) | warn | error | silent
//   WEB_DIST          the built web app (default apps/web/dist)
//   TRIX_SPEED        tests only: bots and countdowns N times faster

import { fileURLToPath } from "node:url";
import { startApp } from "./app";
import { log } from "./log";
import { TIMING } from "./room";

const speed = Number(process.env.TRIX_SPEED ?? 1);
if (speed > 1) for (const k of Object.keys(TIMING) as (keyof typeof TIMING)[]) TIMING[k] = Math.round(TIMING[k] / speed);

process.on("uncaughtException", (e) => log("error", "process.uncaughtException", { error: e }));
process.on("unhandledRejection", (e) => log("error", "process.unhandledRejection", { error: e }));

const host = process.env.HOST ?? "127.0.0.1";
const app = await startApp({
  port: Number(process.env.PORT ?? 8080),
  host,
  // Both src/ (dev) and dist/ (prod) sit one level inside apps/server, so this is apps/web/dist.
  webDist: process.env.WEB_DIST ?? fileURLToPath(new URL("../../web/dist", import.meta.url)),
  stateFile: process.env.TRIX_STATE_FILE || undefined,
  maxRooms: Number(process.env.TRIX_MAX_ROOMS ?? 200),
});
log("info", "server.listening", { url: `http://${host}:${app.port}`, port: app.port, speed, stateFile: process.env.TRIX_STATE_FILE || null, rooms: app.hub.rooms.size });

let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    log("info", "server.stopping", { signal });
    app.close().then(
      () => process.exit(0),
      (e) => {
        log("error", "server.stopFailed", { error: e });
        process.exit(1);
      },
    );
  });
}
