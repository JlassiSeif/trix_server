// Trix's bot levels as its pages show them. docs/bots.md §2: how each level feels.

import type { LevelInfo } from "@platform/ui";

export const LEVELS: LevelInfo[] = [
  { id: "easy", label: { en: "Easy", fr: "Facile", ar: "سهل" }, what: { en: "a beginner who knows the rules", fr: "un débutant qui connaît les règles", ar: "مبتدئ يعرف القواعد" } },
  { id: "medium", label: { en: "Medium", fr: "Moyen", ar: "متوسط" }, what: { en: "a decent club player", fr: "un bon joueur de club", ar: "لاعب مقهى متمرّس" } },
  { id: "hard", label: { en: "Hard", fr: "Difficile", ar: "صعب" }, what: { en: "a strong, patient player", fr: "un joueur fort et patient", ar: "لاعب قوي وصبور" } },
];
