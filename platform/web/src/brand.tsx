import { useEffect, useRef, useState } from "react";
import { LANGS, useLang, useText, type GameUI, type Lang } from "@platform/ui";
export { Pips } from "@platform/ui";
import { account, useAccount } from "./account";
import { SignInDialog } from "./screens/SignIn";
import { T } from "./text";

/** Dineri: the hub's name (Seif, 2026-09-25), with a diamond (the dineri) as its mark. The name
 *  is always written in Latin letters, in every language (brand/BRAND.md). */
export function Wordmark() {
  return (
    <span className="wordmark" dir="ltr">
      Dineri
      <span className="wordmark-mark" aria-hidden>
        ♦
      </span>
    </span>
  );
}

/** The bar on every hub page: the name (home, unless we're seated at a table), the language, and
 *  the account (not while seated: leaving the table by accident would be worse than waiting). */
export function TopBar({ go, back = false }: { go?: (path: string) => void; back?: boolean }) {
  const t = useText(T);
  const home = (e: React.MouseEvent) => {
    e.preventDefault();
    go?.("/");
  };
  return (
    <header className="topbar">
      <div className="topbar-start">
        {go ? (
          <a href="/" className="brand" onClick={home} aria-label={t.brandAria}>
            <Wordmark />
          </a>
        ) : (
          <span className="brand">
            <Wordmark />
          </span>
        )}
        {back && go && (
          <a href="/" className="back" onClick={home}>
            {t.allGames}
          </a>
        )}
      </div>
      <div className="topbar-end">
        <LanguageMenu />
        {go && <AccountButton go={go} />}
      </div>
    </header>
  );
}

/** EN / FR / ع: a small menu. */
export function LanguageMenu() {
  const t = useText(T);
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("mousedown", away);
    addEventListener("keydown", esc);
    return () => {
      removeEventListener("mousedown", away);
      removeEventListener("keydown", esc);
    };
  }, [open]);
  const pick = (l: Lang) => {
    account.setLanguage(l);
    setOpen(false);
  };
  return (
    <div className="lang-menu" ref={box}>
      <button className="lang-button" aria-haspopup="menu" aria-expanded={open} aria-label={t.language} onClick={() => setOpen((o) => !o)}>
        <Globe />
        <span>{LANGS.find((l) => l.id === lang)!.short}</span>
      </button>
      {open && (
        <ul className="lang-list" role="menu">
          {LANGS.map((l) => (
            <li key={l.id} role="none">
              <button role="menuitemradio" aria-checked={l.id === lang} lang={l.id} dir={l.dir} onClick={() => pick(l.id)}>
                {l.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Globe() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9s1.3-6.4 3.9-9z" />
    </svg>
  );
}

/** Guests: "Sign in". Signed in: your initial, to your account page. Nothing while accounts are off. */
function AccountButton({ go }: { go: (path: string) => void }) {
  const t = useText(T);
  const acc = useAccount();
  const [dialog, setDialog] = useState(false);
  if (acc.status === "off" || acc.status === "loading") return null;
  if (acc.status === "signedIn" && acc.profile) {
    return (
      <a
        href="/account"
        className="avatar"
        title={t.yourAccount}
        aria-label={t.yourAccount}
        onClick={(e) => {
          e.preventDefault();
          go("/account");
        }}
      >
        {[...acc.profile.displayName][0]!.toUpperCase()}
      </a>
    );
  }
  return (
    <>
      <button className="sign-in secondary" onClick={() => setDialog(true)}>
        {t.signIn}
      </button>
      {dialog && <SignInDialog onClose={() => setDialog(false)} go={go} />}
    </>
  );
}

/** At the bottom of the hub pages. */
export function Footer({ go }: { go: (path: string) => void }) {
  const t = useText(T);
  const link = (to: string, label: string) => (
    <a
      href={to}
      onClick={(e) => {
        e.preventDefault();
        go(to);
      }}
    >
      {label}
    </a>
  );
  return (
    <footer className="footer">
      <nav>
        {link("/about", t.footer.about)}
        {link("/privacy", t.footer.privacy)}
        {link("/terms", t.footer.terms)}
      </nav>
      <p>{t.footer.note}</p>
      <p className="copyright" dir="ltr">
        © 2026 Dineri
      </p>
    </footer>
  );
}

/** A few of the game's own images, fanned out like a hand of cards. */
export function Fan({ game, size = "md" }: { game: GameUI; size?: "md" | "lg" }) {
  const cover = game.cover ?? [];
  if (!cover.length) return null;
  return (
    <span className={`fan ${size}`} aria-hidden>
      {cover.map((src, i) => (
        <img key={src} src={src} alt="" style={{ "--i": i - (cover.length - 1) / 2 } as React.CSSProperties} draggable={false} />
      ))}
    </span>
  );
}

/** A game not turned over yet: a face-down card with its name beside it. */
export function FaceDown({ name }: { name: string }) {
  const t = useText(T);
  return (
    <div className="face-down" role="img" aria-label={t.home.soonAria(name)}>
      <span className="card-back" aria-hidden>
        <span className="medallion" />
      </span>
      <span className="face-down-name">{name}</span>
      <span className="face-down-soon">{t.home.soon}</span>
    </div>
  );
}

/** At a game's table: Dineri's name (not a link: leaving is always deliberate) and the language. */
export function TableChrome() {
  return (
    <>
      <Wordmark />
      <LanguageMenu />
    </>
  );
}
