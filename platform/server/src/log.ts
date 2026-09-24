// Structured logs: one JSON object per line, so runs can be searched and replayed.
// TRIX_LOG_LEVEL = debug | info (default) | warn | error | silent. Silent by default under tests.

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level | "silent", number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

function threshold(): number {
  const env = process.env.TRIX_LOG_LEVEL as Level | "silent" | undefined;
  if (env && env in ORDER) return ORDER[env];
  return process.env.VITEST ? ORDER.silent : ORDER.info;
}
const min = threshold();

export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  if (ORDER[level] < min) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...fields }, (_k, v) =>
    v instanceof Error ? { message: v.message, stack: v.stack } : v,
  );
  (level === "warn" || level === "error" ? process.stderr : process.stdout).write(line + "\n");
}

/** Shorten untrusted input before it goes into a log line. */
export const clip = (s: string, n = 200) => (s.length > n ? `${s.slice(0, n)}…(${s.length} chars)` : s);
