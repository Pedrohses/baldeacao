import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import type { ReactNode } from 'react';

import { Providers } from '@/shared/lib/providers';
import './globals.css';

// Família única: Nunito, arredondada. Números e horários em peso 800 com algarismos tabulares.
const nunito = Nunito({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '700', '800'],
  variable: '--font-nunito',
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#C7361F' },
    { media: '(prefers-color-scheme: dark)', color: '#1B1411' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={nunito.variable}>
      <body className="h-full font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
