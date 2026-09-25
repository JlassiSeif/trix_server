// Accounts in the browser (docs/architecture.md §7). Optional: guests play everything.
//
// Sign-in is Firebase's (Google, or a link by email); the profile (name at the table, language)
// is the server's (/api/me). Firebase's code is only downloaded when someone signs in, or was
// signed in on this browser before, so the site stays light for guests.

import { useSyncExternalStore } from "react";
import { language, savedName, type Connection, type Lang } from "@platform/ui";
import type { AccountErrorKey } from "./text";
import type { FirebaseWeb, Session } from "./firebase";

export interface Profile {
  uid: string;
  displayName: string;
  language: Lang;
  email: string | null;
  provider: string | null;
  createdAt: string;
}

export interface AccountState {
  /** off: this server has no accounts. loading: finding out. guest / signedIn: as it says. */
  status: "off" | "loading" | "guest" | "signedIn";
  profile: Profile | null;
  /** The last thing that went wrong, as a line in the text catalog. */
  error: AccountErrorKey | null;
}

const WAS_SIGNED_IN = "dineri.auth";
const EMAIL_FOR_LINK = "dineri.emailForLink";

let state: AccountState = { status: "loading", profile: null, error: null };
const listeners = new Set<() => void>();
function set(patch: Partial<AccountState>) {
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    () => state,
  );
}

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      // blocked storage: sign-in still works for this visit
    }
  },
};

let config: FirebaseWeb | null = null;
let fb: typeof import("./firebase") | null = null;
let session: Session | null = null;
let identify: Connection["identify"] = () => undefined;
let started = false;
let loading: Promise<typeof import("./firebase")> | null = null;
// Resolved once Firebase has said who this browser is (or isn't) after the page loaded.
let settle: () => void = () => undefined;
const settled = new Promise<void>((ok) => (settle = ok));

/** Firebase codes → a friendly line. Firebase's own messages are never shown. */
function friendly(e: unknown): AccountErrorKey | null {
  const code = (e as { code?: string })?.code ?? "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || code === "auth/user-cancelled") return null;
  if (code === "auth/invalid-email" || code === "auth/missing-email") return "invalid-email";
  if (code === "auth/network-request-failed") return "network";
  if (code === "auth/too-many-requests" || code === "auth/quota-exceeded") return "too-many";
  if (code === "auth/invalid-action-code" || code === "auth/expired-action-code") return "link-expired";
  if (code === "auth/popup-blocked") return "popup-blocked";
  if (code === "auth/account-exists-with-different-credential") return "account-exists";
  if (code === "auth/unauthorized-domain" || code === "auth/operation-not-allowed" || code === "auth/unauthorized-continue-uri") return "not-available";
  return "generic";
}

async function api(method: "GET" | "PUT" | "DELETE", body?: object): Promise<Profile | { deleted: true }> {
  if (!session) throw Object.assign(new Error("signed out"), { key: "signed-out" as AccountErrorKey });
  const res = await fetch(`/api/me?lang=${language.get()}`, {
    method,
    headers: { authorization: `Bearer ${await session.token()}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return res.json();
  const err = (await res.json().catch(() => ({}))) as { error?: string };
  const key: AccountErrorKey = res.status === 401 ? "signed-out" : err.error === "BAD_NAME" ? "bad-name" : res.status === 429 ? "too-many" : "generic";
  throw Object.assign(new Error(err.error ?? String(res.status)), { key });
}
const keyOf = (e: unknown): AccountErrorKey => (e as { key?: AccountErrorKey }).key ?? friendly(e) ?? "generic";

function load(): Promise<typeof import("./firebase")> {
  if (!config) return Promise.reject(Object.assign(new Error("accounts off"), { key: "not-available" }));
  loading ??= import("./firebase").then((m) => {
    fb = m;
    m.start(config!, language.get(), onSession);
    return m;
  });
  return loading;
}

async function onSession(s: Session | null) {
  const before = session?.uid;
  session = s;
  if (!s) {
    store.set(WAS_SIGNED_IN, null);
    identify(null);
    set({ status: "guest", profile: null });
    settle();
    return;
  }
  store.set(WAS_SIGNED_IN, "1");
  identify(() => s.token());
  if (before === s.uid && state.profile) return; // just a token refresh
  try {
    const profile = (await api("GET")) as Profile;
    // Your account's language follows you to this device.
    language.set(profile.language);
    fb?.setLanguage(profile.language);
    if (!savedName.get()) savedName.set(profile.displayName);
    set({ status: "signedIn", profile, error: null });
  } catch (e) {
    set({ status: "guest", profile: null, error: keyOf(e) });
  }
  settle();
}

export const account = {
  /** Once, on page load: find out whether accounts are on; reconnect a returning player. */
  async init(connectionIdentify: Connection["identify"]): Promise<void> {
    identify = connectionIdentify;
    if (started) return;
    started = true;
    try {
      const res = await fetch("/api/config");
      const c = (await res.json()) as { accounts: boolean; firebase: FirebaseWeb | null };
      if (!c.accounts || !c.firebase) return set({ status: "off" });
      config = c.firebase;
    } catch {
      return set({ status: "off" });
    }
    // Only returning players (and people opening a sign-in link) load Firebase straight away.
    if (store.get(WAS_SIGNED_IN) || location.pathname === "/signin") {
      // The connection's first message waits until Firebase says who this is (or isn't).
      identify(() => settled.then(() => (session ? session.token() : null)));
      await load().catch(() => {
        set({ status: "guest" });
        settle();
      });
    } else set({ status: "guest" });
  },

  async google(): Promise<boolean> {
    set({ error: null });
    try {
      await (await load()).google();
      return true;
    } catch (e) {
      set({ error: friendly(e) });
      return false;
    }
  },

  async sendLink(email: string): Promise<boolean> {
    set({ error: null });
    try {
      await (await load()).emailLink(email.trim(), language.get());
      store.set(EMAIL_FOR_LINK, email.trim());
      return true;
    } catch (e) {
      set({ error: friendly(e) });
      return false;
    }
  },

  /** On /signin: the email this browser asked with, if it's the same browser. */
  emailForLink: () => store.get(EMAIL_FOR_LINK),

  async isLink(): Promise<boolean> {
    try {
      return (await load()).isEmailLink(location.href);
    } catch {
      return false;
    }
  },

  async finishLink(email: string): Promise<boolean> {
    set({ error: null });
    try {
      await (await load()).finishEmailLink(email.trim(), location.href);
      store.set(EMAIL_FOR_LINK, null);
      return true;
    } catch (e) {
      set({ error: friendly(e) });
      return false;
    }
  },

  async update(patch: { displayName?: string; language?: Lang }): Promise<boolean> {
    set({ error: null });
    try {
      const profile = (await api("PUT", patch)) as Profile;
      if (patch.displayName !== undefined) savedName.set(profile.displayName); // the next table's name
      set({ profile });
      return true;
    } catch (e) {
      set({ error: keyOf(e) });
      return false;
    }
  },

  /** The language switcher: this device at once, and the account when signed in. */
  setLanguage(l: Lang): void {
    language.set(l);
    fb?.setLanguage(l);
    if (state.status === "signedIn" && state.profile?.language !== l) void account.update({ language: l });
  },

  async signOut(): Promise<void> {
    await fb?.out();
  },

  async deleteAccount(): Promise<boolean> {
    set({ error: null });
    try {
      await api("DELETE");
      await fb?.out().catch(() => undefined);
      return true;
    } catch (e) {
      set({ error: keyOf(e) });
      return false;
    }
  },

  clearError: () => set({ error: null }),
};
