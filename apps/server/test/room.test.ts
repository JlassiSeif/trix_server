import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { placeholderBotAction, type Seat } from "@trix/engine";
import type { ServerMessage } from "@trix/protocol";
import { Hub } from "../src/hub";
import type { Conn } from "../src/room";

class FakeConn implements Conn {
  inbox: ServerMessage[] = [];
  closed = false;
  send(msg: ServerMessage) {
    this.inbox.push(structuredClone(msg));
  }
  close() {
    this.closed = true;
  }
  last<T extends ServerMessage["type"]>(type: T): Extract<ServerMessage, { type: T }> {
    const m = [...this.inbox].reverse().find((x) => x.type === type);
    if (!m) throw new Error(`no ${type} message`);
    return m as Extract<ServerMessage, { type: T }>;
  }
  errors() {
    return this.inbox.filter((m) => m.type === "error").map((m) => (m as { code: string }).code);
  }
}

let hub: Hub;
const send = (conn: FakeConn, msg: object) => hub.receive(conn, JSON.stringify(msg));

function createRoom(name = "Seif") {
  const owner = new FakeConn();
  send(owner, { type: "createRoom", name });
  const joined = owner.last("joined");
  const room = hub.rooms.get(joined.roomId)!;
  return { owner, room, roomId: joined.roomId, token: joined.token };
}

function invite(owner: FakeConn) {
  const path = owner.last("update").room.invitePath!;
  return new URL(path, "http://x").searchParams.get("i")!;
}

/** Plays the human seat with the bot's logic, and clicks Continue between contracts. */
function playHuman(conn: FakeConn, room: ReturnType<typeof createRoom>["room"], seat: Seat) {
  const g = room.game!;
  if (g.phase === "contractEnd" && !room.continued.has(seat)) return send(conn, { type: "continue" });
  if (g.turn === seat && room.status === "playing") send(conn, { type: "action", action: placeholderBotAction(g, seat) });
}

beforeEach(() => {
  vi.useFakeTimers();
  hub = new Hub({ seed: () => 12345 });
});
afterEach(() => vi.useRealTimers());

describe("joining (R-TABLE-1, R-TABLE-2)", () => {
  it("makes the creator the owner, with an invite link only they can see", () => {
    const { owner, room } = createRoom();
    expect(owner.last("joined").seat).toBe(0);
    expect(room.owner).toBe(0);
    const guest = new FakeConn();
    send(guest, { type: "joinRoom", roomId: room.id, invite: invite(owner), name: "Ali" });
    expect(guest.last("joined").seat).toBe(1);
    expect(guest.last("update").room.invitePath).toBeNull();
    expect(owner.last("update").room.seats[1]).toMatchObject({ kind: "human", name: "Ali", connected: true });
  });

  it("refuses a wrong invite, a missing name and unknown rooms", () => {
    const { owner, room } = createRoom();
    const guest = new FakeConn();
    send(guest, { type: "joinRoom", roomId: room.id, invite: "nope", name: "Ali" });
    send(guest, { type: "joinRoom", roomId: room.id, invite: invite(owner), name: "   " });
    send(guest, { type: "joinRoom", roomId: "zzzzzz", invite: "x", name: "Ali" });
    expect(guest.errors()).toEqual(["BAD_INVITE", "BAD_NAME", "ROOM_NOT_FOUND"]);
  });

  it("cleans names: control characters stripped, 20 characters max", () => {
    const { owner } = createRoom("  A\u0007li\n  the   great and powerful ");
    expect(owner.last("update").room.seats[0]!.name).toBe("Ali the great and po");
  });
});

describe("starting (R-TABLE-3)", () => {
  it("starts on its own when the 4th seat is filled; only the owner adds bots", () => {
    const { owner, room } = createRoom();
    const guest = new FakeConn();
    send(guest, { type: "joinRoom", roomId: room.id, invite: invite(owner), name: "Ali" });
    send(guest, { type: "addBot", seat: 2 });
    expect(guest.errors()).toContain("NOT_OWNER");
    send(owner, { type: "addBot", seat: 2 });
    expect(room.status).toBe("lobby");
    send(owner, { type: "addBot", seat: 3 });
    expect(room.status).toBe("playing");
    expect(owner.last("update").game!.hand).toHaveLength(8);
    expect(owner.last("update").room.seats.map((s) => s.name)).toEqual(["Seif", "Ali", "Medium bot", "Medium bot 2"]);
  });
});

describe("bot levels (docs/bots.md §8)", () => {
  it("the owner picks each bot's level; bots are named after it; everyone sees the levels", () => {
    const { owner, room } = createRoom();
    send(owner, { type: "addBot", seat: 1, level: "hard" });
    send(owner, { type: "addBot", seat: 2, level: "easy" });
    send(owner, { type: "addBot", seat: 3, level: "hard" });
    const seats = owner.last("update").room.seats;
    expect(seats.map((s) => s.name)).toEqual(["Seif", "Hard bot", "Easy bot", "Hard bot 2"]);
    expect(seats.map((s) => s.level)).toEqual([null, "hard", "easy", "hard"]);
    expect(room.status).toBe("playing");
  });

  it("refuses an unknown level", () => {
    const { owner, room } = createRoom();
    send(owner, { type: "addBot", seat: 1, level: "godlike" });
    expect(owner.errors()).toEqual(["BAD_MESSAGE"]);
    expect(room.seats[1]).toBeNull();
  });

  it("R-TABLE-13: Play against bots: three bots of the chosen level, and the game starts at once", () => {
    const me = new FakeConn();
    send(me, { type: "createRoom", name: "Seif", bots: "hard" });
    const room = hub.rooms.get(me.last("joined").roomId)!;
    expect(me.last("joined").seat).toBe(0);
    expect(room.status).toBe("playing");
    expect(me.last("update").room.seats.map((s) => [s.name, s.level])).toEqual([
      ["Seif", null],
      ["Hard bot", "hard"],
      ["Hard bot 2", "hard"],
      ["Hard bot 3", "hard"],
    ]);
    // The invite link still works: a friend takes over a bot's seat (R-TABLE-10).
    const friend = new FakeConn();
    send(friend, { type: "joinRoom", roomId: room.id, invite: invite(me), name: "Ali" });
    expect(friend.last("joined")).toBeTruthy();
  });

  it("refuses an unknown level for Play against bots, and creates nothing", () => {
    const me = new FakeConn();
    send(me, { type: "createRoom", name: "Seif", bots: "godlike" });
    expect(me.errors()).toEqual(["BAD_MESSAGE"]);
    expect(hub.rooms.size).toBe(0);
  });

  it("plays a whole game against three hard bots", { timeout: 60_000 }, () => {
    const me = new FakeConn();
    send(me, { type: "createRoom", name: "Seif", bots: "hard" });
    const room = hub.rooms.get(me.last("joined").roomId)!;
    for (let i = 0; i < 20000 && room.status !== "finished"; i++) {
      playHuman(me, room, 0);
      vi.advanceTimersByTime(500);
    }
    expect(room.status).toBe("finished");
    expect(me.errors()).toEqual([]);
  });

  it("keeps levels and the bots' memory across a restart; older saves get medium bots", () => {
    const { owner, room } = createRoom();
    for (const s of [1, 2, 3]) send(owner, { type: "addBot", seat: s, level: "easy" });
    for (let i = 0; i < 40; i++) {
      playHuman(owner, room, 0);
      vi.advanceTimersByTime(500);
    }
    const snap = JSON.parse(JSON.stringify(hub.snapshot()));
    const saved = snap.rooms[0];
    expect(saved.seats[1].level).toBe("easy");
    expect(saved.contractEvents.length).toBeGreaterThan(0);
    const restored = new Hub({ seed: () => 1 });
    restored.restore(snap);
    expect(restored.rooms.get(room.id)!.viewFor(0).seats[1]!.level).toBe("easy");
    delete saved.seats[1].level;
    delete saved.contractEvents;
    const old = new Hub({ seed: () => 1 });
    old.restore(snap);
    expect(old.rooms.get(room.id)!.viewFor(0).seats[1]!.level).toBe("medium");
    restored.stopTimers();
    old.stopTimers();
  });
});

describe("a full game with one human and three bots", () => {
  it("plays to the end; each player only ever sees their own hand", () => {
    const { owner, room } = createRoom();
    for (const s of [1, 2, 3]) send(owner, { type: "addBot", seat: s });
    for (let i = 0; i < 20000 && room.status !== "finished"; i++) {
      playHuman(owner, room, 0);
      vi.advanceTimersByTime(500);
    }
    expect(room.status).toBe("finished");
    expect(owner.errors()).toEqual([]);
    const final = owner.last("update");
    expect(final.game!.standings).not.toBeNull();
    // No update ever carried another seat's cards or the full game state.
    for (const m of owner.inbox) {
      if (m.type !== "update" || !m.game) continue;
      expect(m.game).not.toHaveProperty("hands");
      expect(m.game.seat).toBe(0);
    }
  });

  it("waits for the human to continue between contracts, or deals after the countdown", () => {
    const { owner, room } = createRoom();
    for (const s of [1, 2, 3]) send(owner, { type: "addBot", seat: s });
    while (room.game!.phase !== "contractEnd") {
      playHuman(owner, room, 0);
      vi.advanceTimersByTime(500);
    }
    expect(owner.last("update").room.continueAt).toBeGreaterThan(Date.now());
    vi.advanceTimersByTime(9000);
    expect(room.game!.contractNo).toBe(1);
    vi.advanceTimersByTime(1100);
    expect(room.game!.contractNo).toBe(2);
  });

  it("R-TABLE-8: after the game, all Ready starts a new one with the same seats", () => {
    const { owner, room } = createRoom();
    for (const s of [1, 2, 3]) send(owner, { type: "addBot", seat: s });
    room.game!.totals = [1001, 1001, 1001, 1001]; // the first contract ends the game
    for (let i = 0; i < 5000 && room.status !== "finished"; i++) {
      playHuman(owner, room, 0);
      vi.advanceTimersByTime(500);
    }
    expect(room.status).toBe("finished");
    send(owner, { type: "ready" });
    expect(room.status).toBe("playing");
    expect(room.game!.contractNo).toBe(1);
    expect(room.game!.totals).toEqual([0, 0, 0, 0]);
  });
});

describe("moves are checked by the engine", () => {
  it("rejects illegal and malformed moves with an error to the sender only", () => {
    const { owner, room } = createRoom();
    for (const s of [1, 2, 3]) send(owner, { type: "addBot", seat: s });
    const before = JSON.stringify(room.game);
    const notMine = room.game!.picker === 0 ? { type: "play", card: "7_h" } : { type: "pick", contract: "dineri" };
    send(owner, { type: "action", action: notMine });
    send(owner, { type: "action", action: { type: "pick", contract: "belote" } });
    send(owner, { type: "action", action: "garbage" });
    expect(owner.errors().length).toBe(3);
    expect(JSON.stringify(room.game)).toBe(before);
  });

  it("sends a look at the last trick only to the player who looked (R-TRICK-6)", () => {
    const { owner, room } = createRoom();
    const guest = new FakeConn();
    send(guest, { type: "joinRoom", roomId: room.id, invite: invite(owner), name: "Ali" });
    for (const s of [2, 3]) send(owner, { type: "addBot", seat: s });
    const humans: [FakeConn, Seat][] = [[owner, 0], [guest, 1]];
    // Force a trick contract and play until one trick is done.
    while (!room.game!.lastTrick) {
      for (const [c, s] of humans) {
        const g = room.game!;
        if (g.phase === "picking" && g.picker === s) send(c, { type: "action", action: { type: "pick", contract: "pli" } });
        else playHuman(c, room, s);
      }
      vi.advanceTimersByTime(300);
    }
    send(guest, { type: "action", action: { type: "peekLastTrick" } });
    expect(guest.last("update").events.map((e) => e.type)).toContain("lastTrickShown");
    expect(owner.last("update").events.map((e) => e.type)).not.toContain("lastTrickShown");
  });
});

describe("disconnects and seats (R-TABLE-4 to R-TABLE-7)", () => {
  function tableWithGuest() {
    const r = createRoom();
    const guest = new FakeConn();
    send(guest, { type: "joinRoom", roomId: r.room.id, invite: invite(r.owner), name: "Ali" });
    const guestToken = guest.last("joined").token;
    for (const s of [2, 3]) send(r.owner, { type: "addBot", seat: s });
    return { ...r, guest, guestToken };
  }

  it("pauses when a player drops and resumes when they come back with their token", () => {
    const { room, owner, guest, guestToken } = tableWithGuest();
    hub.disconnected(guest);
    expect(room.status).toBe("paused");
    expect(owner.last("update").room.waitingFor).toEqual([1]);
    const back = new FakeConn();
    send(back, { type: "joinRoom", roomId: room.id, token: "wrong" });
    expect(back.errors()).toEqual(["BAD_TOKEN"]);
    send(back, { type: "joinRoom", roomId: room.id, token: guestToken });
    expect(back.last("joined").seat).toBe(1);
    expect(room.status).toBe("playing");
  });

  it("does not let bots move while paused", () => {
    const { room, owner, guest } = tableWithGuest();
    hub.disconnected(guest);
    const before = JSON.stringify(room.game);
    vi.advanceTimersByTime(60_000);
    expect(JSON.stringify(room.game)).toBe(before);
    send(owner, { type: "action", action: { type: "pick", contract: "dineri" } });
    expect(owner.errors()).toContain("NOT_PLAYING");
  });

  it("owner can resume with a bot for the missing player, who takes the seat back on return", () => {
    const { room, owner, guest, guestToken } = tableWithGuest();
    hub.disconnected(guest);
    send(owner, { type: "resumeWithBots" });
    expect(room.status).toBe("playing");
    expect(owner.last("update").room.seats[1]).toMatchObject({ name: "Ali", botPlaying: true });
    const back = new FakeConn();
    send(back, { type: "joinRoom", roomId: room.id, token: guestToken });
    expect(owner.last("update").room.seats[1]).toMatchObject({ botPlaying: false, connected: true });
  });

  it("kick empties the seat, changes the invite link, and the old link stops working (R-TABLE-6)", () => {
    const { room, owner, guest, guestToken } = tableWithGuest();
    const oldInvite = invite(owner);
    send(owner, { type: "kick", seat: 1 });
    expect(guest.last("removed").reason).toBe("kicked");
    expect(guest.closed).toBe(true);
    expect(room.status).toBe("paused");
    const newInvite = invite(owner);
    expect(newInvite).not.toBe(oldInvite);

    const kicked = new FakeConn();
    send(kicked, { type: "joinRoom", roomId: room.id, token: guestToken });
    send(kicked, { type: "joinRoom", roomId: room.id, invite: oldInvite, name: "Ali again" });
    expect(kicked.errors()).toEqual(["BAD_TOKEN", "BAD_INVITE"]);

    const replacement = new FakeConn();
    send(replacement, { type: "joinRoom", roomId: room.id, invite: newInvite, name: "Sami" });
    expect(replacement.last("joined").seat).toBe(1);
    expect(replacement.last("update").game!.hand.length).toBeGreaterThan(0); // takes over the seat's hand
    expect(room.status).toBe("playing");
  });

  it("leaving hands ownership to another human; the last human leaving closes the room", () => {
    const { room, owner, guest } = tableWithGuest();
    send(owner, { type: "leave" });
    expect(room.owner).toBe(1);
    expect(guest.last("update").room.invitePath).not.toBeNull();
    send(guest, { type: "leave" });
    expect(hub.rooms.has(room.id)).toBe(false);
  });

  it("owner can end the game and start again from the lobby", () => {
    const { room, owner, guest } = tableWithGuest();
    send(guest, { type: "endGame" });
    expect(guest.errors()).toContain("NOT_OWNER");
    send(owner, { type: "endGame" });
    expect(room.status).toBe("lobby");
    send(owner, { type: "startGame" });
    expect(room.status).toBe("playing");
  });
});

describe("hub robustness", () => {
  it("answers junk with errors and never throws", () => {
    const c = new FakeConn();
    for (const raw of ["", "{", "null", "42", '{"type":5}', '{"type":"action"}', '{"type":"nope"}', '{"type":"joinRoom"}']) {
      expect(() => hub.receive(c, raw)).not.toThrow();
    }
    expect(c.errors()).toEqual(["BAD_MESSAGE", "BAD_MESSAGE", "BAD_MESSAGE", "BAD_MESSAGE", "BAD_MESSAGE", "NOT_SEATED", "NOT_SEATED", "ROOM_NOT_FOUND"]);
  });
});

describe("found by the testing station (2026-09-23)", () => {
  it("S11: a refused createRoom or joinRoom never pulls a seated player out of their table", () => {
    const { owner, room } = createRoom();
    for (const s of [1, 2, 3]) send(owner, { type: "addBot", seat: s });
    expect(room.status).toBe("playing");
    send(owner, { type: "createRoom", name: 12 });
    send(owner, { type: "joinRoom", roomId: room.id, invite: "bad", name: "x" });
    send(owner, { type: "joinRoom", roomId: "nothere", invite: "x", name: "x" });
    expect(owner.errors()).toEqual(["BAD_NAME", "ALREADY_SEATED", "ROOM_NOT_FOUND"]);
    expect(room.status).toBe("playing");
    expect(room.seatOf(owner)).toBe(0);
    // And a seated player can still act.
    const g = room.game!;
    if (g.turn === 0) send(owner, { type: "action", action: placeholderBotAction(g, 0) });
    expect(owner.errors()).toHaveLength(3);
  });

  it("S11: creating a new room on purpose moves the player there and frees their old seat", () => {
    const { owner, room } = createRoom();
    const guest = new FakeConn();
    send(guest, { type: "joinRoom", roomId: room.id, invite: invite(owner), name: "Ali" });
    send(guest, { type: "createRoom", name: "Ali's table" });
    const moved = guest.last("joined");
    expect(moved.roomId).not.toBe(room.id);
    expect(owner.last("update").room.seats[1]).toMatchObject({ name: "Ali", connected: false });
  });
});

describe("R-TABLE-12: room ownership passes on", () => {
  /** Owner (seat 0) + two guests (seats 1, 2) + a bot, game running. */
  function table() {
    const r = createRoom();
    const g1 = new FakeConn();
    const g2 = new FakeConn();
    send(g1, { type: "joinRoom", roomId: r.room.id, invite: invite(r.owner), name: "Ali" });
    send(g2, { type: "joinRoom", roomId: r.room.id, invite: invite(r.owner), name: "Sami" });
    send(r.owner, { type: "addBot", seat: 3 });
    return { ...r, g1, g2 };
  }

  it("an owner away for 30 s hands over to the next connected player", () => {
    const { room, owner, g1 } = table();
    hub.disconnected(owner);
    vi.advanceTimersByTime(29_000);
    expect(room.owner).toBe(0);
    vi.advanceTimersByTime(1_500);
    expect(room.owner).toBe(1);
    expect(g1.last("update").room.owner).toBe(1);
    expect(g1.last("update").room.invitePath).not.toBeNull(); // the new owner gets the invite link
  });

  it("skips players who are away, and never picks a bot", () => {
    const { room, owner, g1, g2 } = table();
    hub.disconnected(g1);
    hub.disconnected(owner);
    vi.advanceTimersByTime(31_000);
    expect(room.owner).toBe(2);
    expect(g2.last("update").room.owner).toBe(2);
  });

  it("with nobody connected, waits, then hands over as soon as someone comes back", () => {
    const { room, owner, g1, g2 } = table();
    const g1Token = g1.last("joined").token;
    hub.disconnected(g1);
    hub.disconnected(g2);
    hub.disconnected(owner);
    vi.advanceTimersByTime(60_000);
    expect(room.owner).toBe(0);
    const back = new FakeConn();
    send(back, { type: "joinRoom", roomId: room.id, token: g1Token });
    expect(room.owner).toBe(1);
  });

  it("a returning previous owner does not get it back automatically", () => {
    const { room, owner, token } = table();
    hub.disconnected(owner);
    vi.advanceTimersByTime(31_000);
    expect(room.owner).toBe(1);
    const back = new FakeConn();
    send(back, { type: "joinRoom", roomId: room.id, token });
    expect(room.owner).toBe(1);
  });

  it("a short blip (refresh) does not cost the owner ownership", () => {
    const { room, owner, token } = table();
    hub.disconnected(owner);
    vi.advanceTimersByTime(5_000);
    const back = new FakeConn();
    send(back, { type: "joinRoom", roomId: room.id, token });
    vi.advanceTimersByTime(60_000);
    expect(room.owner).toBe(0);
  });

  it("the owner can hand ownership to a connected player, and only to one", () => {
    const { room, owner, g1, g2 } = table();
    send(g1, { type: "makeOwner", seat: 2 });
    expect(g1.errors()).toContain("NOT_OWNER");
    send(owner, { type: "makeOwner", seat: 3 }); // the bot
    send(owner, { type: "makeOwner", seat: 0 }); // themself
    hub.disconnected(g2);
    send(owner, { type: "makeOwner", seat: 2 }); // away
    expect(owner.errors()).toEqual(["NOT_ELIGIBLE", "NOT_ELIGIBLE", "NOT_ELIGIBLE"]);
    send(owner, { type: "makeOwner", seat: 1 });
    expect(room.owner).toBe(1);
    expect(owner.last("update").room.invitePath).toBeNull();
    expect(g1.last("update").room.invitePath).not.toBeNull();
  });

  it("an owner who leaves hands over to a connected player before an away one", () => {
    const { room, owner, g1 } = table();
    hub.disconnected(g1);
    send(owner, { type: "leave" });
    expect(room.owner).toBe(2);
  });
});

describe("no impersonation at a table", () => {
  it("refuses a name already at the table, whatever the case or spacing", () => {
    const { owner, room } = createRoom("Seif");
    for (const name of ["Seif", "SEIF", "  seif  "]) {
      const c = new FakeConn();
      send(c, { type: "joinRoom", roomId: room.id, invite: invite(owner), name });
      expect(c.errors()).toEqual(["NAME_TAKEN"]);
    }
  });
});

describe("tables per address", () => {
  it("refuses a 6th table while the address is at its 5, but an abandoned one makes way (oldest first)", () => {
    hub = new Hub({ seed: () => 12345, maxRoomsPerIp: 5 });
    const conns: FakeConn[] = [];
    for (let i = 0; i < 5; i++) {
      const c = Object.assign(new FakeConn(), { ip: "203.0.113.5" });
      send(c, { type: "createRoom", name: `p${i}` });
      conns.push(c);
      vi.advanceTimersByTime(1000);
    }
    const extra = Object.assign(new FakeConn(), { ip: "203.0.113.5" });
    send(extra, { type: "createRoom", name: "more" });
    expect(extra.errors()).toEqual(["TOO_MANY_TABLES"]);
    // Two tabs closed (nobody left at those tables): the older of the two is recycled.
    const [first, second] = [conns[1]!.last("joined").roomId, conns[3]!.last("joined").roomId];
    hub.disconnected(conns[3]!);
    vi.advanceTimersByTime(1000);
    hub.disconnected(conns[1]!);
    send(extra, { type: "createRoom", name: "more" });
    expect(extra.last("joined")).toBeTruthy();
    expect(hub.rooms.has(first)).toBe(true);
    expect(hub.rooms.has(second)).toBe(false);
    expect(hub.rooms.size).toBe(5);
  });
});
