// The real server on a real port: HTTP headers, restarts with saved rooms, caps, rate limits.

import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import type { ServerMessage } from "@trix/protocol";
import { startApp, type App } from "../src/app";

const dir = mkdtempSync(join(tmpdir(), "trix-app-"));
const web = join(dir, "web");
mkdirSync(join(web, "assets"), { recursive: true });
mkdirSync(join(web, "cards"), { recursive: true });
writeFileSync(join(web, "index.html"), "<!doctype html><title>Trix</title>");
writeFileSync(join(web, "assets", "app-abc123.js"), "console.log(1)");
writeFileSync(join(web, "cards", "k_h.png"), "png");

const apps: App[] = [];
async function start(extra: Partial<Parameters<typeof startApp>[0]> = {}) {
  const app = await startApp({ port: 0, host: "127.0.0.1", webDist: web, ...extra });
  apps.push(app);
  return app;
}
afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
});

/** A minimal browser stand-in over a real WebSocket. */
class Client {
  inbox: ServerMessage[] = [];
  closeCode: number | null = null;
  private ws!: WebSocket;
  private waiters: (() => void)[] = [];
  static async open(port: number) {
    const c = new Client();
    c.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    c.ws.on("message", (d) => {
      c.inbox.push(JSON.parse(d.toString()));
      c.waiters.forEach((w) => w());
    });
    c.ws.on("close", (code) => {
      c.closeCode = code;
      c.waiters.forEach((w) => w());
    });
    await new Promise((ok, fail) => {
      c.ws.once("open", ok);
      c.ws.once("error", fail);
      c.ws.once("close", ok);
    });
    return c;
  }
  send(msg: object) {
    this.ws.send(JSON.stringify(msg));
  }
  sendRaw(s: string) {
    this.ws.send(s);
  }
  last<T extends ServerMessage["type"]>(type: T) {
    return [...this.inbox].reverse().find((m) => m.type === type) as Extract<ServerMessage, { type: T }> | undefined;
  }
  until(pred: () => boolean, ms = 3000): Promise<void> {
    return new Promise((ok, fail) => {
      const t = setTimeout(() => fail(new Error("timeout")), ms);
      const check = () => {
        if (pred()) {
          clearTimeout(t);
          ok();
        }
      };
      this.waiters.push(check);
      check();
    });
  }
  close() {
    this.ws.close();
  }
}

describe("HTTP", () => {
  it("serves the app with security headers, and caches only what never changes", async () => {
    const app = await start();
    const base = `http://127.0.0.1:${app.port}`;
    const page = await fetch(`${base}/`);
    expect(page.status).toBe(200);
    expect(page.headers.get("cache-control")).toBe("no-cache");
    expect(page.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(page.headers.get("referrer-policy")).toBe("no-referrer");
    expect(page.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await fetch(`${base}/assets/app-abc123.js`)).headers.get("cache-control")).toContain("immutable");
    expect((await fetch(`${base}/cards/k_h.png`)).headers.get("cache-control")).toBe("public, max-age=86400");
    const invite = await fetch(`${base}/r/abc123?i=xyz`);
    expect(await invite.text()).toContain("<title>Trix</title>");
    expect(invite.headers.get("cache-control")).toBe("no-cache");
    const escape = await fetch(`${base}/%2e%2e/%2e%2e/etc/passwd`);
    expect(await escape.text()).not.toContain("root:");
    expect(await (await fetch(`${base}/api/health`)).json()).toMatchObject({ ok: true });
    expect(await (await fetch(`${base}/api/stats`)).json()).toMatchObject({ rooms: 0, sockets: 0 });
  });
});

describe("restarts (every deploy is one)", () => {
  it("saves rooms, tells browsers to reconnect, and brings the game back after a restart", async () => {
    const stateFile = join(dir, "rooms-restart.json");
    const a = await start({ stateFile });
    const c = await Client.open(a.port);
    c.send({ type: "createRoom", name: "Seif" });
    await c.until(() => !!c.last("joined"));
    for (const seat of [1, 2, 3]) c.send({ type: "addBot", seat });
    await c.until(() => !!c.last("update")?.game);
    const { roomId, token, seat } = c.last("joined")!;
    const before = c.last("update")!.game!;

    await a.close();
    await c.until(() => c.closeCode !== null);
    expect(c.closeCode).toBe(1012); // "service restart": the browser reconnects by itself
    expect(existsSync(stateFile)).toBe(true);
    expect(statSync(stateFile).mode & 0o777).toBe(0o600); // seat tokens inside: owner-only

    const b = await start({ stateFile });
    expect(b.hub.rooms.size).toBe(1);
    const back = await Client.open(b.port);
    back.send({ type: "joinRoom", roomId, token });
    await back.until(() => !!back.last("update")?.game);
    expect(back.last("joined")!.seat).toBe(seat);
    const after = back.last("update")!.game!;
    expect(after.hand).toEqual(before.hand);
    expect(after.contractNo).toBe(before.contractNo);
    expect(back.last("update")!.room.status).toBe("playing");
    back.close();
  });

  it("starts empty (and keeps the bad file aside) if the saved state can't be read", async () => {
    const stateFile = join(dir, "rooms-broken.json");
    writeFileSync(stateFile, "{ this is not json");
    const app = await start({ stateFile });
    expect(app.hub.rooms.size).toBe(0);
    expect(readdirSync(dir).some((f) => f.startsWith("rooms-broken.json.broken-"))).toBe(true);
  });

  it("drops saved rooms nobody has touched for over 6 hours", async () => {
    const stateFile = join(dir, "rooms-old.json");
    const a = await start({ stateFile });
    const c = await Client.open(a.port);
    c.send({ type: "createRoom", name: "Seif" });
    await c.until(() => !!c.last("joined"));
    c.close();
    await a.close();
    const snap = JSON.parse((await import("node:fs")).readFileSync(stateFile, "utf8"));
    snap.rooms[0].lastActive = Date.now() - 7 * 60 * 60 * 1000;
    writeFileSync(stateFile, JSON.stringify(snap));
    const b = await start({ stateFile });
    expect(b.hub.rooms.size).toBe(0);
  });
});

describe("limits", () => {
  it("refuses new tables beyond the room cap", async () => {
    const app = await start({ maxRooms: 2 });
    const codes: string[] = [];
    for (let i = 0; i < 3; i++) {
      const c = await Client.open(app.port);
      c.send({ type: "createRoom", name: `p${i}` });
      await c.until(() => c.inbox.length > 0);
      codes.push(c.inbox[0]!.type === "error" ? (c.inbox[0] as { code: string }).code : "ok");
    }
    expect(codes).toEqual(["ok", "ok", "SERVER_FULL"]);
  });

  it("closes connections beyond the socket cap", async () => {
    const app = await start({ maxSockets: 2 });
    const a = await Client.open(app.port);
    const b = await Client.open(app.port);
    const c = await Client.open(app.port);
    await c.until(() => c.closeCode !== null);
    expect(c.closeCode).toBe(1013);
    expect(a.closeCode).toBeNull();
    expect(b.closeCode).toBeNull();
  });

  it("cuts off a flooding connection (1008) with a RATE_LIMITED notice", async () => {
    const app = await start({ rate: { perSecond: 5, burst: 10 } });
    const c = await Client.open(app.port);
    for (let i = 0; i < 50; i++) c.sendRaw("x");
    await c.until(() => c.closeCode !== null);
    expect(c.closeCode).toBe(1008);
    expect(c.inbox.some((m) => m.type === "error" && m.code === "RATE_LIMITED")).toBe(true);
  });
});
