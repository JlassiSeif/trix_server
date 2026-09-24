// Connection flows in real browsers: friends joining by link, network drops, closed tabs,
// a full table, kicks, two tabs on one seat, owner controls, server restarts.
// Starts its own server. Each case prints PASS/FAIL with what was expected and what happened.
//
//   npm run build && node platform/web/e2e/connections.mjs [OUT_DIR] [--only C1,C2]
// Set CHROMIUM=/path/to/chrome to use a specific Chromium build.

import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = resolve(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : join(root, ".station-runs", "connections"));
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const stateFile = join(out, "rooms.json");

// ---------------------------------------------------------------- server (restartable)
let server = null;
let serverPort = 0;
const serverLog = [];
async function startServer() {
  const proc = spawn(process.execPath, [join(root, "platform/server/dist/index.js")], {
    env: { ...process.env, PORT: String(serverPort || 0), TRIX_SPEED: "10", TRIX_LOG_LEVEL: "info", TRIX_STATE_FILE: stateFile, TRIX_TRUST_PROXY: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server = proc;
  await new Promise((ok, fail) => {
    const onData = (d) => {
      for (const line of d.toString().split("\n").filter(Boolean)) {
        serverLog.push(line);
        const m = line.match(/"event":"server.listening".*?"port":(\d+)/);
        if (m) {
          serverPort = Number(m[1]);
          ok();
        }
      }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("exit", (c) => fail(new Error(`server exited (${c})`)));
    setTimeout(() => fail(new Error("server did not start")), 10_000);
  });
}
async function stopServer(signal = "SIGTERM") {
  const p = server;
  if (!p || p.exitCode !== null) return;
  await new Promise((ok) => {
    p.once("exit", ok);
    p.kill(signal);
  });
}

// ---------------------------------------------------------------- a cuttable network path
// The "friend" browser reaches the server through this proxy; cutting it is a real network drop.
function makeProxy() {
  const sockets = new Set();
  let up = true;
  const srv = net.createServer((client) => {
    if (!up) return client.destroy();
    const upstream = net.connect(serverPort, "127.0.0.1");
    client.pipe(upstream).pipe(client);
    for (const s of [client, upstream]) {
      sockets.add(s);
      s.on("close", () => sockets.delete(s));
      s.on("error", () => s.destroy());
    }
  });
  return new Promise((ok) =>
    srv.listen(0, "127.0.0.1", () =>
      ok({
        port: srv.address().port,
        cut() {
          up = false;
          for (const s of sockets) s.destroy();
        },
        restore() {
          up = true;
        },
        close: () => srv.close(),
      }),
    ),
  );
}

// ---------------------------------------------------------------- browser helpers
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const pageErrors = [];
// Every browser gets its own address, as real friends do: the server's per-address limits
// (5 tables, 20 connections, the join lockout) would otherwise add up across all cases.
let players = 0;
async function newPlayer(label, port = serverPort) {
  const n = ++players;
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { "x-forwarded-for": `10.0.${n >> 8}.${n & 255}` },
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(`${label}: ${e.message}`));
  page.base = `http://127.0.0.1:${port}`;
  page.label = label;
  return page;
}
async function createTable(page, name) {
  await page.goto(page.base + "/trix");
  await page.fill("#name", name);
  await page.click("text=Create a table");
  await page.waitForSelector(".lobby");
  const link = await page.inputValue(".invite input");
  return new URL(link).pathname + new URL(link).search;
}
async function joinByLink(page, path, name) {
  await page.goto(page.base + path);
  await page.fill("#name", name);
  await page.click("text=Take a seat");
}
const text = (page) => page.locator("body").innerText();
async function waitText(page, needle, ms = 10_000) {
  await page.waitForFunction((n) => document.body.innerText.includes(n), needle, { timeout: ms });
}
async function addBots(page, n) {
  for (let i = 0; i < n; i++) await page.click('button:has-text("Add a bot")');
}
const shot = (page, name) => page.screenshot({ path: join(out, `${name}.png`) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Play my turns (pick the first contract, first legal card, Continue) for a while. */
async function autoplay(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if (await page.locator(".picker").count()) await page.locator(".contract-tile:not([disabled])").first().click({ timeout: 500 });
      else if (await page.locator(".hand .card.legal").count()) await page.locator(".hand .card.legal").first().click({ timeout: 500 });
      else if (await page.locator('.summary button:has-text("Continue"):not([disabled])').count()) await page.click('.summary button:has-text("Continue")', { timeout: 500 });
    } catch {
      // the page moved on while we clicked: fine
    }
    await sleep(120);
  }
}
const handOf = (page) => page.locator(".hand .card").evaluateAll((els) => els.map((e) => e.alt).join(" "));
const countLog = (event) => serverLog.filter((l) => l.includes(`"event":"${event}"`)).length;

// ---------------------------------------------------------------- cases
const results = [];
async function runCase(id, title, expected, fn) {
  if (only && !only.includes(id)) return;
  const started = Date.now();
  const errBefore = pageErrors.length;
  let got = "";
  let pass = false;
  try {
    ({ got, pass } = await fn());
  } catch (e) {
    got = `CRASHED: ${e.message.split("\n")[0]}`;
  }
  if (pageErrors.length > errBefore) {
    pass = false;
    got += ` · page errors: ${pageErrors.slice(errBefore).join("; ")}`;
  }
  results.push({ id, title, expected, got, pass, secs: (Date.now() - started) / 1000 });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${title}\n     expected: ${expected}\n     got:      ${got}`);
}

await startServer();

await runCase("C1", "A friend joins through the invite link", "The friend opens the link in their own browser, picks a name, and both see each other; with 2 bots the game starts for both.", async () => {
  const owner = await newPlayer("owner");
  const friend = await newPlayer("friend");
  const link = await createTable(owner, "Seif");
  await joinByLink(friend, link, "Ali");
  await waitText(owner, "Ali");
  await addBots(owner, 2);
  await owner.waitForSelector(".table-screen");
  await friend.waitForSelector(".table-screen");
  await shot(friend, "C1-friend-at-table");
  const ownerSees = (await text(owner)).includes("Ali");
  const friendSees = (await text(friend)).includes("Seif");
  await owner.context().close();
  await friend.context().close();
  return { pass: ownerSees && friendSees, got: `owner sees Ali: ${ownerSees}; friend sees Seif: ${friendSees}; game started for both` };
});

await runCase("C2", "Network drop and recovery", "When the friend's network drops, their page says it is reconnecting and the owner's table pauses, waiting for them. When the network comes back, the friend's page rejoins the same seat by itself and the game resumes.", async () => {
  const proxy = await makeProxy();
  const owner = await newPlayer("owner");
  const friend = await newPlayer("friend", proxy.port);
  const link = await createTable(owner, "Seif");
  await joinByLink(friend, link, "Ali");
  await waitText(owner, "Ali");
  await addBots(owner, 2);
  await friend.waitForSelector(".table-screen");
  const handBefore = await handOf(friend);
  proxy.cut();
  await friend.waitForSelector(".offline", { timeout: 10_000 });
  const friendSaw = await friend.locator(".offline").innerText();
  await owner.waitForSelector(".paused", { timeout: 40_000 }); // heartbeat notices within ~30 s
  const ownerSaw = await owner.locator(".paused").innerText();
  await shot(owner, "C2-owner-paused");
  await shot(friend, "C2-friend-offline");
  proxy.restore();
  await friend.waitForSelector(".offline", { state: "detached", timeout: 15_000 });
  await owner.waitForSelector(".paused", { state: "detached", timeout: 15_000 });
  const handAfter = await handOf(friend);
  await shot(friend, "C2-friend-back");
  await owner.context().close();
  await friend.context().close();
  proxy.close();
  const ok = friendSaw.includes("Reconnecting") && ownerSaw.includes("Ali") && handAfter === handBefore;
  return { pass: ok, got: `friend saw "${friendSaw}"; owner saw "${ownerSaw.split("\n").slice(0, 2).join(" / ")}"; same hand after return: ${handAfter === handBefore}` };
});

await runCase("C3", "Friend closes the tab and opens the link again", "Reopening the room address in the same browser puts them straight back in their seat with the same cards.", async () => {
  const owner = await newPlayer("owner");
  const friend = await newPlayer("friend");
  const link = await createTable(owner, "Seif");
  await joinByLink(friend, link, "Ali");
  await waitText(owner, "Ali");
  await addBots(owner, 2);
  await friend.waitForSelector(".table-screen");
  const url = friend.url();
  const hand = await handOf(friend);
  const ctx = friend.context();
  await friend.close();
  await owner.waitForSelector(".paused", { timeout: 10_000 });
  const again = await ctx.newPage();
  again.on("pageerror", (e) => pageErrors.push(`friend2: ${e.message}`));
  await again.goto(url);
  await again.waitForSelector(".table-screen", { timeout: 10_000 });
  const same = (await handOf(again)) === hand;
  await owner.waitForSelector(".paused", { state: "detached", timeout: 10_000 });
  await owner.context().close();
  await ctx.close();
  return { pass: same, got: `back at the table: yes; same cards: ${same}; owner's table resumed` };
});

await runCase("C4", "A fifth person opens the invite link of a full table", "With 4 people seated, the fifth sees a clear 'The table is full' message and no seat changes.", async () => {
  const owner = await newPlayer("owner");
  const link = await createTable(owner, "Seif");
  const others = [];
  for (const name of ["Ali", "Sami", "Nour"]) {
    const p = await newPlayer(name);
    await joinByLink(p, link, name);
    others.push(p);
  }
  await owner.waitForSelector(".table-screen");
  const fifth = await newPlayer("fifth");
  await joinByLink(fifth, link, "Late");
  await waitText(fifth, "full", 5000).catch(() => undefined);
  const saw = await text(fifth);
  await shot(fifth, "C4-fifth-person");
  const ok = saw.includes("The table is full") && (await owner.locator(".lb-name").allInnerTexts()).every((n) => !n.includes("Late"));
  for (const p of [owner, fifth, ...others]) await p.context().close();
  return { pass: ok, got: saw.includes("The table is full") ? 'saw "The table is full"; nobody replaced' : `saw: ${saw.slice(0, 200)}` };
});

await runCase("C4b", "A late friend opens the link while bots fill the table", "They take over a bot's seat and its cards (R-TABLE-10), and play on.", async () => {
  const owner = await newPlayer("owner");
  const link = await createTable(owner, "Seif");
  await addBots(owner, 3);
  await owner.waitForSelector(".table-screen");
  const late = await newPlayer("late");
  await joinByLink(late, link, "Late");
  await late.waitForSelector(".table-screen", { timeout: 10_000 });
  const cards = (await handOf(late)).split(" ").filter(Boolean).length;
  const names = await owner.locator(".lb-name").allInnerTexts();
  const bots = names.filter((n) => / bot( \d)?$/i.test(n.trim())).length;
  for (const p of [owner, late]) await p.context().close();
  return { pass: cards > 0 && bots === 2 && names.some((n) => n.includes("Late")), got: `seated with ${cards} cards; table now has ${bots} bots and Late` };
});

await runCase("C5", "Kick, dead old link, replacement", "The kicked friend is told they were removed; the old link then says it is no longer valid; a new person with the new link takes the seat.", async () => {
  const owner = await newPlayer("owner");
  const friend = await newPlayer("friend");
  const link = await createTable(owner, "Seif");
  await joinByLink(friend, link, "Ali");
  await waitText(owner, "Ali");
  await addBots(owner, 2);
  await friend.waitForSelector(".table-screen");
  await owner.click('.lb-row:has-text("Ali") button[title^="Remove"]');
  await waitText(friend, "removed you", 5000);
  const kickedSaw = "removed you";
  await owner.waitForSelector(".paused");
  const newLink = await owner.inputValue(".paused .invite input");
  await friend.goto(friend.base + link);
  await friend.fill("#name", "Ali again");
  await friend.click("text=Take a seat");
  await waitText(friend, "no longer valid", 5000).catch(() => undefined);
  const oldLinkSaw = (await text(friend)).includes("no longer valid");
  const repl = await newPlayer("replacement");
  await repl.goto(new URL(newLink).href.replace(/^http:\/\/[^/]+/, repl.base));
  await repl.fill("#name", "Sami");
  await repl.click("text=Take a seat");
  await repl.waitForSelector(".table-screen", { timeout: 10_000 });
  const cards = (await handOf(repl)).split(" ").filter(Boolean).length;
  await owner.waitForSelector(".paused", { state: "detached", timeout: 10_000 });
  await shot(repl, "C5-replacement");
  for (const p of [owner, friend, repl]) await p.context().close();
  return { pass: oldLinkSaw && cards > 0, got: `kicked friend told "${kickedSaw}"; old link refused: ${oldLinkSaw}; replacement seated with ${cards} cards; game resumed` };
});

await runCase("C6", "Same seat opened in two tabs", "The older tab says the seat is open in another tab and stops; the newer tab plays. The two tabs must not keep taking the seat from each other.", async () => {
  const owner = await newPlayer("owner");
  const link = await createTable(owner, "Seif");
  await addBots(owner, 3);
  await owner.waitForSelector(".table-screen");
  const reconnectsBefore = countLog("seat.reconnected");
  const tab2 = await owner.context().newPage();
  tab2.on("pageerror", (e) => pageErrors.push(`tab2: ${e.message}`));
  await tab2.goto(owner.url());
  await tab2.waitForSelector(".table-screen", { timeout: 10_000 });
  await sleep(6000);
  const takeovers = countLog("seat.reconnected") - reconnectsBefore;
  const oldTab = await text(owner);
  await shot(owner, "C6-old-tab");
  await owner.context().close();
  return {
    pass: takeovers <= 2 && oldTab.includes("another tab"),
    got: `seat changed hands ${takeovers} times in 6 s; old tab says "another tab": ${oldTab.includes("another tab")}`,
  };
});

await runCase("C7", "Owner plays on with a bot from the pause screen, friend returns", "With the friend gone, the owner sees 'Game paused' with buttons; 'Play on with a bot' resumes the game; when the friend comes back they get their seat back.", async () => {
  const owner = await newPlayer("owner");
  const friend = await newPlayer("friend");
  const link = await createTable(owner, "Seif");
  await joinByLink(friend, link, "Ali");
  await waitText(owner, "Ali");
  await addBots(owner, 2);
  await friend.waitForSelector(".table-screen");
  const url = friend.url();
  const ctx = friend.context();
  await friend.close();
  await owner.waitForSelector(".paused");
  await shot(owner, "C7-owner-pause-screen");
  await owner.click('button:has-text("Play on with a bot")');
  await owner.waitForSelector(".paused", { state: "detached" });
  await waitText(owner, "bot playing", 5000);
  await autoplay(owner, 4000);
  const back = await ctx.newPage();
  await back.goto(url);
  await back.waitForSelector(".table-screen");
  await sleep(500);
  const stillBot = (await text(owner)).includes("bot playing");
  await owner.context().close();
  await ctx.close();
  return { pass: !stillBot, got: `game resumed with a bot; friend back in control: ${!stillBot}` };
});

await runCase("C8", "Leaving needs a confirmation", "Clicking 'Leave the table' asks first (leaving gives the seat away for good); cancelling keeps you seated.", async () => {
  const owner = await newPlayer("owner");
  await createTable(owner, "Seif");
  await addBots(owner, 3);
  await owner.waitForSelector(".table-screen");
  await owner.click('button:has-text("Leave the table")');
  await sleep(300);
  const asked = (await text(owner)).includes("for good");
  await shot(owner, "C8-leave-confirm");
  if (asked) await owner.click('button:has-text("Stay")');
  await sleep(300);
  const stillSeated = await owner.locator(".table-screen").count();
  await owner.context().close();
  return { pass: asked && stillSeated === 1, got: `asked first: ${asked}; still seated after cancelling: ${stillSeated === 1}` };
});

await runCase("C11", "The owner hands ownership to a friend", "The owner clicks the crown next to a connected friend; the friend is told they are now the owner and gets the owner's controls (invite link, remove, crown).", async () => {
  const owner = await newPlayer("owner");
  const friend = await newPlayer("friend");
  const link = await createTable(owner, "Seif");
  await joinByLink(friend, link, "Ali");
  await waitText(owner, "Ali");
  await addBots(owner, 2);
  await friend.waitForSelector(".table-screen");
  await owner.click('.lb-row:has-text("Ali") button[title^="Make Ali"]');
  await waitText(friend, "You are now the table owner", 5000);
  await shot(friend, "C11-friend-now-owner");
  const friendHasControls = (await friend.locator('button[title^="Remove"]').count()) > 0;
  const ownerLostControls = (await owner.locator('button[title^="Remove"]').count()) === 0;
  await owner.context().close();
  await friend.context().close();
  return { pass: friendHasControls && ownerLostControls, got: `friend told and has the owner's controls: ${friendHasControls}; old owner's controls gone: ${ownerLostControls}` };
});

await runCase("C12", "The owner disappears", "The owner closes their tab. The table pauses; after the hand-over time (30 s, 3 s at test speed) the friend becomes owner, gets 'Play on with a bot', and the game goes on.", async () => {
  const owner = await newPlayer("owner");
  const friend = await newPlayer("friend");
  const link = await createTable(owner, "Seif");
  await joinByLink(friend, link, "Ali");
  await waitText(owner, "Ali");
  await addBots(owner, 2);
  await friend.waitForSelector(".table-screen");
  await owner.context().close();
  await friend.waitForSelector(".paused", { timeout: 10_000 });
  const before = (await friend.locator('.paused button:has-text("Play on with a bot")').count()) > 0;
  await waitText(friend, "You are now the table owner", 10_000);
  await friend.waitForSelector('.paused button:has-text("Play on with a bot")', { timeout: 5000 });
  await shot(friend, "C12-friend-took-over");
  await friend.click('.paused button:has-text("Play on with a bot")');
  await friend.waitForSelector(".paused", { state: "detached", timeout: 5000 });
  await autoplay(friend, 3000);
  const playing = (await friend.locator(".paused").count()) === 0;
  await friend.context().close();
  return { pass: !before && playing, got: `controls before hand-over: ${before}; friend became owner and resumed with a bot: ${playing}` };
});

await runCase("C13", "HTML and script in player names", "Names are shown as plain text everywhere: no markup is rendered and no script runs.", async () => {
  const owner = await newPlayer("owner");
  const friend = await newPlayer("friend");
  const link = await createTable(owner, '<i>it</i>&amp;"');
  await joinByLink(friend, link, "<script>x()</script>");
  await waitText(owner, "<script>x()</script>");
  await addBots(owner, 2);
  await friend.waitForSelector(".table-screen");
  await autoplay(friend, 1500);
  const literal = (await text(friend)).includes('<i>it</i>&amp;"') && (await text(owner)).includes("<script>x()</script>");
  const injected = await friend.evaluate(() => document.querySelectorAll(".table-screen i, .table-screen script, .lobby i").length);
  await shot(friend, "C13-names-as-text");
  await owner.context().close();
  await friend.context().close();
  return { pass: literal && injected === 0, got: `names shown literally: ${literal}; markup elements created from names: ${injected}` };
});

await runCase("C14", "Play against bots", "On the first screen, a name and one tap on a level (here Hard) starts a game at once against three bots of that level, named after it; the game plays.", async () => {
  const me = await newPlayer("solo");
  await me.goto(me.base + "/trix");
  await me.fill("#name", "Seif");
  await shot(me, "C14-entry");
  await me.click(".solo-level.hard");
  await me.waitForSelector(".table-screen", { timeout: 10_000 });
  await waitText(me, "Hard bot 3");
  const handBefore = await handOf(me);
  await autoplay(me, 4000);
  const moved = (await handOf(me)) !== handBefore || (await me.locator(".contract-no").innerText()) !== "Contract 1 / 28";
  const names = await me.locator(".lb-name").allInnerTexts();
  await shot(me, "C14-solo-table");
  await me.context().close();
  const bots = ["Hard bot", "Hard bot 2", "Hard bot 3"].every((n) => names.some((x) => x.startsWith(n)));
  return { pass: bots && moved, got: `leaderboard: ${names.join(", ")}; the game moved on: ${moved}` };
});

await runCase("C15", "Choosing the bots' level in the lobby", "The owner picks a level above the seats; each Add a bot uses the level chosen at that moment.", async () => {
  const owner = await newPlayer("owner");
  await createTable(owner, "Seif");
  await owner.click('.levels button:has-text("Easy")');
  await owner.click('button:has-text("Add a bot")');
  await waitText(owner, "Easy bot");
  await owner.click('.levels button:has-text("Hard")');
  await owner.click('button:has-text("Add a bot")');
  await waitText(owner, "Hard bot");
  await shot(owner, "C15-lobby-levels");
  const seats = await owner.locator(".lobby-seat strong").allInnerTexts();
  await owner.context().close();
  const ok = seats.includes("Easy bot") && seats.includes("Hard bot");
  return { pass: ok, got: `seats: ${seats.join(", ")}` };
});

await runCase("C16", "The hub: pick a game", "The home page lists the games (Trix playable, the others coming soon); Trix opens its own page; the browser's back button returns to the list; the game list says Trix is open.", async () => {
  const p = await newPlayer("hub");
  await p.goto(p.base);
  await p.waitForSelector(".game-tile");
  const tiles = await p.locator(".game-tile strong").allInnerTexts();
  const soon = await p.locator(".game-tile.soon").count();
  await shot(p, "C16-home");
  await p.click('.game-tile:has-text("Trix")');
  await p.waitForSelector("#name");
  const onTrix = new URL(p.url()).pathname === "/trix" && (await text(p)).includes("Create a table");
  await p.goBack();
  await p.waitForSelector(".game-tile");
  const backHome = new URL(p.url()).pathname === "/";
  const list = await p.evaluate(() => fetch("/api/games").then((r) => r.json()));
  await p.context().close();
  const ok = tiles[0] === "Trix" && soon > 3 && onTrix && backHome && list[0]?.id === "trix" && list[0]?.open === true;
  return { pass: ok, got: `tiles: ${tiles.slice(0, 4).join(", ")}…; coming soon: ${soon}; Trix page: ${onTrix}; back to the list: ${backHome}; /api/games: ${JSON.stringify(list)}` };
});

await runCase("C9", "Server restarts in the middle of a game", "After a restart (every deploy is one) the players' pages reconnect by themselves, and the game carries on where it was: same contract, same cards.", async () => {
  const owner = await newPlayer("owner");
  const friend = await newPlayer("friend");
  const link = await createTable(owner, "Seif");
  await joinByLink(friend, link, "Ali");
  await waitText(owner, "Ali");
  await addBots(owner, 2);
  await friend.waitForSelector(".table-screen");
  await Promise.all([autoplay(owner, 2500), autoplay(friend, 2500)]);
  const before = { hand: await handOf(friend), contract: await friend.locator(".contract-no").innerText() };
  const rejoinsBefore = countLog("seat.reconnected");
  await stopServer("SIGTERM");
  await friend.waitForSelector(".offline", { timeout: 10_000 });
  await startServer();
  await friend.waitForSelector(".offline", { state: "detached", timeout: 20_000 });
  await friend.waitForSelector(".table-screen", { timeout: 10_000 });
  await sleep(800);
  const after = { hand: await handOf(friend), contract: await friend.locator(".contract-no").innerText().catch(() => "?") };
  const rejoined = countLog("seat.reconnected") - rejoinsBefore;
  // Not a frozen picture: the game must actually move on after the restart.
  const moved = await Promise.race([
    (async () => {
      await Promise.all([autoplay(owner, 4000), autoplay(friend, 4000)]);
      return (await handOf(friend)) !== after.hand || (await friend.locator(".contract-no").innerText()) !== after.contract;
    })(),
  ]);
  await shot(friend, "C9-after-restart");
  await owner.context().close();
  await friend.context().close();
  const same = after.hand === before.hand && after.contract === before.contract;
  return { pass: same && rejoined >= 2 && moved, got: `same contract and cards after restart: ${same}; both players rejoined: ${rejoined >= 2} (${rejoined}); game moved on afterwards: ${moved}` };
});

await runCase("C10", "Server restarts and its saved rooms are lost", "The players' pages don't freeze on the old table: they say the table doesn't exist any more and offer to create a new one.", async () => {
  const owner = await newPlayer("owner");
  await createTable(owner, "Seif");
  await addBots(owner, 3);
  await owner.waitForSelector(".table-screen");
  await stopServer("SIGTERM");
  rmSync(stateFile, { force: true });
  await startServer();
  await waitText(owner, "doesn't exist any more", 20_000).catch(() => undefined);
  const saw = await text(owner);
  await shot(owner, "C10-table-gone");
  const frozen = (await owner.locator(".table-screen").count()) > 0;
  await owner.context().close();
  return { pass: saw.includes("doesn't exist any more") && !frozen && saw.includes("Create a table"), got: `page says the table is gone: ${saw.includes("doesn't exist any more")}; still showing the old table: ${frozen}` };
});

await browser.close();
await stopServer();
writeFileSync(join(out, "results.json"), JSON.stringify(results, null, 2));
writeFileSync(join(out, "server.log"), serverLog.join("\n") + "\n");
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed. Screenshots and logs: ${out}`);
process.exit(passed === results.length ? 0 : 1);
