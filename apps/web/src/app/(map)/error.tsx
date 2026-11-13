'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Erro de render em qualquer tela de `(map)` (inclui `/linhas/[routeId]`, que herda este
 * limite). Mostra texto em português com "Tentar de novo" e "Voltar".
 */
export default function MapError({
  error,
  retry,
  reset,
}: {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push('/');
  }

  return (
    <div
      role="alert"
      className="pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-bg p-6 text-center"
    >
      <h2 className="screen-title">Algo deu errado por aqui.</h2>
      <p className="max-w-80 text-muted">
        Não foi possível mostrar esta tela. Tente de novo ou volte para onde você estava.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => (retry ?? reset)?.()}
          className="h-11 rounded-sm bg-brand px-5 font-bold text-brand-fg"
        >
          Tentar de novo
        </button>
        <button
          type="button"
          onClick={goBack}
          className="h-11 rounded-sm bg-surface-2 px-5 font-bold text-text"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
