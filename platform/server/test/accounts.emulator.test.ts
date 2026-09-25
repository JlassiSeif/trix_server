// Accounts against Firebase's own emulators (Auth + Firestore): real sign-in tokens, real database.
// Run with `npm run test:accounts` (starts the emulators around it). Skipped in the plain test run.

import { describe, expect, it } from "vitest";
import { accountsFromEnv } from "../src/accounts";

const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const DB = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = process.env.FIREBASE_PROJECT_ID ?? "demo-dineri";

/** A new email account in the Auth emulator, and its ID token. */
async function signUp(email: string, displayName?: string): Promise<string> {
  const res = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=any`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "secret-123", returnSecureToken: true, ...(displayName ? { displayName } : {}) }),
  });
  const body = (await res.json()) as { idToken: string };
  if (!displayName) return body.idToken;
  // A display name only lands in the token after an update and a fresh sign-in.
  await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:update?key=any`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken: body.idToken, displayName, returnSecureToken: true }),
  });
  return signIn(email);
}
async function signIn(email: string): Promise<string> {
  const res = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=any`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "secret-123", returnSecureToken: true }),
  });
  return ((await res.json()) as { idToken?: string }).idToken ?? "";
}

describe.skipIf(!AUTH || !DB)("accounts with the Firebase emulators", () => {
  it("a profile is made on first visit, can be edited, and deleting removes the account itself", async () => {
    const accounts = accountsFromEnv(process.env)!;
    expect(accounts).not.toBeNull();
    const email = `amel-${Date.now()}@example.com`;
    const user = await accounts.verify(await signUp(email));
    expect(user.email).toBe(email);

    const first = await accounts.profile(user, "fr");
    expect(first).toMatchObject({ displayName: email.slice(0, email.indexOf("@")).slice(0, 20), language: "fr", provider: "password" });
    expect(await accounts.profile(user, "ar")).toMatchObject({ language: "fr" }); // made once, kept
    expect(await accounts.update(user, { displayName: "  Amel  ", language: "ar" })).toMatchObject({ displayName: "Amel", language: "ar" });
    expect(await accounts.profile(user)).toMatchObject({ displayName: "Amel", language: "ar", createdAt: first.createdAt });
    await expect(accounts.update(user, { language: "de" })).rejects.toThrow();
    await expect(accounts.update(user, { displayName: "" })).rejects.toThrow();

    await accounts.delete(user);
    expect(await signIn(email)).toBe(""); // the sign-in account is gone
    const again = await accounts.profile(user);
    expect(again.displayName).not.toBe("Amel"); // and so was the profile
  });

  it("uses the name from the sign-in (e.g. Google's) when there is one", async () => {
    const accounts = accountsFromEnv(process.env)!;
    const user = await accounts.verify(await signUp(`s-${Date.now()}@example.com`, "Seif Jlassi"));
    expect((await accounts.profile(user)).displayName).toBe("Seif Jlassi");
  });

  it("the database refuses browsers outright (only the server's key gets in)", async () => {
    const token = await signUp(`b-${Date.now()}@example.com`);
    const uid = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()).user_id as string;
    const res = await fetch(`http://${DB}/v1/projects/${PROJECT}/databases/(default)/documents/profiles/${uid}`, { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(403);
  });
});
