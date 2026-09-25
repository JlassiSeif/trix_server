// A small Firestore client over its REST API: get, set (whole document) and delete, with plain JSON
// values. Enough for profiles; the server is the only one that touches the database (the security
// rules deny all browser access, firebase/firestore.rules).

import type { GoogleAuth } from "./google";

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Value =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: Value[] } }
  | { mapValue: { fields?: Record<string, Value> } }
  | { timestampValue: string };

export function encode(v: Json): Value {
  if (v === null) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)])) } };
}

export function decode(v: Value): Json {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decode);
  return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, decode(x)]));
}

export class Firestore {
  private readonly base: string;

  constructor(
    projectId: string,
    private readonly auth: GoogleAuth,
    /** e.g. "127.0.0.1:8081" for the emulator; unset for the real database. */
    emulatorHost?: string,
  ) {
    this.base = `${emulatorHost ? `http://${emulatorHost}` : "https://firestore.googleapis.com"}/v1/projects/${projectId}/databases/(default)/documents`;
  }

  private async call(method: string, path: string, body?: unknown): Promise<Response> {
    if (!/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)+$/.test(path)) throw new Error(`bad document path: ${path}`);
    return fetch(`${this.base}/${path}`, {
      method,
      headers: { authorization: `Bearer ${await this.auth.bearer()}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async get(path: string): Promise<Record<string, Json> | null> {
    const res = await this.call("GET", path);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore get ${path}: HTTP ${res.status}`);
    const doc = (await res.json()) as { fields?: Record<string, Value> };
    return Object.fromEntries(Object.entries(doc.fields ?? {}).map(([k, v]) => [k, decode(v)]));
  }

  /** Writes the whole document (creates it or replaces every field). */
  async set(path: string, data: Record<string, Json>): Promise<void> {
    const res = await this.call("PATCH", path, { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)])) });
    if (!res.ok) throw new Error(`Firestore set ${path}: HTTP ${res.status}`);
  }

  async delete(path: string): Promise<void> {
    const res = await this.call("DELETE", path);
    if (!res.ok && res.status !== 404) throw new Error(`Firestore delete ${path}: HTTP ${res.status}`);
  }
}
