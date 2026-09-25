import { useText, type Connection } from "@platform/ui";
import { T } from "../text";

/** Why you're back here: removed from a table, or the table no longer exists. */
export function Notices({ conn }: { conn: Connection }) {
  const t = useText(T);
  return (
    <>
      {conn.removed && <p className="notice">{t.notices[conn.removed]}</p>}
      {conn.lost && !conn.removed && <p className="notice">{t.notices.lost}</p>}
    </>
  );
}
