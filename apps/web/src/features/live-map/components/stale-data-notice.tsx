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
      className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3 md:left-[400px]"
    >
      {isStale && (
        <p className="surface-float pointer-events-auto max-w-md animate-[fade-in_150ms_var(--ease-app)] rounded-md border-l-4 border-l-warn px-3 py-2 text-sm">
          <strong className="font-semibold">Dados atrasados.</strong> {staleMessage(dataUpdatedAt)}
        </p>
      )}
    </div>
  );
}
