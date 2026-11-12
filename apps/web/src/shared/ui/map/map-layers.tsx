'use client';

import { type ReactNode, useId, useLayoutEffect, useSyncExternalStore } from 'react';

/*
 * O mapa mora no layout e sobrevive à troca de aba; cada tela entrega as suas camadas e controles
 * por <MapLayers>, e o <MapLayersOutlet> (dentro do BaseMap) as desenha. Assim o MapLibre não é
 * recriado: só as camadas da tela anterior saem e as da nova entram.
 */

interface Entry {
  owner: string;
  content: ReactNode;
}

let entry: Entry | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getContent = () => entry?.content ?? null;
const getServerContent = () => null;

/** Só para testes: esquece as camadas registradas. */
export function resetMapLayers() {
  entry = null;
  emit();
}

/**
 * Camadas e controles da tela atual (Source/Layer, mira, alfinete, botões flutuantes). Não
 * renderiza nada no lugar: o conteúdo vai para o mapa persistente do layout.
 */
export function MapLayers({ children }: { children?: ReactNode }) {
  const owner = useId();

  // A cada render a tela reenvia as camadas (com os handlers e o estado atuais).
  useLayoutEffect(() => {
    entry = { owner, content: children };
    emit();
  });

  useLayoutEffect(
    () => () => {
      // Só limpa se ainda for o dono: a tela nova pode ter registrado antes desta sair.
      if (entry?.owner === owner) {
        entry = null;
        emit();
      }
    },
    [owner],
  );

  return null;
}

/** Ponto do BaseMap onde as camadas da tela atual são desenhadas. */
export function MapLayersOutlet() {
  const content = useSyncExternalStore(subscribe, getContent, getServerContent);
  return <>{content}</>;
}
