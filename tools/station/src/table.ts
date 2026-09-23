// A table of simulated players, plus a monitor that compares what the four of them see.

import { join } from "node:path";
import { NORMAL, StationClient, type Policy } from "./client";
import { publicPart } from "./referee";

export interface Ctx {
  wsUrl: string;
  httpUrl: string;
  dir: string;
  seed: number;
  /** No message at all for this long while a game is running = the game is stuck. */
  stallMs: number;
  /** Every table created during the current scenario, so its findings survive a crash. */
  registry: Table[];
}

export interface TableFinding {
  check: string;
  detail: string;
  where: string;
}

let clientSeq = 0;

export function newClient(ctx: Ctx, name: string): StationClient {
  clientSeq++;
  return new StationClient(name, ctx.wsUrl, join(ctx.dir, `${name}.jsonl`), ctx.seed * 1000 + clientSeq);
}

export class Table {
  findings: TableFinding[] = [];
  /** Cross-player comparison only holds while all 4 have been connected throughout. */
  comparing = true;
  private watchdog: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly label: string,
    readonly ctx: Ctx,
    public clients: StationClient[],
  ) {}

  get owner(): StationClient {
    return this.clients.find((c) => c.room && c.room.owner === c.seat && !c.removed) ?? this.clients[0]!;
  }
  /** Clients still at the table. */
  get live(): StationClient[] {
    return this.clients.filter((c) => !c.removed);
  }

  static async create(ctx: Ctx, label: string, opts: { players?: number; bots?: number; policy?: Policy | null } = {}): Promise<Table> {
    const players = opts.players ?? 4;
    const bots = opts.bots ?? 4 - players;
    const policy = opts.policy === undefined ? NORMAL : opts.policy;
    const owner = newClient(ctx, `${label}-p0`);
    owner.policy = policy;
    await owner.connect();
    owner.send({ type: "createRoom", name: `${label}-p0` });
    await owner.waitFor(() => !!owner.room, 5000, "room created");
    const table = new Table(label, ctx, [owner]);
    ctx.registry.push(table);
    for (let i = 1; i < players; i++) {
      const c = newClient(ctx, `${label}-p${i}`);
      c.policy = policy;
      await c.connect();
      c.send({ type: "joinRoom", roomId: owner.roomId!, invite: table.invite(), name: c.name });
      await c.waitFor(() => !!c.room, 5000, "joined");
      table.clients.push(c);
    }
    table.startMonitor();
    // The owner's own view must show everyone seated before it picks empty seats for bots.
    await owner.waitFor(() => owner.room!.seats.filter((s) => s.kind === "human").length === players, 5000, "all players seated");
    for (let i = 0; i < bots; i++) {
      const empty = owner.room!.seats.findIndex((s) => s.kind === "empty");
      owner.send({ type: "addBot", seat: empty });
      await owner.waitFor(() => owner.room!.seats[empty]!.kind === "bot", 5000, "bot added");
    }
    return table;
  }

  invite(): string {
    const path = this.owner.room?.invitePath;
    if (!path) throw new Error(`${this.label}: owner has no invite link`);
    return new URL(path, "http://x").searchParams.get("i")!;
  }

  // -------------------------------------------------------------------------
  // Monitoring

  private startMonitor() {
    for (const c of this.clients) this.watch(c);
    this.watchdog = setInterval(() => this.checkStall(), 250);
  }

  watch(c: StationClient) {
    c.onUpdate = () => this.compare();
    c.onClose = () => {
      this.comparing = false; // someone dropped: update numbers no longer line up
    };
  }

  /** Update k of every player comes from the same server broadcast: compare them. */
  private compare() {
    if (!this.comparing || this.clients.length !== 4 || this.clients.some((c) => c.removed)) {
      for (const c of this.clients) c.inbox.length = 0;
      return;
    }
    for (;;) {
      const heads = this.clients.map((c) => c.inbox[0]);
      if (heads.some((h) => !h)) return;
      const idx = heads.map((h) => h!.index);
      if (new Set(idx).size !== 1) {
        this.findings.push({ check: "broadcast-mismatch", detail: `update numbers differ across players: ${idx.join(",")}`, where: this.label });
        this.comparing = false;
        return;
      }
      const games = heads.map((h) => h!.game);
      if (games.every(Boolean)) {
        const pub = games.map((g) => JSON.stringify(publicPart(g!)));
        if (new Set(pub).size !== 1) {
          this.findings.push({ check: "players-disagree", detail: `update ${idx[0]}: players see different public state`, where: this.label });
        }
        // Privacy: nobody's message may contain a card still in someone else's hand.
        heads.forEach((a, i) => {
          heads.forEach((b, j) => {
            if (i === j || !b!.game) return;
            const leaked = b!.game.hand.filter((card) => a!.raw.includes(`"${card}"`));
            if (leaked.length) this.findings.push({ check: "privacy-hand", detail: `update ${idx[0]}: ${this.clients[i]!.name} was sent ${leaked.join(",")} from ${this.clients[j]!.name}'s hand`, where: this.label });
          });
        });
      }
      const rooms = heads.map((h) => JSON.stringify({ ...h!.room, you: 0, invitePath: null }));
      if (new Set(rooms).size !== 1) this.findings.push({ check: "room-disagree", detail: `update ${idx[0]}: players see different room state`, where: this.label });
      for (const c of this.clients) c.inbox.shift();
    }
  }

  private stallReported = false;
  private checkStall() {
    const live = this.live;
    if (!live.length) return;
    const room = live[0]!.room;
    if (!room || !(room.status === "playing")) return;
    const quiet = Date.now() - Math.max(...live.map((c) => c.lastMessageAt));
    if (quiet < this.ctx.stallMs || this.stallReported) return;
    const g = live[0]!.game;
    const turnClient = live.find((c) => c.seat === g?.turn);
    // A station player told to sit still (policy null) is not a stall.
    if (turnClient && !turnClient.policy && g?.phase !== "contractEnd") return;
    this.stallReported = true;
    this.findings.push({
      check: "stall",
      detail:
        `no message for ${quiet} ms while playing: phase ${g?.phase}, contract ${g?.contractNo} ${g?.contract ?? ""}, turn seat ${g?.turn} ` +
        `(${turnClient ? `station player ${turnClient.name}, its moves: ${JSON.stringify(turnClient.moves())}` : room.seats[g?.turn ?? 0]?.kind}), ` +
        `continued ${JSON.stringify(room.continued)}, continueAt in ${room.continueAt ? room.continueAt - Date.now() : "-"} ms`,
      where: this.label,
    });
  }

  // -------------------------------------------------------------------------

  /** Every connected player has seen game over. */
  async untilFinished(ms: number): Promise<void> {
    await Promise.all(this.live.filter((c) => c.ws).map((c) => c.waitFor(() => c.room?.status === "finished", ms, "game over")));
  }

  allFindings(): TableFinding[] {
    const fromClients = this.clients.flatMap((c) => c.findings.map((f) => ({ check: f.check, detail: `update ${f.update}: ${f.detail}`, where: c.name })));
    return [...this.findings, ...fromClients];
  }

  async close(): Promise<void> {
    if (this.watchdog) clearInterval(this.watchdog);
    await Promise.all(this.clients.map((c) => c.close()));
  }
}
