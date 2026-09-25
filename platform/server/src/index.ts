// Trix server entry point: settings from the environment, clean shutdown on SIGTERM/SIGINT.
//
//   PORT              default 8080
//   HOST              default 127.0.0.1 (behind a reverse proxy); 0.0.0.0 to listen on all interfaces
//   TRIX_STATE_FILE   where rooms are saved, so a restart doesn't end games (recommended in production)
//   TRIX_MAX_ROOMS    default 200
//   TRIX_TRUST_PROXY  1 behind Caddy on the same machine: real client addresses from X-Forwarded-For;
//                     private: behind Caddy on a private (Docker) network, for a container with no published ports
//   TRIX_ORIGINS      comma-separated pages allowed to connect, e.g. https://trix.example.com
//   TRIX_LOG_LEVEL    debug | info (default) | warn | error | silent
//   WEB_DIST          the built web app (default platform/web/dist)
//   TRIX_CLOSED_GAMES comma-separated game ids switched off: no new tables, running ones finish
//   TRIX_SPEED        tests only: bots and countdowns N times faster
//   Accounts (optional): FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_PATH (production key),
//   FIREBASE_AUTH_EMULATOR_HOST + FIRESTORE_EMULATOR_HOST (local emulators), FIREBASE_AUTH_DOMAIN
//   (the domain the sign-in pop-up shows: dineri.world in production, behind Caddy)

import { fileURLToPath } from "node:url";
import { accountsFromEnv } from "./accounts";
import { startApp } from "./app";
import { log } from "./log";
import { TIMING } from "./room";

const speed = Number(process.env.TRIX_SPEED ?? 1);
if (speed > 1) TIMING.speed = speed;

process.on("uncaughtException", (e) => log("error", "process.uncaughtException", { error: e }));
process.on("unhandledRejection", (e) => log("error", "process.unhandledRejection", { error: e }));

const host = process.env.HOST ?? "127.0.0.1";
const app = await startApp({
  port: Number(process.env.PORT ?? 8080),
  host,
  // Both src/ (dev) and dist/ (prod) sit one level inside platform/server, so this is platform/web/dist.
  webDist: process.env.WEB_DIST ?? fileURLToPath(new URL("../../web/dist", import.meta.url)),
  stateFile: process.env.TRIX_STATE_FILE || undefined,
  maxRooms: Number(process.env.TRIX_MAX_ROOMS ?? 200),
  trustProxy: process.env.TRIX_TRUST_PROXY === "private" ? "private" : process.env.TRIX_TRUST_PROXY === "1",
  closedGames: (process.env.TRIX_CLOSED_GAMES ?? "").split(",").map((g) => g.trim()).filter(Boolean),
  accounts: accountsFromEnv(process.env),
  // Firebase's public web settings for the dineri-world project (public by design: security comes
  // from the database rules and the authorized domains, not from hiding these).
  firebaseWeb: {
    apiKey: process.env.FIREBASE_WEB_API_KEY || "AIzaSyB0R8CFytyPH1-tD8CrKCQSf9h8XR9y2PU",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "dineri-world.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "dineri-world",
    appId: process.env.FIREBASE_WEB_APP_ID || "1:605012986454:web:c4f8781b344d55dd0f09f7",
    ...(process.env.FIREBASE_AUTH_EMULATOR_HOST ? { authEmulator: `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}` } : {}),
  },
  allowedOrigins: process.env.TRIX_ORIGINS ? process.env.TRIX_ORIGINS.split(",").map((o) => o.trim()) : undefined,
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
