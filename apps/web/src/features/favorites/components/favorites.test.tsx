import { stopExample } from '@baldeacao/types/examples';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { readFavoriteStops } from '@/shared/lib/storage';

import { resetFavoriteStopsCache } from '../hooks';
import { FavoriteStopButton } from './favorite-stop-button';
import { FavoriteStopsList } from './favorite-stops-list';

beforeEach(() => {
  window.localStorage.clear();
  resetFavoriteStopsCache();
});

describe('favoritos de parada', () => {
  it('salva e remove pela estrela e lista a parada salva', () => {
    render(
      <>
        <FavoriteStopButton stop={stopExample} />
        <FavoriteStopsList renderStop={() => <p>chegadas</p>} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nos favoritos' }));
    expect(readFavoriteStops().map((s) => s.id)).toEqual([stopExample.id]);
    expect(screen.getByText('chegadas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remover dos favoritos' }));
    expect(readFavoriteStops()).toEqual([]);
    expect(screen.queryByText('chegadas')).not.toBeInTheDocument();
  });

  it('ignora dado corrompido no armazenamento', () => {
    window.localStorage.setItem('baldeacao:favorite-stops', '[{"x":1}]');
    expect(readFavoriteStops()).toEqual([]);
  });
});
