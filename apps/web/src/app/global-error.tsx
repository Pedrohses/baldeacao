'use client';

/** Último recurso: erro no layout raiz. Traz o próprio <html>, sem providers nem CSS do app. */
export default function GlobalError({ retry, reset }: { retry?: () => void; reset?: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0 }}>Algo deu errado.</h1>
        <p style={{ margin: 0 }}>Não foi possível abrir o Baldeação agora.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => (retry ?? reset)?.()}
            style={{ height: 44, padding: '0 20px', fontWeight: 700 }}
          >
            Tentar de novo
          </button>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            style={{ height: 44, padding: '0 20px', fontWeight: 700 }}
          >
            Voltar
          </button>
        </div>
      </body>
    </html>
  );
}
