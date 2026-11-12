import { act, render, screen } from '@testing-library/react';

import { initialMapState, useMapStore } from '../hooks/use-map-store';
import { StaleDataNotice } from './stale-data-notice';

describe('StaleDataNotice', () => {
  beforeEach(() => useMapStore.setState(initialMapState));

  it('fica vazio quando os dados estão em dia', () => {
    useMapStore.setState({ dataUpdatedAt: '2026-11-12T15:34:30Z', isStale: false });
    render(<StaleDataNotice />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('mostra o aviso em português com o horário de São Paulo quando isStale', () => {
    render(<StaleDataNotice />);

    act(() => useMapStore.setState({ dataUpdatedAt: '2026-11-12T15:34:30Z', isStale: true }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Dados atrasados. As posições dos ônibus podem não estar atualizadas (última atualização às 12:34).',
    );
  });
});
