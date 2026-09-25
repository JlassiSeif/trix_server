import { useEffect, useRef, useState, type FormEvent } from "react";
import { useText } from "@platform/ui";
import { account, useAccount } from "../account";
import { TopBar } from "../brand";
import { T } from "../text";

/** Sign in: Google, or a link by email. Optional, and it says so. */
export function SignInDialog({ onClose, go }: { onClose: () => void; go: (path: string) => void }) {
  const t = useText(T);
  const acc = useAccount();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    account.clearError();
    dialog.current?.showModal();
  }, []);
  // Signed in (Google's pop-up came back): done.
  useEffect(() => {
    if (acc.status === "signedIn") onClose();
  }, [acc.status, onClose]);

  const google = async () => {
    setBusy(true);
    await account.google();
    setBusy(false);
  };
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (await account.sendLink(email)) setSentTo(email.trim());
    setBusy(false);
  };
  const legal = (to: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onClose();
    go(to);
  };

  return (
    <dialog ref={dialog} className="hub-dialog" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()} aria-labelledby="signin-title">
      <div className="dialog-body">
        <button className="dialog-close" onClick={onClose} aria-label={t.signin.close}>
          ×
        </button>
        <h2 id="signin-title">{t.signin.title}</h2>
        <p className="hint">{t.signin.why}</p>
        {sentTo ? (
          <div className="sent" role="status">
            <p>{t.signin.sent(sentTo)}</p>
            <p className="hint">{t.signin.spam}</p>
            <button className="secondary" onClick={onClose}>
              {t.signin.close}
            </button>
          </div>
        ) : (
          <>
            <button className="google" onClick={google} disabled={busy}>
              <GoogleG />
              {t.signin.google}
            </button>
            <p className="divider">
              <span>{t.signin.or}</span>
            </p>
            <form onSubmit={send}>
              <label htmlFor="signin-email">{t.signin.email}</label>
              <input id="signin-email" type="email" required autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.signin.emailPlaceholder} />
              <button type="submit" className="primary" disabled={busy || !email.trim()}>
                {t.signin.sendLink}
              </button>
            </form>
          </>
        )}
        {acc.error && (
          <p className="error" role="alert">
            {t.errors[acc.error]}
          </p>
        )}
        <p className="fine">
          <a href="/terms" onClick={legal("/terms")}>
            {t.footer.terms}
          </a>
          {" · "}
          <a href="/privacy" onClick={legal("/privacy")}>
            {t.footer.privacy}
          </a>
          <span className="hint"> {t.signin.terms}</span>
        </p>
      </div>
    </dialog>
  );
}

/** /signin: where the email link lands. Same browser: signs straight in. Another browser: asks
 *  for the email again (Firebase's protection against someone else's forwarded link). */
export function SignInPage({ go }: { go: (path: string) => void }) {
  const t = useText(T);
  const acc = useAccount();
  const [stage, setStage] = useState<"checking" | "ask" | "working" | "done" | "bad">("checking");
  const [email, setEmail] = useState("");
  const started = useRef(false);

  const finish = async (address: string) => {
    setStage("working");
    if (await account.finishLink(address)) {
      history.replaceState(null, "", "/signin"); // the link's code is spent: don't keep it around
      setStage("done");
    } else setStage("bad");
  };

  useEffect(() => {
    if (acc.status === "loading" || acc.status === "off" || started.current) return;
    started.current = true;
    void (async () => {
      if (!(await account.isLink())) return setStage(acc.status === "signedIn" ? "done" : "bad");
      const known = account.emailForLink();
      if (known) await finish(known);
      else setStage("ask");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acc.status]);

  return (
    <div className="hub entry">
      <TopBar go={go} back />
      <main className="plain">
        <h1>{t.signin.title}</h1>
        {(stage === "checking" || stage === "working") && <p className="lede">{t.signin.finishing}</p>}
        {stage === "ask" && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void finish(email);
            }}
          >
            <label htmlFor="confirm-email">{t.signin.confirmEmail}</label>
            <input id="confirm-email" type="email" required autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className="primary" disabled={!email.trim()}>
              {t.signin.finish}
            </button>
          </form>
        )}
        {stage === "done" && (
          <>
            <p className="lede">{acc.profile ? t.entry.signedInAs(acc.profile.displayName) : t.signin.done}</p>
            <button className="primary" onClick={() => go("/")}>
              {t.signin.toHub}
            </button>
          </>
        )}
        {stage === "bad" && (
          <>
            <p className="error" role="alert">
              {t.errors[acc.status === "off" ? "not-available" : (acc.error ?? "link-expired")]}
            </p>
            <button className="secondary" onClick={() => go("/")}>
              {t.signin.toHub}
            </button>
          </>
        )}
      </main>
    </div>
  );
}

/** Google's "G", as Google asks sign-in buttons to show it. */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
