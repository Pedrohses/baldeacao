'use client';

import { useMapStore } from '../hooks/use-map-store';

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

function staleMessage(dataUpdatedAt: string | null): string {
  const base = 'As posições dos ônibus podem não estar atualizadas';
  if (!dataUpdatedAt) return `${base}.`;
  return `${base} (última atualização às ${timeFormat.format(new Date(dataUpdatedAt))}).`;
}

/** Aviso de fonte atrasada: estado de UI, não erro (o mapa continua com o último dado bom). */
export function StaleDataNotice() {
  const isStale = useMapStore((state) => state.isStale);
  const dataUpdatedAt = useMapStore((state) => state.dataUpdatedAt);

  return (
    // A região viva fica sempre montada para o leitor de tela anunciar quando o aviso surge.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3"
    >
      {isStale && (
        <p className="pointer-events-auto rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow">
          <strong className="font-semibold">Dados atrasados.</strong> {staleMessage(dataUpdatedAt)}
        </p>
      )}
    </div>
  );
}
