import type { TripMode } from '@baldeacao/types';

export interface ModeIconProps {
  mode: TripMode;
  className?: string;
}

/** Ícone decorativo do modo; o nome do modo vai em texto ao lado (aria-hidden aqui). */
export function ModeIcon({ mode, className = 'size-4' }: ModeIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-mode={mode}
    >
      {mode === 'walk' ? (
        <>
          <circle cx="13" cy="4" r="2" />
          <path d="M10 22l2-7 3 3v4M8 12l2-4 4 1 2 4M12 15l-1-6" />
        </>
      ) : mode === 'bus' || mode === 'trolleybus' ? (
        <>
          <rect x="4" y="3" width="16" height="15" rx="2" />
          <path d="M4 11h16M8 21v-3M16 21v-3" />
          <circle cx="8" cy="14.5" r="0.5" />
          <circle cx="16" cy="14.5" r="0.5" />
        </>
      ) : mode === 'ferry' ? (
        <>
          <path d="M3 17c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
          <path d="M5 14l1-5h12l1 5M12 9V4" />
        </>
      ) : (
        <>
          <rect x="5" y="3" width="14" height="14" rx="3" />
          <path d="M5 10h14M8 21l2-4M16 21l-2-4" />
          <circle cx="9" cy="13.5" r="0.5" />
          <circle cx="15" cy="13.5" r="0.5" />
        </>
      )}
    </svg>
  );
}
