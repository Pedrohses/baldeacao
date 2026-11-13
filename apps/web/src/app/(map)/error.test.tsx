import { fireEvent, render, screen } from '@testing-library/react';
import MapError from './error';

const back = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ back, push }) }));

describe('MapError', () => {
  it('mostra a mensagem em português e tenta de novo ao clicar', () => {
    const retry = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<MapError error={new Error('falhou')} retry={retry} />);

    expect(screen.getByText('Algo deu errado por aqui.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('Voltar leva à tela anterior ou ao mapa', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<MapError error={new Error('falhou')} retry={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(back.mock.calls.length + push.mock.calls.length).toBe(1);
  });
});
