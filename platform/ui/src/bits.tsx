import { useEffect, useRef, useState } from "react";
import { texts, useText } from "./i18n";

const T = texts({
  en: { inviteLink: "Invite link", copy: "Copy link", copied: "Copied", leave: "Leave the table", leaveAsk: "Leave for good? Your seat goes to whoever the owner invites next.", leaveYes: "Leave", stay: "Stay" },
  fr: { inviteLink: "Lien d'invitation", copy: "Copier le lien", copied: "Copié", leave: "Quitter la table", leaveAsk: "Partir pour de bon ? Votre place ira à la prochaine personne invitée par l'hôte.", leaveYes: "Partir", stay: "Rester" },
  ar: { inviteLink: "رابط الدعوة", copy: "نسخ الرابط", copied: "تم النسخ", leave: "مغادرة الطاولة", leaveAsk: "المغادرة نهائيًا؟ سيذهب مقعدك إلى من يدعوه صاحب الطاولة بعدك.", leaveYes: "غادر", stay: "ابقَ" },
});

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
  const t = useText(T);
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
      <input readOnly value={url} ref={input} onFocus={(e) => e.currentTarget.select()} aria-label={t.inviteLink} dir="ltr" />
      <button onClick={copy}>{copied ? t.copied : t.copy}</button>
    </div>
  );
}

/** Leaving gives the seat away for good (R-TABLE-6), so it asks first. */
export function LeaveButton({ onLeave }: { onLeave: () => void }) {
  const t = useText(T);
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button className="link" onClick={() => setAsking(true)}>
        {t.leave}
      </button>
    );
  }
  return (
    <div className="leave-confirm">
      <p>{t.leaveAsk}</p>
      <div className="row">
        <button className="danger" onClick={onLeave}>
          {t.leaveYes}
        </button>
        <button className="secondary" onClick={() => setAsking(false)}>
          {t.stay}
        </button>
      </div>
    </div>
  );
}
