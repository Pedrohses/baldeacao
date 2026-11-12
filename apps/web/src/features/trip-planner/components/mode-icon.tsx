import type { TripMode } from '@baldeacao/types';

export interface ModeIconProps {
  mode: TripMode;
  className?: string;
}

/**
 * Ícone decorativo do modo, distinto por desenho (não só pela cor): ônibus de frente com dois
 * faróis, metrô de frente arredondada com um farol, trem com pantógrafo, pessoa andando.
 * O nome do modo vai em texto ao lado (aria-hidden aqui).
 */
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
          {mode === 'trolleybus' ? <path d="M9 1.5 11 4M15 1.5 13 4" /> : null}
          <rect x="4.5" y="4" width="15" height="14" rx="2" />
          <path d="M4.5 11h15M7.5 21v-3M16.5 21v-3" />
          <circle cx="8" cy="14.5" r="1" fill="currentColor" />
          <circle cx="16" cy="14.5" r="1" fill="currentColor" />
        </>
      ) : mode === 'subway' ? (
        <>
          <path d="M6 18V9a6 6 0 0 1 12 0v9Z" />
          <path d="M8.5 10.5h7" />
          <circle cx="12" cy="14.5" r="1.2" fill="currentColor" />
          <path d="M8 21l1.5-3M16 21l-1.5-3" />
        </>
      ) : mode === 'ferry' ? (
        <>
          <path d="M3 18c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
          <path d="M5 15l1-5h12l1 5M12 10V5" />
        </>
      ) : (
        <>
          <path d="M8 2.5h8M12 2.5 9.5 6h5" />
          <rect x="5.5" y="6" width="13" height="12" rx="2" />
          <path d="M5.5 12h13M8 21l1.5-3M16 21l-1.5-3" />
          <circle cx="9" cy="15" r="0.8" fill="currentColor" />
          <circle cx="15" cy="15" r="0.8" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
