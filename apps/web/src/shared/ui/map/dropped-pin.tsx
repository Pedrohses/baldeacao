'use client';

import type { Coordinates } from '@baldeacao/types';
import type { ReactNode } from 'react';
import { Marker, Popup } from 'react-map-gl/maplibre';

import { CloseIcon } from '../icons';

export interface DroppedPinProps {
  location: Coordinates;
  /** Título do cartão, ex.: "Ponto no mapa". */
  title: string;
  onClose: () => void;
  /** Ações do ponto (botões ou links). */
  children: ReactNode;
}

/** Alfinete solto no mapa com um cartão de ações acima dele. Fica dentro do BaseMap. */
export function DroppedPin({ location, title, onClose, children }: DroppedPinProps) {
  return (
    <>
      <Marker longitude={location.lon} latitude={location.lat} anchor="bottom">
        <svg viewBox="0 0 32 40" className="h-10 w-8 drop-shadow" aria-hidden="true">
          <path
            d="M16 39s13-12.4 13-23A13 13 0 0 0 3 16c0 10.6 13 23 13 23Z"
            className="fill-brand stroke-surface"
            strokeWidth={2}
          />
          <circle cx="16" cy="16" r="5" className="fill-surface" />
        </svg>
      </Marker>
      <Popup
        longitude={location.lon}
        latitude={location.lat}
        anchor="bottom"
        offset={44}
        closeButton={false}
        closeOnClick={false}
        onClose={onClose}
        className="baldeacao-popup"
        maxWidth="320px"
      >
        <section aria-label={title} className="min-w-56 font-sans text-text">
          <header className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="-mr-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
            >
              <CloseIcon />
            </button>
          </header>
          <div className="flex flex-wrap gap-2">{children}</div>
        </section>
      </Popup>
    </>
  );
}
