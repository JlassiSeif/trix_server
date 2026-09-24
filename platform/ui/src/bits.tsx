import { useEffect, useRef, useState } from "react";

/** Re-render every `ms` while mounted (for countdowns). */
export function useTick(ms: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** The invite link with a copy button. Falls back to selecting the text where the clipboard is blocked. */
export function InviteLink({ path }: { path: string }) {
  const url = `${location.origin}${path}`;
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      input.current?.select(); // no clipboard access (plain http): select it for Ctrl+C
    }
  };
  return (
    <div className="invite">
      <input readOnly value={url} ref={input} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
      <button onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
    </div>
  );
}

/** Leaving gives the seat away for good (R-TABLE-6), so it asks first. */
export function LeaveButton({ onLeave }: { onLeave: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button className="link" onClick={() => setAsking(true)}>
        Leave the table
      </button>
    );
  }
  return (
    <div className="leave-confirm">
      <p>Leave for good? Your seat goes to whoever the owner invites next.</p>
      <div className="row">
        <button className="danger" onClick={onLeave}>
          Leave
        </button>
        <button className="secondary" onClick={() => setAsking(false)}>
          Stay
        </button>
      </div>
    </div>
  );
}
