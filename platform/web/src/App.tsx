import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { TableChromeProvider, seatToken, useConnection, useText, type Connection, type GameUI } from "@platform/ui";
import { account } from "./account";
import { TableChrome, TopBar } from "./brand";
import { gameById } from "./games";
import { AccountPage } from "./screens/Account";
import { Entry } from "./screens/Entry";
import { Home } from "./screens/Home";
import { Lobby } from "./screens/Lobby";
import { DocPage, NotFound } from "./screens/Pages";
import { SignInPage } from "./screens/SignIn";
import { T } from "./text";

/**
 * Routes:
 *   /                      the hub: pick a game
 *   /<game>                a game's page: create a table, or play against bots
 *   /r/<room>?i=<invite>   join a table; /r/<room> rejoins your seat (R-TABLE-5)
 *   /signin                where an email sign-in link lands; /account: your account
 *   /about /privacy /terms the plain pages; anything else: "no table here"
 * Once seated, the room decides: its lobby, then its game's table.
 */
export function App() {
  const t = useText(T);
  const conn = useConnection();
  // Accounts: find out once whether they're on, and who this is (docs/architecture.md §7).
  const identify = conn.identify;
  useEffect(() => {
    void account.init(identify);
  }, [identify]);
  const [path, setPath] = useState(location.pathname);
  const go = useCallback((to: string) => {
    if (to !== location.pathname) {
      history.pushState(null, "", to);
      scrollTo(0, 0);
    }
    setPath(to);
  }, []);
  useEffect(() => {
    const back = () => setPath(location.pathname);
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, []);

  const urlRoom = path.match(/^\/r\/([a-z0-9]+)/)?.[1] ?? null;
  const invite = new URLSearchParams(location.search).get("i");
  const storedToken = urlRoom ? seatToken.get(urlRoom) : null;
  const pathGame = gameById(path.slice(1));

  // Coming back (refresh, closed tab, new link from the same browser): rejoin the seat.
  useEffect(() => {
    if (urlRoom && storedToken) conn.join({ type: "joinRoom", roomId: urlRoom, token: storedToken });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Removed from the table, or the table is gone: back to that game's page (or the hub).
  useEffect(() => {
    if ((conn.lost || conn.removed) && path.startsWith("/r/")) go(conn.lastGame && gameById(conn.lastGame) ? `/${conn.lastGame}` : "/");
  }, [conn.lost, conn.removed, conn.lastGame, path, go]);

  // Once seated, the address is just the room: the seat token does the rest.
  useEffect(() => {
    if (conn.roomId && location.pathname + location.search !== `/r/${conn.roomId}`) {
      history.replaceState(null, "", `/r/${conn.roomId}`);
      setPath(`/r/${conn.roomId}`);
    }
  }, [conn.roomId]);

  if (conn.replaced) {
    return (
      <div className="hub entry">
        <TopBar />
        <main className="plain">
          <h1>{t.app.elsewhere}</h1>
          <p className="lede">{t.app.elsewhereLede}</p>
          <button className="primary" onClick={conn.takeOver}>
            {t.app.playHere}
          </button>
        </main>
      </div>
    );
  }
  if (conn.room && conn.roomId && !conn.removed) {
    const game = gameById(conn.room.game);
    if (conn.room.status === "lobby" || conn.game === null) return <Lobby conn={conn} game={game} />;
    return <GameTable conn={conn} game={game} />;
  }
  if (urlRoom && storedToken && !conn.error && !conn.removed) {
    return (
      <div className="hub entry">
        <TopBar />
        <main className="plain">
          <p className="lede">{t.app.takingBack}</p>
        </main>
      </div>
    );
  }
  if (urlRoom && !conn.removed && !conn.lost) return <Entry conn={conn} game={null} roomId={urlRoom} invite={invite} go={go} />;
  if (pathGame) return <Entry conn={conn} game={pathGame} roomId={null} invite={null} go={go} />;
  if (path === "/signin") return <SignInPage go={go} />;
  if (path === "/account") return <AccountPage go={go} />;
  if (path === "/about" || path === "/privacy" || path === "/terms") return <DocPage which={path.slice(1) as "about" | "privacy" | "terms"} go={go} />;
  if (path !== "/" && !urlRoom) return <NotFound go={go} />;
  return <Home conn={conn} go={go} />;
}

/** A game's table screen, loaded the first time it's needed (docs/architecture.md §10). */
function GameTable({ conn, game }: { conn: Connection; game: GameUI | null }) {
  const t = useText(T);
  const Table = useMemo(() => (game ? lazy(() => game.loadTable().then((c: ComponentType<{ conn: Connection }>) => ({ default: c }))) : null), [game]);
  if (!Table)
    return (
      <div className="hub entry">
        <TopBar />
        <main className="plain">
          <p className="notice">{t.app.unknownGame}</p>
        </main>
      </div>
    );
  return (
    <Suspense
      fallback={
        <div className="hub entry">
          <TopBar />
          <main className="plain">
            <p className="lede">{t.app.settingUp}</p>
          </main>
        </div>
      }
    >
      <TableChromeProvider value={TableChrome}>
        <Table conn={conn} />
      </TableChromeProvider>
    </Suspense>
  );
}
