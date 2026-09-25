// Firebase sign-in in the browser. Loaded only when someone signs in, or was signed in before
// (account.ts), so guests never download it.

import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  isSignInWithEmailLink,
  onIdTokenChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";

export interface FirebaseWeb {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  authEmulator?: string;
}

export interface Session {
  uid: string;
  email: string | null;
  provider: string | null;
  token: () => Promise<string>;
}

let auth: Auth | null = null;

export function start(config: FirebaseWeb, lang: string, onChange: (s: Session | null) => void): void {
  if (auth) return;
  const app = initializeApp({ apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId, appId: config.appId });
  auth = getAuth(app);
  if (config.authEmulator) connectAuthEmulator(auth, config.authEmulator, { disableWarnings: true });
  auth.languageCode = lang;
  onIdTokenChanged(auth, (user: User | null) => onChange(user ? session(user) : null));
}

const session = (user: User): Session => ({
  uid: user.uid,
  email: user.email,
  provider: user.providerData[0]?.providerId ?? null,
  token: () => user.getIdToken(),
});

const need = () => {
  if (!auth) throw new Error("firebase not started");
  return auth;
};

export function setLanguage(lang: string): void {
  if (auth) auth.languageCode = lang;
}

/** A pop-up where the browser allows it; a full-page trip to Google where it doesn't. */
export async function google(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(need(), provider);
  } catch (e) {
    if ((e as { code?: string }).code === "auth/popup-blocked") return signInWithRedirect(need(), provider);
    throw e;
  }
}

export async function emailLink(email: string, lang: string): Promise<void> {
  await sendSignInLinkToEmail(need(), email, { url: `${location.origin}/signin?lang=${lang}`, handleCodeInApp: true });
}

export const isEmailLink = (href: string) => isSignInWithEmailLink(need(), href);

export async function finishEmailLink(email: string, href: string): Promise<void> {
  await signInWithEmailLink(need(), email, href);
}

export const out = () => signOut(need());
