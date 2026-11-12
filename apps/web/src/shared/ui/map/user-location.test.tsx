import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetGeolocation } from '@/shared/hooks/use-geolocation';

import { LOCATE_FAILED_MESSAGE, LocateButton } from './user-location';

const flyTo = vi.fn();
vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: { flyTo, getZoom: () => 12, jumpTo: vi.fn() } }),
  Source: () => null,
  Layer: () => null,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  resetGeolocation();
  flyTo.mockReset();
});

describe('LocateButton', () => {
  it('permissão negada mostra o aviso em vez de não fazer nada', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_ok: unknown, fail: (e: unknown) => void) =>
          fail({ code: 1, PERMISSION_DENIED: 1 }),
      },
    });
    render(<LocateButton centerOnMount={false} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Minha localização' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(LOCATE_FAILED_MESSAGE);
    expect(flyTo).not.toHaveBeenCalled();
  });

  it('sem GPS no aparelho também avisa', async () => {
    vi.stubGlobal('navigator', {});
    render(<LocateButton centerOnMount={false} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Minha localização' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(LOCATE_FAILED_MESSAGE);
  });
});
