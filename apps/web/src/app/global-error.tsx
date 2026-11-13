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
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error roda fora do roteador */}
          <a
            href="/"
            style={{
              height: 44,
              padding: '0 20px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              border: '1px solid currentColor',
              borderRadius: 4,
              color: 'inherit',
              textDecoration: 'none',
              boxSizing: 'border-box',
            }}
          >
            Voltar
          </a>
        </div>
      </body>
    </html>
  );
}
