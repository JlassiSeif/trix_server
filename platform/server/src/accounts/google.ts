// The server's own access to Google (Firestore, Firebase Auth admin), from a service-account key,
// without the Firebase Admin library: sign a short JWT with the key, trade it for an access token,
// keep it until shortly before it expires. With the emulators, there is nothing to sign.

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export function readServiceAccount(path: string): ServiceAccount {
  const sa = JSON.parse(readFileSync(path, "utf8")) as ServiceAccount;
  if (!sa.client_email || !sa.private_key || !sa.project_id) throw new Error(`not a service-account key: ${path}`);
  return sa;
}

/** Access tokens for Google APIs. `null` = the emulators ("owner" bypasses their rules). */
export class GoogleAuth {
  private token: string | null = null;
  private until = 0;

  constructor(
    private readonly sa: ServiceAccount | null,
    private readonly now: () => number = Date.now,
  ) {}

  async bearer(): Promise<string> {
    if (!this.sa) return "owner";
    if (this.token && this.now() < this.until) return this.token;
    const iat = Math.floor(this.now() / 1000);
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
      iss: this.sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    })}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(this.sa.private_key).toString("base64url");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
    });
    if (!res.ok) throw new Error(`Google token exchange failed: HTTP ${res.status}`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.token = body.access_token;
    this.until = this.now() + (body.expires_in - 120) * 1000;
    return this.token;
  }
}
