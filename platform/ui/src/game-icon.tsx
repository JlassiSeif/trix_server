// Game icons (docs/game-look.md): simple line drawings on a 48×48 grid, drawn in the current text
// colour, so the same icon works in brass on a card back's medallion and in ink on an ivory tile.
// Shapes that must hide what's behind them fill with `--icon-bg` (set by the place showing the icon).

import type { ComponentType, ReactNode } from "react";

export function IconSvg({ children }: { children: ReactNode }) {
  return (
    <svg className="game-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

/** A game's icon on an ivory tile with a brass edge: next to its name on its page and in its lobby. */
export function GameBadge({ Icon, size = 44 }: { Icon: ComponentType; size?: number }) {
  return (
    <span className="game-badge" style={{ width: size, height: size }}>
      <Icon />
    </span>
  );
}
