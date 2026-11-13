'use client';

import type { Coordinates } from '@baldeacao/types';
import { useMap } from 'react-map-gl/maplibre';

import { CrosshairIcon } from '../icons';

export interface CenterPickerProps {
  /** Instrução curta, ex.: "Arraste o mapa até a origem". */
  instruction: string;
  onConfirm: (location: Coordinates) => void;
  onCancel: () => void;
}

/** Mira fixa no centro do mapa e barra "Confirmar este ponto". Fica dentro do BaseMap. */
export function CenterPicker({ instruction, onConfirm, onCancel }: CenterPickerProps) {
  const { current: map } = useMap();

  function confirm() {
    if (!map) return;
    const { lng, lat } = map.getCenter();
    onConfirm({ lat, lon: lng });
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-1/2 text-brand-ink"
      >
        <CrosshairIcon className="size-10 drop-shadow" />
      </div>
      <div
        role="region"
        aria-label="Escolher ponto no mapa"
        className="surface-float absolute inset-x-3 top-3 z-20 rounded-md p-3 md:right-auto md:left-[calc(400px+1.5rem)] md:w-96"
      >
        <p className="mb-2 text-sm text-muted">{instruction}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={confirm}
            className="h-11 flex-1 rounded-sm bg-brand px-4 font-bold text-brand-fg"
          >
            Confirmar este ponto
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-sm border border-border px-4 font-bold"
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}
