import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible_Mono, Nunito } from 'next/font/google';
import type { ReactNode } from 'react';

import { Providers } from '@/shared/lib/providers';
import './globals.css';

// Interface: Nunito, arredondada e amigável. Números e horários: Atkinson Mono, legível.
const nunito = Nunito({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '700', '800'],
  variable: '--font-nunito',
  display: 'swap',
});

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-atkinson-mono',
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
    { media: '(prefers-color-scheme: dark)', color: '#0E1418' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${nunito.variable} ${atkinsonMono.variable}`}>
      <body className="h-full font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
