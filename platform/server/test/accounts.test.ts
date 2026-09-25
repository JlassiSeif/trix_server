// Accounts, piece by piece: sign-in proofs (Firebase ID tokens) and the database's value format.
// The whole thing against Firebase's own emulators: test/accounts.emulator.test.ts.

import { describe, expect, it } from "vitest";
import { generateKeyPairSync, createSign } from "node:crypto";
import { TokenError, TokenVerifier } from "../src/accounts/token";
import { decode, encode, type Json } from "../src/accounts/firestore";

const NOW = 1_800_000_000_000;
const nowS = NOW / 1000;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = publicKey.export({ type: "spki", format: "pem" }).toString();

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token(claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}, key = privateKey): string {
  const unsigned = `${b64({ alg: "RS256", kid: "k1", typ: "JWT", ...header })}.${b64({
    aud: "dineri-world",
    iss: "https://securetoken.google.com/dineri-world",
    sub: "uid-1",
    iat: nowS - 60,
    exp: nowS + 3000,
    email: "seif@example.com",
    name: "Seif",
    firebase: { sign_in_provider: "google.com" },
    ...claims,
  })}`;
  return `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(key).toString("base64url")}`;
}

function verifier(emulator = false) {
  let fetches = 0;
  const v = new TokenVerifier(
    "dineri-world",
    emulator,
    async () => {
      fetches++;
      return { ok: true, headers: { get: () => "public, max-age=600" }, json: async () => ({ k1: pem }) };
    },
    () => NOW,
  );
  return { v, fetches: () => fetches };
}

describe("sign-in proofs (Firebase ID tokens)", () => {
  it("accepts a proper token and says who it is; fetches Google's keys once", async () => {
    const { v, fetches } = verifier();
    expect(await v.verify(token())).toEqual({ uid: "uid-1", email: "seif@example.com", name: "Seif", provider: "google.com" });
    await v.verify(token());
    expect(fetches()).toBe(1);
  });

  it.each([
    ["signed with another key", token({}, {}, other.privateKey)],
    ["for another project", token({ aud: "someone-else" })],
    ["from another issuer", token({ iss: "https://securetoken.google.com/someone-else" })],
    ["expired", token({ exp: nowS - 1 })],
    ["issued in the future", token({ iat: nowS + 3600 })],
    ["without a subject", token({ sub: "" })],
    ["with an unknown key id", token({}, { kid: "k9" })],
    ["with another algorithm", token({}, { alg: "none" })],
    ["that is not a token", "hello"],
    ["that is not a string", 42],
  ])("refuses a token %s", async (_why, t) => {
    await expect(verifier().v.verify(t)).rejects.toBeInstanceOf(TokenError);
  });

  it("with the emulator, skips only the signature", async () => {
    const { v } = verifier(true);
    const unsigned = token({}, { alg: "none" }).split(".").slice(0, 2).join(".") + ".";
    expect((await v.verify(unsigned)).uid).toBe("uid-1");
    await expect(v.verify(token({ aud: "someone-else" }, { alg: "none" }))).rejects.toBeInstanceOf(TokenError);
  });
});

describe("database values", () => {
  it("round-trip through Firestore's format", () => {
    const doc: Json = { s: "Seif", n: 3, f: 1.5, b: true, z: null, a: [1, "x"], m: { deep: { er: "yes" } } };
    expect(decode(encode(doc))).toEqual(doc);
    expect(encode(3)).toEqual({ integerValue: "3" });
  });
});

describe("configuration", () => {
  it("accounts are off without a key or emulators, and a broken key doesn't crash the server", async () => {
    const { accountsFromEnv } = await import("../src/accounts");
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    expect(accountsFromEnv({})).toBeNull();
    expect(accountsFromEnv({ FIREBASE_SERVICE_ACCOUNT_PATH: "/nowhere/key.json" })).toBeNull();
    const dir = mkdtempSync(join(tmpdir(), "acc-"));
    writeFileSync(join(dir, "key.json"), "{not json");
    expect(accountsFromEnv({ FIREBASE_SERVICE_ACCOUNT_PATH: join(dir, "key.json") })).toBeNull();
    expect(accountsFromEnv({ FIREBASE_SERVICE_ACCOUNT_PATH: dir })).toBeNull(); // a folder, as Docker makes for a missing file
  });
});
