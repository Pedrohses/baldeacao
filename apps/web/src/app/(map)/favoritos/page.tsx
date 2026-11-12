import type { Metadata } from 'next';

import { FavoritesScreen } from './favorites-screen';

export const metadata: Metadata = {
  title: 'Favoritos | Baldeação',
  description: 'Suas paradas, linhas e lugares favoritos no transporte público de São Paulo.',
};

export default function FavoritesPage() {
  return <FavoritesScreen />;
}
