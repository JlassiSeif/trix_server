// Accounts (docs/architecture.md §7): Firebase Authentication proves who someone is; the server keeps
// their profile in Firestore. Accounts are optional: guests play exactly as before (Seif, 2026-09-25).
//
// Configured from the environment:
//   FIREBASE_PROJECT_ID              default dineri-world
//   FIREBASE_SERVICE_ACCOUNT_PATH    the server's key (production): a mounted secret, never in git
//   FIREBASE_AUTH_EMULATOR_HOST, FIRESTORE_EMULATOR_HOST   the local emulators (development, tests)
// Neither a key nor the emulators: accounts are off, and the site simply offers no sign-in.

import { existsSync } from "node:fs";
import { log } from "../log";
import { cleanName } from "../room";
import { Firestore, type Json } from "./firestore";
import { GoogleAuth, readServiceAccount } from "./google";
import { TokenVerifier, type VerifiedUser } from "./token";

export { TokenError, type VerifiedUser } from "./token";

export const LANGUAGES = ["en", "fr", "ar"] as const;
export type Language = (typeof LANGUAGES)[number];
const isLanguage = (v: unknown): v is Language => LANGUAGES.includes(v as Language);

export interface Profile {
  uid: string;
  displayName: string;
  language: Language;
  email: string | null;
  provider: string | null;
  createdAt: string;
}

export class AccountError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class Accounts {
  constructor(
    readonly projectId: string,
    private readonly tokens: TokenVerifier,
    private readonly db: Firestore,
    private readonly google: GoogleAuth,
    private readonly authEmulatorHost?: string,
  ) {}

  verify(token: unknown): Promise<VerifiedUser> {
    return this.tokens.verify(token);
  }

  /** The signed-in player's profile, made on their first visit. */
  async profile(user: VerifiedUser, languageHint?: unknown): Promise<Profile> {
    const doc = await this.db.get(`profiles/${user.uid}`);
    if (doc) return this.toProfile(user, doc);
    const fromEmail = user.email ? user.email.slice(0, user.email.indexOf("@")) : null;
    const now = new Date().toISOString();
    const fresh = {
      displayName: cleanName(user.name) ?? cleanName(fromEmail) ?? "Player",
      language: isLanguage(languageHint) ? languageHint : "en",
      createdAt: now,
      updatedAt: now,
    };
    await this.db.set(`profiles/${user.uid}`, fresh);
    return this.toProfile(user, fresh);
  }

  async update(user: VerifiedUser, patch: { displayName?: unknown; language?: unknown }): Promise<Profile> {
    const current = await this.profile(user);
    const next: Record<string, Json> = { displayName: current.displayName, language: current.language, createdAt: current.createdAt, updatedAt: new Date().toISOString() };
    if (patch.displayName !== undefined) {
      const name = cleanName(patch.displayName);
      if (!name) throw new AccountError("BAD_NAME", "Pick a name (1 to 20 characters)");
      next.displayName = name;
    }
    if (patch.language !== undefined) {
      if (!isLanguage(patch.language)) throw new AccountError("BAD_LANGUAGE", "Unknown language");
      next.language = patch.language;
    }
    await this.db.set(`profiles/${user.uid}`, next);
    return this.toProfile(user, next);
  }

  /** Deletes everything we keep about them: the profile, then the sign-in account itself. */
  async delete(user: VerifiedUser): Promise<void> {
    await this.db.delete(`profiles/${user.uid}`);
    const host = this.authEmulatorHost ? `http://${this.authEmulatorHost}/identitytoolkit.googleapis.com` : "https://identitytoolkit.googleapis.com";
    const res = await fetch(`${host}/v1/projects/${this.projectId}/accounts:delete`, {
      method: "POST",
      headers: { authorization: `Bearer ${await this.google.bearer()}`, "content-type": "application/json" },
      body: JSON.stringify({ localId: user.uid }),
    });
    if (!res.ok) throw new Error(`deleting the sign-in account failed: HTTP ${res.status}`);
  }

  private toProfile(user: VerifiedUser, doc: Record<string, Json>): Profile {
    return {
      uid: user.uid,
      displayName: typeof doc.displayName === "string" ? doc.displayName : "Player",
      language: isLanguage(doc.language) ? doc.language : "en",
      email: user.email,
      provider: user.provider,
      createdAt: typeof doc.createdAt === "string" ? doc.createdAt : "",
    };
  }
}

/** Accounts from the environment, or null when neither a key nor the emulators are configured. */
export function accountsFromEnv(env: NodeJS.ProcessEnv): Accounts | null {
  const projectId = env.FIREBASE_PROJECT_ID || "dineri-world";
  const authEmu = env.FIREBASE_AUTH_EMULATOR_HOST || undefined;
  const dbEmu = env.FIRESTORE_EMULATOR_HOST || undefined;
  const keyPath = env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (authEmu && dbEmu) {
    const google = new GoogleAuth(null);
    return new Accounts(projectId, new TokenVerifier(projectId, true), new Firestore(projectId, google, dbEmu), google, authEmu);
  }
  if (keyPath && existsSync(keyPath)) {
    try {
      const google = new GoogleAuth(readServiceAccount(keyPath));
      return new Accounts(projectId, new TokenVerifier(projectId), new Firestore(projectId, google), google);
    } catch (error) {
      // A broken key must not take the games down with it: run without sign-in, and say why.
      log("error", "accounts.badKey", { path: keyPath, error });
      return null;
    }
  }
  return null;
}
