// Icons for the games not built yet (on their face-down cards on the home page). When a game is
// built, its icon moves into its own package (games/<game>/ui) as part of its GameUI.

import { IconSvg } from "@platform/ui";

/** Chkobba: a 7♦ (el haya) and the sweep that clears the table. */
export function ChkobbaIcon() {
  return (
    <IconSvg>
      <rect x="15" y="6" width="18" height="25" rx="3" />
      <path d="M24 12.5l4.5 6-4.5 6-4.5-6z" fill="currentColor" stroke="none" />
      <path d="M40 34c-4.5 6-11 8.5-16 8.5S12.5 40 8 34" />
      <path d="M8 34l.6 5.6M8 34l5.5 1.4" />
    </IconSvg>
  );
}

/** Rami: a run of three cards, one, two and three pips. */
export function RamiIcon() {
  const pip = (cx: number, cy: number) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.9" fill="currentColor" stroke="none" />;
  return (
    <IconSvg>
      <rect x="5" y="12" width="17" height="25" rx="3" />
      <rect x="15" y="12" width="17" height="25" rx="3" fill="var(--icon-bg, transparent)" />
      <rect x="25" y="12" width="17" height="25" rx="3" fill="var(--icon-bg, transparent)" />
      {pip(10, 24.5)}
      {[pip(20, 20), pip(20, 29)]}
      {[pip(33.5, 17.5), pip(33.5, 24.5), pip(33.5, 31.5)]}
    </IconSvg>
  );
}

/** Belote: two cards, the front one crowned ("belote, rebelote": the king and queen of trumps). */
export function BeloteIcon() {
  return (
    <IconSvg>
      <rect x="8" y="9" width="19" height="27" rx="3" transform="rotate(-14 17.5 22.5)" />
      <g transform="rotate(10 28.5 25.5)">
        <rect x="19" y="12" width="19" height="27" rx="3" fill="var(--icon-bg, transparent)" />
        <path d="M22.5 29.5v-8l3.5 4 2.5-5.5 2.5 5.5 3.5-4v8z" fill="currentColor" stroke="currentColor" strokeWidth={1.4} />
      </g>
    </IconSvg>
  );
}

/** Pablo: a face-down card and an eye peeking at it. */
export function PabloIcon() {
  return (
    <IconSvg>
      <rect x="13" y="5" width="22" height="30" rx="3" />
      <rect x="17" y="9" width="14" height="22" rx="1.5" strokeWidth={1.4} />
      <path d="M24 14.5l3.2 4.5-3.2 4.5-3.2-4.5z" fill="currentColor" stroke="none" />
      <path d="M11 35c3.8-4.6 8.2-7 13-7s9.2 2.4 13 7c-3.8 4.6-8.2 7-13 7s-9.2-2.4-13-7z" fill="var(--icon-bg, transparent)" />
      <circle cx="24" cy="35" r="3.2" fill="currentColor" stroke="none" />
    </IconSvg>
  );
}

/** Tekdheb: a card played face down, and someone calling it out. */
export function TekdhebIcon() {
  return (
    <IconSvg>
      <rect x="6" y="17" width="19" height="26" rx="3" />
      <rect x="9.5" y="20.5" width="12" height="19" rx="1.5" strokeWidth={1.4} />
      <path d="M15.5 25.5l2.8 4.5-2.8 4.5-2.8-4.5z" fill="currentColor" stroke="none" />
      <path d="M26 6h13a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-7l-5 5v-5h-1a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4z" fill="var(--icon-bg, transparent)" />
      <path d="M32.5 10.5v6" />
      <circle cx="32.5" cy="19.7" r="1.4" fill="currentColor" stroke="none" />
    </IconSvg>
  );
}

/** Dama: a corner of the board with two pieces. */
export function DamaIcon() {
  return (
    <IconSvg>
      <rect x="7" y="7" width="34" height="34" rx="3" />
      <rect x="7" y="7" width="17" height="17" fill="currentColor" fillOpacity=".22" stroke="none" />
      <rect x="24" y="24" width="17" height="17" fill="currentColor" fillOpacity=".22" stroke="none" />
      <circle cx="32.5" cy="15.5" r="5.6" fill="var(--icon-bg, transparent)" />
      <circle cx="32.5" cy="15.5" r="2.4" />
      <circle cx="15.5" cy="32.5" r="5.6" fill="currentColor" />
    </IconSvg>
  );
}

/** Kharbga: the grid, with stones on it and its middle square empty. */
export function KharbgaIcon() {
  const stone = (cx: number, cy: number, full: boolean) => (
    <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.7" fill={full ? "currentColor" : "var(--icon-bg, transparent)"} strokeWidth={1.6} />
  );
  return (
    <IconSvg>
      <rect x="6" y="6" width="36" height="36" rx="2" />
      <path d="M18 6v36M30 6v36M6 18h36M6 30h36" strokeWidth={1.6} />
      {[stone(12, 12, true), stone(24, 12, true), stone(12, 24, true), stone(36, 36, false), stone(24, 36, false), stone(36, 24, false)]}
    </IconSvg>
  );
}

/** Dominos: one tile, a one and a three. */
export function DominosIcon() {
  const pip = (cx: number, cy: number) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.3" fill="currentColor" stroke="none" />;
  return (
    <IconSvg>
      <rect x="14" y="5" width="20" height="38" rx="3.5" transform="rotate(12 24 24)" />
      <g transform="rotate(12 24 24)">
        <path d="M17 24h14" />
        {pip(24, 14.5)}
        {[pip(19.5, 28.5), pip(24, 33.5), pip(28.5, 38.5)]}
      </g>
    </IconSvg>
  );
}

/** The goose game: the spiral track, and a piece at its heart. */
export function GooseIcon() {
  return (
    <IconSvg>
      <path d="M24 24a3 3 0 0 1 3 3 6 6 0 0 1-6 6 9 9 0 0 1-9-9 12 12 0 0 1 12-12 15 15 0 0 1 15 15" />
      <circle cx="39" cy="27" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="24" cy="24" r="2" fill="currentColor" stroke="none" />
    </IconSvg>
  );
}

/** Loup garou: the moon over the village at night. */
export function LoupGarouIcon() {
  return (
    <IconSvg>
      <path d="M29 6a15 15 0 1 0 12.5 23.4A12 12 0 1 1 29 6z" />
      <path d="M12 9l1.2 2.8L16 13l-2.8 1.2L12 17l-1.2-2.8L8 13l2.8-1.2z" fill="currentColor" strokeWidth={1} />
    </IconSvg>
  );
}

/** Bent w wled: two players. (Seif to say what the game is; the icon follows.) */
export function BentWWledIcon() {
  return (
    <IconSvg>
      <circle cx="16" cy="16" r="5.5" />
      <path d="M6 38c0-6.6 4.5-11 10-11s10 4.4 10 11" />
      <circle cx="32" cy="16" r="5.5" />
      <path d="M22 38c0-6.6 4.5-11 10-11s10 4.4 10 11" fill="var(--icon-bg, transparent)" />
    </IconSvg>
  );
}

/** Jhayech: a hand of cards. (Seif to say what the game is; the icon follows.) */
export function JhayechIcon() {
  return (
    <IconSvg>
      <rect x="10" y="11" width="17" height="25" rx="3" transform="rotate(-18 18.5 23.5)" />
      <rect x="15.5" y="9" width="17" height="25" rx="3" fill="var(--icon-bg, transparent)" />
      <rect x="21" y="11" width="17" height="25" rx="3" transform="rotate(18 29.5 23.5)" fill="var(--icon-bg, transparent)" />
    </IconSvg>
  );
}
