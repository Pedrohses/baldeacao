'use client';

import { useEffect } from 'react';

export default function MapError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-xl font-bold">Não foi possível carregar o mapa.</h2>
      <button type="button" onClick={() => retry()} className="h-11 rounded-sm bg-brand px-5 font-bold text-brand-fg">
        Tentar de novo
      </button>
    </div>
  );
}
