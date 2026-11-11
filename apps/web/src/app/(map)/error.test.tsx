import { fireEvent, render, screen } from '@testing-library/react';
import MapError from './error';

describe('MapError', () => {
  it('mostra a mensagem e tenta de novo ao clicar', () => {
    const retry = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<MapError error={new Error('falhou')} retry={retry} />);

    expect(screen.getByText('Não foi possível carregar o mapa.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
