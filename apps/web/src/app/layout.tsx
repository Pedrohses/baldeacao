import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import type { ReactNode } from 'react';

import { Providers } from '@/shared/lib/providers';
import { THEME_INIT_SCRIPT } from '@/shared/lib/theme';
import './globals.css';

// Barlow no texto e Barlow Condensed nos números, códigos de linha e títulos (MASTER.md).
const barlow = Barlow({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Baldeação',
  description: 'Ônibus em tempo real, previsão de chegada e planejamento de viagem em São Paulo.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Escuro é o padrão do app; a barra do navegador acompanha o grafite.
  themeColor: '#0E1116',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme é posto pelo script antes da hidratação; o servidor não sabe o tema.
    <html
      lang="pt-BR"
      data-theme="dark"
      className={`${barlow.variable} ${barlowCondensed.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-full font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
