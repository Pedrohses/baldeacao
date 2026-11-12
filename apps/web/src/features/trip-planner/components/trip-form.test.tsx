import type { Place } from '@baldeacao/types';
import {
  itineraryExample,
  placeDestinationExample,
  placeOriginExample,
} from '@baldeacao/types/examples';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTripPlan, useTripRequest } from '../hooks';
import { tripPlannerService } from '../services';
import type { RenderPlaceInput } from '../types';
import { TimeChip } from './time-chip';
import { TripForm } from './trip-form';

// Campo de lugar falso: mostra o valor e oferece botões para escolher os lugares de fixture.
const renderPlaceInput: RenderPlaceInput = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}) => (
  <div>
    <input
      id={id}
      aria-label={label}
      readOnly
      value={value?.name ?? ''}
      placeholder={placeholder}
      data-autofocus={autoFocus ? 'true' : 'false'}
    />
    <button type="button" onClick={() => onChange(placeOriginExample)}>
      {label}: Morumbis
    </button>
    <button type="button" onClick={() => onChange(placeDestinationExample)}>
      {label}: Tietê
    </button>
  </div>
);

/** Mesma composição da página: estado do pedido + formulário + chip de hora + consulta. */
function Harness({ initialDestination = null }: { initialDestination?: Place | null }) {
  const trip = useTripRequest({ initialDestination });
  const plan = useTripPlan(trip.request);
  const [open, setOpen] = useState(false);
  return (
    <>
      <TripForm
        renderPlaceInput={renderPlaceInput}
        origin={trip.origin}
        destination={trip.destination}
        onOriginChange={trip.setOrigin}
        onDestinationChange={trip.setDestination}
        onSwap={trip.swap}
        autoFocus="destination"
        error={trip.error}
      />
      <TimeChip
        value={trip.time}
        onChange={trip.setTime}
        open={open}
        onOpenChange={setOpen}
        now={new Date('2026-11-12T11:02:00Z')}
      />
      <p data-testid="plan-status">{plan.fetchStatus}</p>
    </>
  );
}

function renderHarness(initialDestination?: Place) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness initialDestination={initialDestination ?? null} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('TripForm e busca automática', () => {
  it('usa placeholders curtos, rótulos acessíveis e foca o campo pedido', () => {
    renderHarness();
    expect(screen.getByLabelText('Origem')).toHaveAttribute('placeholder', 'De onde?');
    expect(screen.getByLabelText('Destino')).toHaveAttribute('placeholder', 'Para onde?');
    expect(screen.getByLabelText('Destino')).toHaveAttribute('data-autofocus', 'true');
    expect(screen.queryByRole('button', { name: /Buscar/ })).not.toBeInTheDocument();
  });

  it('busca sozinho assim que origem e destino estão definidos, partindo agora', async () => {
    const spy = vi.spyOn(tripPlannerService, 'plan').mockResolvedValue([itineraryExample]);
    renderHarness(placeDestinationExample);
    expect(spy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Origem: Morumbis' }));

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0]?.[0]).toEqual({
      from: placeOriginExample.location,
      to: placeDestinationExample.location,
      maxItineraries: 3,
    });
  });

  it('inverter troca as pontas e busca de novo no sentido contrário', async () => {
    const spy = vi.spyOn(tripPlannerService, 'plan').mockResolvedValue([]);
    renderHarness(placeDestinationExample);
    fireEvent.click(screen.getByRole('button', { name: 'Origem: Morumbis' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Inverter origem e destino' }));

    expect(screen.getByLabelText('Origem')).toHaveValue('Terminal Rodoviário Tietê');
    expect(screen.getByLabelText('Destino')).toHaveValue('Estádio do Morumbis');
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(spy.mock.calls[1]?.[0]).toMatchObject({
      from: placeDestinationExample.location,
      to: placeOriginExample.location,
    });
  });

  it('não busca com origem igual ao destino e explica', () => {
    const spy = vi.spyOn(tripPlannerService, 'plan');
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'Origem: Morumbis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Destino: Morumbis' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Origem e destino precisam ser diferentes.',
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('trocar a hora no chip refaz a busca com chegar até em ISO de São Paulo', async () => {
    const spy = vi.spyOn(tripPlannerService, 'plan').mockResolvedValue([]);
    renderHarness(placeDestinationExample);
    fireEvent.click(screen.getByRole('button', { name: 'Origem: Morumbis' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    const chip = screen.getByRole('button', { name: /Sair agora/ });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'Chegar até' }));
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Amanhã' }));

    expect(screen.getByRole('button', { name: /Chegar até 09:30 amanhã/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(spy.mock.lastCall?.[0]).toMatchObject({
        arriveBy: expect.stringMatching(/T09:30:00-03:00$/),
      }),
    );
    expect(spy.mock.lastCall?.[0]).not.toHaveProperty('departAt');

    fireEvent.click(screen.getByRole('button', { name: 'Sair agora' }));
    expect(screen.getByRole('button', { name: /Sair agora/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
