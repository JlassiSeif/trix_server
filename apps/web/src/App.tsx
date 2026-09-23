import { useEffect } from "react";
import { seatToken, useConnection } from "./net";
import { Entry } from "./screens/Entry";
import { Lobby } from "./screens/Lobby";
import { Table } from "./screens/Table";

/** Routes: "/" creates a table; "/r/<room>?i=<invite>" joins one; "/r/<room>" rejoins your seat. */
export function App() {
  const conn = useConnection();
  const urlRoom = location.pathname.match(/^\/r\/([a-z0-9]+)/)?.[1] ?? null;
  const invite = new URLSearchParams(location.search).get("i");
  const storedToken = urlRoom ? seatToken.get(urlRoom) : null;

  // Coming back (refresh, closed tab, new link from the same browser): rejoin the seat.
  useEffect(() => {
    if (urlRoom && storedToken) conn.join({ type: "joinRoom", roomId: urlRoom, token: storedToken });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once seated, the address is just the room: the seat token does the rest.
  useEffect(() => {
    if (conn.roomId && location.pathname + location.search !== `/r/${conn.roomId}`) {
      history.replaceState(null, "", `/r/${conn.roomId}`);
    }
  }, [conn.roomId]);

  if (conn.room && conn.roomId && !conn.removed) {
    if (conn.room.status === "lobby" || !conn.game) return <Lobby conn={conn} />;
    return <Table conn={conn} />;
  }
  if (urlRoom && storedToken && !conn.error && !conn.removed) {
    return (
      <main className="entry">
        <h1>Trix</h1>
        <p className="muted">Taking you back to your seat…</p>
      </main>
    );
  }
  return <Entry conn={conn} roomId={conn.removed ? null : urlRoom} invite={invite} />;
}
