// Your hand (R-TABLE-14): tap a card or drag it onto the table. On your turn that plays it; before
// your turn it becomes your premove. Pointer events, so mouse, touch and pen all work the same.

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CardId } from "@games/trix";
import { Card } from "./cards";

/** How far a finger or mouse must move before a press becomes a drag. */
const DRAG_PX = 6;
/** A drop counts when released this far above the top of the hand. */
const DROP_MARGIN = 12;

interface Press {
  card: CardId;
  x: number;
  y: number;
  moved: boolean;
}

export function Hand(props: {
  cards: CardId[];
  myTurn: boolean;
  /** Legal to play now (on your turn). */
  playable: (c: CardId) => boolean;
  /** Can be chosen as a premove (before your turn). */
  premovable: (c: CardId) => boolean;
  /** Premoves are possible right now (someone else's turn, cards being played). */
  premoveWindow: boolean;
  premove: CardId | null;
  /** A tap or a drop on the table. */
  onChoose: (c: CardId) => void;
  onDragging: (dragging: boolean) => void;
  title: (c: CardId) => string;
}) {
  const handRef = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const [ghost, setGhost] = useState<{ card: CardId; x: number; y: number; w: number } | null>(null);

  const down = (e: ReactPointerEvent<HTMLImageElement>, card: CardId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { card, x: e.clientX, y: e.clientY, moved: false };
  };
  const move = (e: ReactPointerEvent<HTMLImageElement>) => {
    const p = press.current;
    if (!p) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_PX) return;
    if (!p.moved) {
      p.moved = true;
      props.onDragging(true);
    }
    setGhost({ card: p.card, x: e.clientX, y: e.clientY, w: e.currentTarget.getBoundingClientRect().width });
  };
  const up = (e: ReactPointerEvent<HTMLImageElement>) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    if (p.moved) {
      setGhost(null);
      props.onDragging(false);
      const top = handRef.current?.getBoundingClientRect().top ?? 0;
      if (e.clientY < top - DROP_MARGIN) props.onChoose(p.card); // dropped on the table
    } else props.onChoose(p.card); // a tap
  };
  const cancel = () => {
    if (press.current?.moved) props.onDragging(false);
    press.current = null;
    setGhost(null);
  };

  return (
    <div ref={handRef} className={`hand ${props.myTurn ? "my-turn" : ""}`}>
      {props.cards.map((c) => {
        const cls = props.myTurn
          ? props.playable(c)
            ? "legal"
            : "illegal"
          : props.premove === c
            ? "premove"
            : props.premoveWindow && !props.premovable(c)
              ? "blocked"
              : props.premoveWindow
                ? "can-premove"
                : "";
        return (
          <Card
            key={c}
            id={c}
            className={`${cls} ${ghost?.card === c ? "dragging" : ""}`}
            title={props.title(c)}
            onPointerDown={(e) => down(e, c)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={cancel}
          />
        );
      })}
      {ghost && (
        <Card
          id={ghost.card}
          className="drag-ghost"
          style={{ width: ghost.w, left: ghost.x - ghost.w / 2, top: ghost.y - ghost.w * 0.9 }}
        />
      )}
    </div>
  );
}
