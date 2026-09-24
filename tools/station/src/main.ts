// The testing station: starts a server, runs the scenarios, writes a report.
//
//   npm run station                         all scenarios
//   npm run station -- --only S01,S14       some of them (security: --only X01,X02,…)
//   npm run station -- --tables 40 --speed 20 --seed 7
//   npm run station -- --base http://127.0.0.1:8080   against a running server (no server log analysis)
//   npm run station -- --server-js path/to/server.js  against another server build (used by mutants.ts)

import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SCENARIOS as BASE, type Outcome } from "./scenarios";
import { SECURITY } from "./security";

const SCENARIOS = [...BASE, ...SECURITY];
import type { Ctx } from "./table";

const args = process.argv.slice(2);
const opt = (name: string, def: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1]! : def);
const only = opt("only", "").split(",").filter(Boolean);
const speed = Number(opt("speed", "20"));
const seed = Number(opt("seed", String(Date.now() % 100000)));
const tables = Number(opt("tables", "25"));
const base = opt("base", "");
const serverJs = opt("server-js", "");
const root = resolve(import.meta.dirname, "../../..");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = resolve(opt("out", join(root, ".station-runs", stamp)));
mkdirSync(join(dir, "clients"), { recursive: true });
process.env.STATION_SPEED = String(speed);

const serverLog = createWriteStream(join(dir, "server.log"));
let serverPort = 0;
// Never leave a test server behind: when the station ends or is killed (Ctrl-C, a timeout), so does its server.
const servers = new Set<ChildProcess>();
process.on("exit", () => servers.forEach((p) => p.kill("SIGKILL")));
for (const sig of ["SIGTERM", "SIGINT"] as const) process.on(sig, () => process.exit(130));
async function startServer(): Promise<{ proc: ChildProcess | null; http: string }> {
  if (base) return { proc: null, http: base };
  const log = serverLog;
  const proc = spawn(process.execPath, [serverJs || join(root, "apps/server/dist/index.js")], {
    // Rooms are saved to the run folder, so a restart (S24) brings them back, as in production.
    env: { ...process.env, PORT: String(serverPort), TRIX_SPEED: String(speed), TRIX_LOG_LEVEL: "debug", TRIX_STATE_FILE: join(dir, "rooms.json"),
      // As in production behind Caddy: client addresses from X-Forwarded-For, and only our own site may connect.
      TRIX_TRUST_PROXY: "1", TRIX_ORIGINS: "https://trix.test" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  servers.add(proc);
  proc.on("exit", () => servers.delete(proc));
  proc.stderr!.on("data", (d: Buffer) => log.write(d));
  return new Promise((ok, fail) => {
    let buf = "";
    proc.stdout!.on("data", (d: Buffer) => {
      log.write(d);
      buf += d.toString();
      const m = buf.match(/"event":"server.listening".*?"port":(\d+)/);
      if (m) {
        serverPort = Number(m[1]);
        ok({ proc, http: `http://127.0.0.1:${m[1]}` });
      }
    });
    proc.on("exit", (code) => fail(new Error(`server exited early with code ${code}`)));
    setTimeout(() => fail(new Error("server did not start")), 10_000);
  });
}

interface Result {
  id: string;
  title: string;
  group: string;
  expected: string;
  got: string;
  pass: boolean;
  checks: { ok: boolean; text: string }[];
  findings: { check: string; detail: string; where: string }[];
  errors: { code: string; sent: unknown; client: string }[];
  extra: string[];
  seconds: number;
}

async function runOne(ctx: Ctx, s: (typeof SCENARIOS)[number]): Promise<Result> {
  const started = Date.now();
  ctx.registry.length = 0;
  let outcome: Outcome;
  try {
    outcome = await Promise.race([
      s.run(ctx, { tables }),
      new Promise<never>((_, fail) => setTimeout(() => fail(new Error("scenario timed out after 10 minutes")), 600_000)),
    ]);
  } catch (e) {
    outcome = { got: `CRASHED: ${(e as Error).message}`, checks: [{ ok: false, text: "scenario ran to completion" }], tables: [] };
  }
  // Tables made during the scenario count even if it crashed before returning them.
  for (const t of ctx.registry) if (!outcome.tables.includes(t)) outcome.tables.push(t);
  const findings = outcome.tables.flatMap((t) => t.allFindings());
  const errors = outcome.tables.flatMap((t) =>
    t.clients.flatMap((c) =>
      c
        .unexpectedErrors()
        .filter((e) => !(e.unsolicited && s.expectsNotices?.includes(e.code)))
        .map((e) => ({ code: e.code, sent: e.sent, client: c.name })),
    ),
  );
  await Promise.all(outcome.tables.map((t) => t.close()));
  const pass = outcome.checks.every((c) => c.ok) && findings.length === 0 && errors.length === 0;
  return {
    id: s.id,
    title: s.title,
    group: s.group,
    expected: s.expected,
    got: outcome.got,
    pass,
    checks: outcome.checks,
    findings,
    errors,
    extra: outcome.extra ?? [],
    seconds: (Date.now() - started) / 1000,
  };
}

function serverLogSummary(): string[] {
  if (base) return ["(ran against an existing server: no server log)"];
  const lines = readFileSync(join(dir, "server.log"), "utf8").split("\n").filter(Boolean);
  const byLevel: Record<string, number> = {};
  const byEvent: Record<string, number> = {};
  const errors: string[] = [];
  for (const l of lines) {
    try {
      const j = JSON.parse(l);
      byLevel[j.level] = (byLevel[j.level] ?? 0) + 1;
      byEvent[`${j.level} ${j.event}`] = (byEvent[`${j.level} ${j.event}`] ?? 0) + 1;
      if (j.level === "error") errors.push(l.slice(0, 400));
    } catch {
      errors.push(`(not JSON) ${l.slice(0, 200)}`);
    }
  }
  const out = [`${lines.length} lines: ${Object.entries(byLevel).map(([k, v]) => `${k} ${v}`).join(", ")}`, "", "| level + event | count |", "|---|---|"];
  for (const [k, v] of Object.entries(byEvent).sort((a, b) => b[1] - a[1])) out.push(`| ${k} | ${v} |`);
  if (errors.length) out.push("", "Error lines (first 20):", "```", ...errors.slice(0, 20), "```");
  return out;
}

function group<T>(xs: T[], key: (x: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return [...m.entries()];
}

function report(results: Result[], http: string, totalSecs: number): string {
  const passed = results.filter((r) => r.pass).length;
  const out: string[] = [
    `# Testing station report`,
    "",
    `- Run: ${stamp} · seed ${seed} · speed ×${speed} · ${tables} tables in the stress case · ${totalSecs.toFixed(0)} s`,
    `- Server: ${http} · logs: \`server.log\` and \`clients/*.jsonl\` in this folder`,
    `- **${passed}/${results.length} scenarios passed**`,
    "",
    "| | ID | Scenario | Got |",
    "|---|---|---|---|",
    ...results.map((r) => `| ${r.pass ? "✅" : "❌"} | ${r.id} | ${r.title} | ${r.got.replace(/\|/g, "/")} |`),
    "",
  ];
  for (const r of results) {
    out.push(`## ${r.pass ? "✅" : "❌"} ${r.id}: ${r.title}`, "", `*${r.group} · ${r.seconds.toFixed(1)} s*`, "", `**Expected:** ${r.expected}`, "", `**Got:** ${r.got}`, "");
    out.push("Checks:", ...r.checks.map((c) => `- ${c.ok ? "✅" : "❌"} ${c.text}`), "");
    if (r.extra.length) out.push("Details:", ...r.extra.map((e) => `- ${e}`), "");
    if (r.findings.length) {
      out.push(`Referee findings (${r.findings.length}):`);
      for (const [k, fs] of group(r.findings, (f) => f.check)) out.push(`- **${k}** ×${fs.length}: ${fs.slice(0, 3).map((f) => `${f.where}: ${f.detail}`).join(" · ")}`);
      out.push("");
    } else out.push("Referee findings: none", "");
    if (r.errors.length) {
      out.push(`Unexpected errors (a legal move refused, or an error out of nowhere) (${r.errors.length}):`);
      for (const [k, es] of group(r.errors, (e) => e.code)) out.push(`- **${k}** ×${es.length}: ${es.slice(0, 3).map((e) => `${e.client} sent ${JSON.stringify(e.sent)}`).join(" · ")}`);
      out.push("");
    } else out.push("Unexpected errors: none", "");
  }
  out.push("## Server log", "", ...serverLogSummary(), "");
  return out.join("\n");
}

const t0 = Date.now();
let { proc, http } = await startServer();
const ctx: Ctx = { httpUrl: http, wsUrl: http.replace(/^http/, "ws") + "/ws", dir: join(dir, "clients"), seed, stallMs: 5000, registry: [] };
if (proc) {
  ctx.serverLog = join(dir, "server.log");
  ctx.restartServer = async () => {
    const old = proc!;
    await new Promise((ok) => {
      old.removeAllListeners("exit");
      old.once("exit", ok);
      old.kill("SIGTERM"); // what systemd sends on a restart
    });
    ({ proc, http } = await startServer());
  };
}
console.log(`station: server ${http}, output ${dir}`);
const results: Result[] = [];
for (const s of SCENARIOS.filter((x) => !only.length || only.includes(x.id))) {
  process.stdout.write(`${s.id} ${s.title} … `);
  const r = await runOne(ctx, s);
  results.push(r);
  console.log(`${r.pass ? "PASS" : "FAIL"} (${r.seconds.toFixed(1)} s) ${r.pass ? "" : `— ${r.got}`}`);
}
proc?.kill();
await new Promise((r) => setTimeout(r, 300));
const md = report(results, http, (Date.now() - t0) / 1000);
writeFileSync(join(dir, "report.md"), md);
writeFileSync(join(dir, "results.json"), JSON.stringify(results, null, 2));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed. Report: ${join(dir, "report.md")}`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
