import { useEffect, useState, type FormEvent } from "react";
import { NAME_MAX } from "@platform/protocol";
import { LANGS, useLang, useText } from "@platform/ui";
import { account, useAccount } from "../account";
import { Footer, TopBar } from "../brand";
import { T } from "../text";

/** /account: your name at the table, your language, sign out, delete everything. */
export function AccountPage({ go }: { go: (path: string) => void }) {
  const t = useText(T);
  const acc = useAccount();
  const lang = useLang();
  const [name, setName] = useState(acc.profile?.displayName ?? "");
  const [saved, setSaved] = useState(false);
  const [asking, setAsking] = useState(false);
  const [deleted, setDeleted] = useState(false);
  useEffect(() => {
    if (acc.profile) setName(acc.profile.displayName);
  }, [acc.profile?.displayName]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (await account.update({ displayName: name })) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    }
  };
  const remove = async () => {
    if (await account.deleteAccount()) setDeleted(true);
  };

  const p = acc.profile;
  return (
    <div className="hub entry">
      <TopBar go={go} back />
      <main className="page account-page">
        <h1>{t.account.title}</h1>
        {deleted ? (
          <p className="lede" role="status">
            {t.account.deleted}
          </p>
        ) : acc.status === "loading" ? null : !p ? (
          <p className="lede">{t.account.signedOut}</p>
        ) : (
          <>
            <p className="hint who">
              <span dir="ltr">{p.email}</span> · {t.account.signedInWith(p.provider === "google.com" ? t.account.google : t.account.emailLink)}
            </p>
            <section className="panel-box">
              <form onSubmit={save} className="stack">
                <label htmlFor="acc-name">{t.account.name}</label>
                <div className="inline">
                  <input id="acc-name" maxLength={NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
                  <button type="submit" className="primary" disabled={!name.trim() || name.trim() === p.displayName}>
                    {saved ? t.account.saved : t.account.save}
                  </button>
                </div>
                <p className="hint">{t.account.nameHint}</p>
              </form>
            </section>
            <section className="panel-box">
              <h2 id="acc-lang">{t.account.language}</h2>
              <div className="levels lang-choice" role="radiogroup" aria-labelledby="acc-lang">
                {LANGS.map((l) => (
                  <button key={l.id} role="radio" aria-checked={l.id === lang} className={l.id === lang ? "chosen" : "secondary"} lang={l.id} onClick={() => account.setLanguage(l.id)}>
                    {l.name}
                  </button>
                ))}
              </div>
            </section>
            <button className="secondary" onClick={() => account.signOut()}>
              {t.account.signOut}
            </button>
            <section className="panel-box danger-zone">
              <h2>{t.account.deleteTitle}</h2>
              <p className="hint">{t.account.deleteWhat}</p>
              {asking ? (
                <div className="stack">
                  <p>{t.account.deleteAsk}</p>
                  <div className="row start">
                    <button className="danger" onClick={remove}>
                      {t.account.deleteYes}
                    </button>
                    <button className="secondary" onClick={() => setAsking(false)}>
                      {t.account.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <button className="danger" onClick={() => setAsking(true)}>
                  {t.account.deleteTitle}
                </button>
              )}
            </section>
          </>
        )}
        {acc.error && (
          <p className="error" role="alert">
            {t.errors[acc.error]}
          </p>
        )}
      </main>
      <Footer go={go} />
    </div>
  );
}
