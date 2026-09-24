import type { Connection } from "@platform/ui";

const removedText = {
  kicked: "The table owner removed you from the table.",
  left: "You left the table.",
  roomClosed: "That table was closed.",
};

/** Why you're back here: removed from a table, or the table no longer exists. */
export function Notices({ conn }: { conn: Connection }) {
  return (
    <>
      {conn.removed && <p className="notice">{removedText[conn.removed]}</p>}
      {conn.lost && !conn.removed && <p className="notice">That table doesn't exist any more. Create a new one below, or ask for a new link.</p>}
    </>
  );
}
