// Verifying Firebase ID tokens (the proof a browser sends that someone signed in), without the
// Firebase Admin library, which is too heavy for the server's memory cap. This follows Firebase's
// documented checks: RS256 signed by one of Google's rotating certificates, audience = our project,
// issuer = securetoken.google.com/<project>, not expired, issued in the past, a non-empty subject.

import { createPublicKey, createVerify } from "node:crypto";

const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

export interface VerifiedUser {
  uid: string;
  email: string | null;
  name: string | null;
  /** How they signed in: "google.com", "password" (an email link), … */
  provider: string | null;
}

export class TokenError extends Error {}

type Fetch = (url: string) => Promise<{ ok: boolean; headers: { get(name: string): string | null }; json(): Promise<unknown> }>;

const b64json = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;

export class TokenVerifier {
  private certs: Record<string, string> = {};
  private certsUntil = 0;

  constructor(
    private readonly projectId: string,
    /** The Auth emulator signs nothing: only then are unsigned tokens accepted. */
    private readonly emulator = false,
    private readonly fetchImpl: Fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async verify(token: unknown): Promise<VerifiedUser> {
    if (typeof token !== "string" || token.length > 4096) throw new TokenError("not a token");
    const parts = token.split(".");
    if (parts.length !== 3) throw new TokenError("not a token");
    let header: Record<string, unknown>;
    let claims: Record<string, unknown>;
    try {
      header = b64json(parts[0]!);
      claims = b64json(parts[1]!);
    } catch {
      throw new TokenError("not a token");
    }
    if (this.emulator) {
      // Emulator tokens are unsigned; everything but the signature is still checked.
    } else {
      if (header.alg !== "RS256" || typeof header.kid !== "string") throw new TokenError("wrong algorithm");
      const cert = await this.cert(header.kid);
      const ok = createVerify("RSA-SHA256").update(`${parts[0]}.${parts[1]}`).verify(createPublicKey(cert), Buffer.from(parts[2]!, "base64url"));
      if (!ok) throw new TokenError("bad signature");
    }
    const nowS = Math.floor(this.now() / 1000);
    if (claims.aud !== this.projectId) throw new TokenError("wrong audience");
    if (claims.iss !== `https://securetoken.google.com/${this.projectId}`) throw new TokenError("wrong issuer");
    if (typeof claims.exp !== "number" || claims.exp <= nowS) throw new TokenError("expired");
    if (typeof claims.iat !== "number" || claims.iat > nowS + 300) throw new TokenError("issued in the future");
    if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 128) throw new TokenError("no subject");
    const firebase = (claims.firebase ?? {}) as { sign_in_provider?: unknown };
    return {
      uid: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
      name: typeof claims.name === "string" ? claims.name : null,
      provider: typeof firebase.sign_in_provider === "string" ? firebase.sign_in_provider : null,
    };
  }

  /** Google's current certificates, cached as long as Google says (Cache-Control max-age). */
  private async cert(kid: string): Promise<string> {
    if (this.now() >= this.certsUntil || !this.certs[kid]) {
      const res = await this.fetchImpl(CERTS_URL);
      if (!res.ok) throw new TokenError("certificates unavailable");
      this.certs = (await res.json()) as Record<string, string>;
      const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] ?? 3600);
      this.certsUntil = this.now() + maxAge * 1000;
    }
    const cert = this.certs[kid];
    if (!cert) throw new TokenError("unknown key");
    return cert;
  }
}
