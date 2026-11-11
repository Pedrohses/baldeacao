import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/shared/lib/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Baldeação',
  description: 'Ônibus em tempo real, previsão de chegada e planejamento de viagem em São Paulo.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
