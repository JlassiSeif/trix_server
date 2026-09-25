// Languages (R-TABLE-9): English, French and Arabic (right to left). Every screen's words live in
// catalogs, one per screen or game, with the same keys in every language: the type checker refuses
// a catalog that misses a line.
//
// The language is chosen once per browser: a choice you made (or your account's, when signed in),
// else the browser's own language when we have it, else English.

import { useSyncExternalStore } from "react";

export type Lang = "en" | "fr" | "ar";

export const LANGS: readonly { id: Lang; name: string; short: string; dir: "ltr" | "rtl" }[] = [
  { id: "en", name: "English", short: "EN", dir: "ltr" },
  { id: "fr", name: "Français", short: "FR", dir: "ltr" },
  { id: "ar", name: "العربية", short: "ع", dir: "rtl" },
];
export const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.id === v);
export const dirOf = (l: Lang) => LANGS.find((x) => x.id === l)!.dir;

const KEY = "dineri.lang";

function stored(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

function detect(): Lang {
  const mine = stored();
  if (mine) return mine;
  for (const tag of typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language]) {
    const l = tag.slice(0, 2).toLowerCase();
    if (isLang(l)) return l;
  }
  return "en";
}

let current: Lang = typeof window === "undefined" ? "en" : detect();
const listeners = new Set<() => void>();

function apply(l: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = l;
  document.documentElement.dir = dirOf(l);
}
apply(current);

export const language = {
  get: () => current,
  /** Did this browser choose (rather than guess from the browser's settings)? */
  chosen: () => stored() !== null,
  set(l: Lang) {
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // blocked storage: the choice lasts until the page is closed
    }
    if (l === current) return;
    current = l;
    apply(l);
    for (const fn of listeners) fn();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
};

export function useLang(): Lang {
  return useSyncExternalStore(language.subscribe, language.get, () => "en" as Lang);
}

/** A catalog: English is the source; French and Arabic must have exactly the same lines. */
export function texts<M extends object>(t: { en: M; fr: NoInfer<M>; ar: NoInfer<M> }): Record<Lang, M> {
  return t;
}

/** The current language's lines from a catalog. */
export function useText<M>(catalog: Record<Lang, M>): M {
  return catalog[useLang()];
}

/** Arabic counts have six forms (zero, one, two, few, many, other); English and French two. */
export function plural(l: Lang, n: number, forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }): string {
  const rule = new Intl.PluralRules(l).select(n);
  return (forms[rule] ?? forms.other).replace("#", String(n));
}

/** "Amel, Sami and Ines" in the current language. */
export function list(l: Lang, items: string[]): string {
  return new Intl.ListFormat(l, { style: "long", type: "conjunction" }).format(items);
}

/** Keeps a signed number or score ("+10", "−50", "×2", "=1") reading left to right inside
 *  right-to-left text, where it would otherwise come out as "10+". Invisible elsewhere. */
export const ltr = (s: string | number) => `⁦${s}⁩`;
