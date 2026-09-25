// The WebSocket to the server: reconnects on its own, and rejoins the seat with the stored
// token so a refresh or a dropped connection puts you back where you were (R-TABLE-5).

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, RoomView, ServerMessage } from "@platform/protocol";

// Storage keys keep their "trix." prefix from before the hub, so players keep their seats and names.
const tokenKey = (roomId: string) => `trix.seat.${roomId}`;
export const seatToken = {
  get: (roomId: string) => localStorageGet(tokenKey(roomId)),
  set: (roomId: string, token: string) => localStorageSet(tokenKey(roomId), token),
  clear: (roomId: string) => localStorageSet(tokenKey(roomId), null),
};
export const savedName = {
  get: () => localStorageGet("trix.name") ?? "",
  set: (name: string) => localStorageSet("trix.name", name),
};

function localStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function localStorageSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the seat just won't survive a refresh.
  }
}

/** The connection as a game's screens see it: `View` and `Event` are that game's own types. */
export interface Connection<View = unknown, Event = unknown> {
  online: boolean;
  roomId: string | null;
  room: RoomView | null;
  game: View | null;
  /** The game of the last table we were at (stays after leaving, to send the player back to that game). */
  lastGame: string | null;
  error: { code: string; message: string; at: number } | null;
  removed: "kicked" | "left" | "roomClosed" | null;
  /** This seat was opened in another tab or window; this one has stopped. */
  replaced: boolean;
  /** Take the seat back into this tab. */
  takeOver: () => void;
  /** The table we were at no longer exists (closed, or the server lost it). */
  lost: string | null;
  send: (msg: ClientMessage) => void;
  /** Start (or switch to) a room: remembered so reconnects rejoin it. */
  join: (msg: Extract<ClientMessage, { type: "createRoom" | "joinRoom" }>) => void;
  /** Subscribe to game events as they arrive (for animations, toasts and the feed). */
  onEvents: (fn: (events: Event[], room: RoomView, game: View | null) => void) => () => void;
  /** Signed in: how to get the current sign-in token (sent first on every connection, so seats
   *  know their account). null: a guest. */
  identify: (getToken: (() => Promise<string | null>) | null) => void;
}

export function useConnection(): Connection {
  const [online, setOnline] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [game, setGame] = useState<unknown>(null);
  const [lastGame, setLastGame] = useState<string | null>(null);
  const [error, setError] = useState<Connection["error"]>(null);
  const [removed, setRemoved] = useState<Connection["removed"]>(null);
  const [replaced, setReplaced] = useState(false);
  const [lost, setLost] = useState<string | null>(null);
  const replacedRef = useRef(false);
  const reconnectNow = useRef<() => void>(() => undefined);

  const socket = useRef<WebSocket | null>(null);
  const pendingJoin = useRef<ClientMessage | null>(null);
  const joinedRoom = useRef<string | null>(null);
  const listeners = useRef(new Set<(e: unknown[], r: RoomView, g: unknown) => void>());
  const stopped = useRef(false);
  const identity = useRef<(() => Promise<string | null>) | null>(null);
  // Until "identify" has gone out on this connection, other messages wait here, so the server
  // knows who is taking a seat before they take it.
  const ready = useRef(false);
  const outbox = useRef<ClientMessage[]>([]);

  const rawSend = useCallback((msg: ClientMessage) => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ready.current) ws.send(JSON.stringify(msg));
    else outbox.current.push(msg);
  }, []);

  /** Says who we are (when there's an identity), then lets everything else through. */
  const handshake = useCallback(async (ws: WebSocket, then: () => void) => {
    ready.current = false;
    const getToken = identity.current;
    if (getToken) {
      const idToken = await getToken().catch(() => null);
      if (ws !== socket.current || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "identify", idToken }));
    }
    then();
    ready.current = true;
    for (const msg of outbox.current.splice(0)) ws.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    stopped.current = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
      socket.current = ws;
      ws.onopen = () => {
        retry = 0;
        outbox.current = [];
        void handshake(ws, () => {
          setOnline(true);
          // Rejoin the seat we had, or send the join we were asked to make.
          const id = joinedRoom.current;
          const token = id ? seatToken.get(id) : null;
          if (id && token) ws.send(JSON.stringify({ type: "joinRoom", roomId: id, token }));
          else if (pendingJoin.current) ws.send(JSON.stringify(pendingJoin.current));
        });
      };
      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        switch (msg.type) {
          case "joined":
            seatToken.set(msg.roomId, msg.token);
            joinedRoom.current = msg.roomId;
            pendingJoin.current = null;
            setRoomId(msg.roomId);
            setRemoved(null);
            setError(null);
            setLost(null);
            break;
          case "update":
            setRoom(msg.room);
            setGame(msg.game);
            setLastGame(msg.room.game);
            if (msg.events.length) for (const fn of listeners.current) fn(msg.events, msg.room, msg.game);
            break;
          case "error":
            if (msg.code === "REPLACED") {
              // Another tab took this seat: stop here, or the two tabs take it from each other forever.
              replacedRef.current = true;
              setReplaced(true);
              break;
            }
            // Rejoining (after a drop, or on opening the page with a saved seat) failed: the table,
            // or our seat at it, is gone. Say so instead of showing a frozen table.
            const pj = pendingJoin.current;
            const rejoining = joinedRoom.current ?? (pj?.type === "joinRoom" && pj.token ? pj.roomId : null);
            if ((msg.code === "BAD_TOKEN" || msg.code === "ROOM_NOT_FOUND") && rejoining) {
              seatToken.clear(rejoining);
              setLost(rejoining);
              joinedRoom.current = null;
              pendingJoin.current = null;
              setRoom(null);
              setGame(null);
              setRoomId(null);
            }
            setError({ code: msg.code, message: msg.message, at: Date.now() });
            break;
          case "removed":
            if (joinedRoom.current) seatToken.clear(joinedRoom.current);
            joinedRoom.current = null;
            setRemoved(msg.reason);
            setRoom(null);
            setGame(null);
            break;
        }
      };
      ws.onclose = () => {
        ready.current = false;
        setOnline(false);
        if (stopped.current || replacedRef.current) return;
        retry = Math.min(retry + 1, 5);
        timer = setTimeout(connect, [0, 500, 1000, 2000, 4000, 6000][retry]);
      };
    };
    reconnectNow.current = () => {
      clearTimeout(timer);
      retry = 0;
      connect();
    };
    connect();
    return () => {
      stopped.current = true;
      clearTimeout(timer);
      socket.current?.close();
    };
  }, [handshake]);

  const identify = useCallback<Connection["identify"]>(
    (getToken) => {
      identity.current = getToken;
      const ws = socket.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return; // the next connection says it
      if (getToken) void handshake(ws, () => undefined);
      else if (ready.current) ws.send(JSON.stringify({ type: "identify", idToken: null }));
    },
    [handshake],
  );

  const join = useCallback<Connection["join"]>(
    (msg) => {
      pendingJoin.current = msg;
      joinedRoom.current = null;
      setError(null);
      rawSend(msg);
    },
    [rawSend],
  );

  const onEvents = useCallback<Connection["onEvents"]>((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const takeOver = useCallback(() => {
    replacedRef.current = false;
    setReplaced(false);
    reconnectNow.current();
  }, []);

  return { online, roomId, room, game, lastGame, error, removed, replaced, takeOver, lost, send: rawSend, join, onEvents, identify };
}
