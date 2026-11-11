'use client';

import { useEffect } from 'react';

export default function MapError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-medium">Não foi possível carregar o mapa.</h2>
      <button type="button" onClick={() => retry()} className="rounded-md border px-4 py-2 text-sm">
        Tentar de novo
      </button>
    </div>
  );
}
