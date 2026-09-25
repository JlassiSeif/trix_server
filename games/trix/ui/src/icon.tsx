import { IconSvg } from "@platform/ui";

/** Trix: two cards fanned, the front one the K♥ (the ray contract, the game's most famous card). */
export function TrixIcon() {
  return (
    <IconSvg>
      <rect x="8" y="9" width="19" height="27" rx="3" transform="rotate(-14 17.5 22.5)" />
      <g transform="rotate(10 28.5 25.5)">
        <rect x="19" y="12" width="19" height="27" rx="3" fill="var(--icon-bg, transparent)" />
        <path d="M28.5 31c-4.2-2.9-6.2-5.1-6.2-7.4a3.1 3.1 0 0 1 6.2-.9 3.1 3.1 0 0 1 6.2.9c0 2.3-2 4.5-6.2 7.4z" fill="currentColor" stroke="none" />
      </g>
    </IconSvg>
  );
}
