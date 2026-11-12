import { placeDestinationExample, placeOriginExample } from '@baldeacao/types/examples';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { RenderPlaceInput } from '../types';
import { TripForm } from './trip-form';

// Campo de lugar falso: mostra o valor e oferece botões para escolher os lugares de fixture.
const renderPlaceInput: RenderPlaceInput = ({ id, label, value, onChange }) => (
  <div>
    <label htmlFor={id}>{label}</label>
    <input id={id} readOnly value={value?.name ?? ''} />
    <button type="button" onClick={() => onChange(placeOriginExample)}>
      {label}: Morumbis
    </button>
    <button type="button" onClick={() => onChange(placeDestinationExample)}>
      {label}: Tietê
    </button>
  </div>
);

function renderForm() {
  const onSubmit = vi.fn();
  render(<TripForm renderPlaceInput={renderPlaceInput} onSubmit={onSubmit} />);
  return {
    onSubmit,
    submit: () => fireEvent.click(screen.getByRole('button', { name: 'Buscar itinerários' })),
  };
}

describe('TripForm', () => {
  it('pede origem e destino antes de buscar', () => {
    const { onSubmit, submit } = renderForm();
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Escolha a origem na lista.')).toBeInTheDocument();
    expect(screen.getByText('Escolha o destino na lista.')).toBeInTheDocument();
  });

  it('não aceita origem igual ao destino', () => {
    const { onSubmit, submit } = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Origem: Morumbis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Destino: Morumbis' }));
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Origem e destino precisam ser diferentes.',
    );
  });

  it('envia o pedido sem hora de saída (parte agora)', () => {
    const { onSubmit, submit } = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Origem: Morumbis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Destino: Tietê' }));
    submit();
    expect(onSubmit).toHaveBeenCalledWith({
      from: placeOriginExample.location,
      to: placeDestinationExample.location,
      maxItineraries: 3,
    });
  });

  it('inverte origem e destino e envia a hora de saída em ISO', () => {
    const { onSubmit, submit } = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Origem: Morumbis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Destino: Tietê' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inverter origem e destino' }));

    expect(screen.getByLabelText('Origem')).toHaveValue('Terminal Rodoviário Tietê');
    expect(screen.getByLabelText('Destino')).toHaveValue('Estádio do Morumbis');

    fireEvent.change(screen.getByLabelText('Hora de saída (opcional)'), {
      target: { value: '2026-11-12T08:00' },
    });
    submit();
    expect(onSubmit).toHaveBeenCalledWith({
      from: placeDestinationExample.location,
      to: placeOriginExample.location,
      departAt: new Date('2026-11-12T08:00').toISOString(),
      maxItineraries: 3,
    });
  });

  it('"Sair agora" limpa a hora de saída', () => {
    renderForm();
    const input = screen.getByLabelText('Hora de saída (opcional)');
    fireEvent.change(input, { target: { value: '2026-11-12T08:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sair agora' }));
    expect(input).toHaveValue('');
  });
});
