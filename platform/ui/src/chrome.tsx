// Dineri's name and the language menu at a game's table (docs/game-look.md §1, "Frame"). The hub
// provides them; a game's table places <TableHeader /> at the top of its side panel.

import { createContext, useContext, type ComponentType } from "react";

const Chrome = createContext<ComponentType | null>(null);
export const TableChromeProvider = Chrome.Provider;

export function TableHeader() {
  const Inner = useContext(Chrome);
  return Inner ? (
    <div className="table-header">
      <Inner />
    </div>
  ) : null;
}
