// The real server on a real port: HTTP headers, restarts with saved rooms, caps, rate limits.

import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import type { GameEvent, PlayerView } from "@games/trix";
import type { ServerMessage as AnyMessage } from "@platform/protocol";

/** These tests play Trix, so its views and events are typed as Trix's. */
type ServerMessage = AnyMessage<PlayerView, GameEvent>;
import { isPrivate, startApp, type App } from "../src/app";
import { AccountError, TokenError, type Accounts, type Profile, type VerifiedUser } from "../src/accounts";

const dir = mkdtempSync(join(tmpdir(), "trix-app-"));
const web = join(dir, "web");
mkdirSync(join(web, "assets"), { recursive: true });
mkdirSync(join(web, "cards"), { recursive: true });
writeFileSync(join(web, "index.html"), "<!doctype html><title>Trix</title>");
writeFileSync(join(web, "assets", "app-abc123.js"), "console.log(1)");
writeFileSync(join(web, "cards", "k_h.png"), "png");
writeFileSync(join(web, "robots.txt"), "User-agent: *");
writeFileSync(join(web, "site.webmanifest"), "{}");

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
  handshakeStatus: number | null = null;
  static async open(port: number, opts: { ip?: string; origin?: string } = {}) {
    const c = new Client();
    c.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: opts.ip ? { "x-forwarded-for": opts.ip } : {}, ...(opts.origin ? { origin: opts.origin } : {}) });
    let opened: () => void = () => undefined;
    c.ws.on("unexpected-response", (req, res) => {
      // The server refused the handshake (e.g. a foreign origin): no open, no close event follows.
      c.handshakeStatus = res.statusCode ?? 0;
      c.closeCode = -1;
      req.destroy();
      opened();
      c.waiters.forEach((w) => w());
    });
    c.ws.on("message", (d) => {
      c.inbox.push(JSON.parse(d.toString()));
      c.waiters.forEach((w) => w());
    });
    c.ws.on("close", (code) => {
      c.closeCode = code;
      c.waiters.forEach((w) => w());
    });
    await new Promise<void>((ok) => {
      opened = ok;
      c.ws.once("open", () => ok());
      c.ws.once("error", () => ok());
      c.ws.once("close", () => ok());
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
    expect((await fetch(`${base}/robots.txt`)).headers.get("content-type")).toContain("text/plain");
    expect((await fetch(`${base}/site.webmanifest`)).headers.get("content-type")).toBe("application/manifest+json");
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

describe("security (see games/trix/station/src/security.ts for the full attack scenarios)", () => {
  it("per-address connection cap, using the proxy's address only when told to trust it", async () => {
    const app = await start({ trustProxy: true, maxSocketsPerIp: 3 });
    const mine = await Promise.all([1, 2, 3, 4].map(() => Client.open(app.port, { ip: "203.0.113.5" })));
    const other = await Client.open(app.port, { ip: "198.51.100.5" });
    await mine[3]!.until(() => mine[3]!.closeCode !== null);
    expect(mine[3]!.closeCode).toBe(1013);
    expect(other.closeCode).toBeNull();
    // Not behind a trusted proxy: a forged X-Forwarded-For changes nothing (everyone is 127.0.0.1 here).
    const plain = await start({ maxSocketsPerIp: 2 });
    const a = await Client.open(plain.port, { ip: "1.1.1.1" });
    const b = await Client.open(plain.port, { ip: "2.2.2.2" });
    const c = await Client.open(plain.port, { ip: "3.3.3.3" });
    await c.until(() => c.closeCode !== null);
    expect([a.closeCode, b.closeCode, c.closeCode]).toEqual([null, null, 1013]);
  });

  it('trusts a proxy on a private network with trustProxy "private" (Caddy on a Docker network)', async () => {
    for (const a of ["10.1.2.3", "172.19.0.2", "::ffff:172.31.255.1", "192.168.0.117", "127.0.0.1", "::1", "fd12:3456::1"])
      expect(isPrivate(a), a).toBe(true);
    for (const a of ["172.15.0.1", "172.32.0.1", "8.8.8.8", "::ffff:203.0.113.5", "2001:db8::1", "", undefined])
      expect(isPrivate(a), String(a)).toBe(false);
    // The test peer is 127.0.0.1, which counts as private: forwarded addresses are honoured.
    const app = await start({ trustProxy: "private", maxSocketsPerIp: 1 });
    const a = await Client.open(app.port, { ip: "203.0.113.5" });
    const b = await Client.open(app.port, { ip: "198.51.100.5" });
    const a2 = await Client.open(app.port, { ip: "203.0.113.5" });
    await a2.until(() => a2.closeCode !== null);
    expect([a.closeCode, b.closeCode, a2.closeCode]).toEqual([null, null, 1013]);
  });

  it("refuses game connections from other websites", async () => {
    const app = await start({ allowedOrigins: ["https://trix.example"] });
    const evil = await Client.open(app.port, { origin: "https://evil.example" });
    await evil.until(() => evil.closeCode !== null);
    expect(evil.handshakeStatus).toBe(401);
    const ours = await Client.open(app.port, { origin: "https://trix.example" });
    expect(ours.closeCode).toBeNull();
  });

  it("locks out an address after too many wrong links", async () => {
    const app = await start({ trustProxy: true, maxJoinFailures: 3 });
    const g = await Client.open(app.port, { ip: "203.0.113.9" });
    for (let i = 0; i < 5; i++) g.send({ type: "joinRoom", roomId: "nothere", invite: "x", name: "x" });
    await g.until(() => g.inbox.length >= 5);
    expect(g.inbox.map((m) => (m as { code: string }).code)).toEqual(["ROOM_NOT_FOUND", "ROOM_NOT_FOUND", "ROOM_NOT_FOUND", "TOO_MANY_ATTEMPTS", "TOO_MANY_ATTEMPTS"]);
  });

  it("rejects odd HTTP: other methods, broken addresses, NUL bytes; stats only from the machine itself", async () => {
    const app = await start({ trustProxy: true });
    const base = `http://127.0.0.1:${app.port}`;
    expect((await fetch(`${base}/`, { method: "POST" })).status).toBe(405);
    expect((await fetch(`${base}/%E0%A4%A`)).status).toBe(400);
    expect((await fetch(`${base}/index.html%00.png`)).status).toBe(400);
    expect((await fetch(`${base}/api/stats`, { headers: { "x-forwarded-for": "203.0.113.1" } })).status).toBe(404);
    expect((await fetch(`${base}/api/stats`)).status).toBe(200);
  });
});

/** Accounts without Firebase: the token "good-<uid>" is a signed-in player; profiles live in a Map. */
function fakeAccounts() {
  const profiles = new Map<string, Profile>();
  const verify = async (t: unknown): Promise<VerifiedUser> => {
    if (typeof t !== "string" || !t.startsWith("good-")) throw new TokenError("bad");
    return { uid: t.slice(5), email: `${t.slice(5)}@example.com`, name: null, provider: "password" };
  };
  const profile = async (u: VerifiedUser, lang?: unknown) => {
    if (!profiles.has(u.uid)) profiles.set(u.uid, { uid: u.uid, displayName: u.uid, language: lang === "fr" ? "fr" : "en", email: u.email, provider: u.provider, createdAt: "now" });
    return profiles.get(u.uid)!;
  };
  const update = async (u: VerifiedUser, patch: { displayName?: unknown }) => {
    if (patch.displayName === "") throw new AccountError("BAD_NAME", "Pick a name");
    const p = { ...(await profile(u)), ...(typeof patch.displayName === "string" ? { displayName: patch.displayName } : {}) };
    profiles.set(u.uid, p);
    return p;
  };
  const del = async (u: VerifiedUser) => void profiles.delete(u.uid);
  return { accounts: { verify, profile, update, delete: del } as unknown as Accounts, profiles };
}
const FIREBASE_WEB = { apiKey: "k", authDomain: "dineri.world", projectId: "dineri-world", appId: "a" };

describe("accounts (optional: guests play as before)", () => {
  it("without accounts, the page is told there is no sign-in, and the policy allows nothing extra", async () => {
    const app = await start({ firebaseWeb: FIREBASE_WEB });
    const base = `http://127.0.0.1:${app.port}`;
    const res = await fetch(`${base}/api/config`);
    expect(await res.json()).toEqual({ accounts: false, firebase: null });
    expect(res.headers.get("content-security-policy")).not.toContain("google");
    expect((await fetch(`${base}/api/me`, { headers: { authorization: "Bearer good-a" } })).status).toBe(404);
  });

  it("with accounts: the Firebase settings, Google's sign-in allowed, and your profile with your token", async () => {
    const { accounts, profiles } = fakeAccounts();
    const app = await start({ accounts, firebaseWeb: FIREBASE_WEB });
    const base = `http://127.0.0.1:${app.port}`;
    const config = await fetch(`${base}/api/config`);
    expect(await config.json()).toEqual({ accounts: true, firebase: FIREBASE_WEB });
    const csp = config.headers.get("content-security-policy")!;
    expect(csp).toContain("script-src 'self' https://apis.google.com");
    expect(csp).toContain("https://identitytoolkit.googleapis.com");
    expect(csp).toContain("frame-src 'self' https://dineri.world");

    const as = (token: string | null, init: RequestInit = {}) =>
      fetch(`${base}/api/me?lang=fr`, { ...init, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" } });
    expect((await as(null)).status).toBe(401);
    expect((await as("forged")).status).toBe(401);
    const me = await as("good-amel");
    expect(me.headers.get("cache-control")).toBe("no-store");
    expect(await me.json()).toMatchObject({ uid: "amel", displayName: "amel", language: "fr" });
    expect(await (await as("good-amel", { method: "PUT", body: JSON.stringify({ displayName: "Amel" }) })).json()).toMatchObject({ displayName: "Amel" });
    const bad = await as("good-amel", { method: "PUT", body: JSON.stringify({ displayName: "" }) });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: "BAD_NAME" });
    expect((await as("good-amel", { method: "PUT", body: "{not json" })).status).toBe(400);
    expect((await as("good-amel", { method: "PUT", body: JSON.stringify({ displayName: "x".repeat(5000) }) })).status).toBe(413);
    expect((await as("good-amel", { method: "POST", body: "{}" })).status).toBe(405);
    expect((await as("good-amel", { method: "DELETE" })).status).toBe(200);
    expect(profiles.has("amel")).toBe(false);
    // Other writes are still refused everywhere else.
    expect((await fetch(`${base}/lobby`, { method: "POST" })).status).toBe(405);
  });

  it("a signed-in player's seat remembers their account (saved, never shown to others); guests have none", async () => {
    const { accounts } = fakeAccounts();
    const stateFile = join(dir, "rooms-accounts.json");
    const app = await start({ accounts, firebaseWeb: FIREBASE_WEB, stateFile });
    const c = await Client.open(app.port);
    c.send({ type: "identify", idToken: "good-amel" });
    c.send({ type: "createRoom", name: "Amel" }); // sent at once: waits for the identify check
    await c.until(() => !!c.last("joined"));
    expect(c.inbox[0]).toEqual({ type: "identified", signedIn: true });
    const guest = await Client.open(app.port);
    guest.send({ type: "identify", idToken: "forged" });
    await guest.until(() => !!guest.last("identified"));
    expect(guest.last("identified")!.signedIn).toBe(false);

    // A page that learns who you are after you sat down (e.g. Firebase was still loading).
    const late = await Client.open(app.port);
    late.send({ type: "createRoom", name: "Sami" });
    await late.until(() => !!late.last("joined"));
    late.send({ type: "identify", idToken: "good-sami" });
    await late.until(() => !!late.last("identified"));
    expect(JSON.stringify(app.hub.rooms.get(late.last("joined")!.roomId))).toContain('"uid":"sami"');

    const room = app.hub.rooms.get(c.last("joined")!.roomId)!;
    const snap = JSON.stringify(room);
    expect(snap).toContain('"uid":"amel"');
    expect(JSON.stringify(c.inbox)).not.toContain("amel\"");
    expect(JSON.stringify(c.last("update"))).not.toContain('"uid"');
    c.close();
    guest.close();
    late.close();
  });
});
