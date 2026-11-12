import type { Metadata } from 'next';

import { LinesScreen } from './lines-screen';

export const metadata: Metadata = {
  title: 'Linhas | Baldeação',
  description: 'Busque linhas de ônibus, metrô e trem de São Paulo e veja os ônibus ao vivo.',
};

export default function LinesPage() {
  return <LinesScreen />;
}
