import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { MapLayers, MapLayersOutlet, resetMapLayers } from './map-layers';

let mounts = 0;
function Layer({ name }: { name: string }) {
  // Conta montagens: a camada não deve remontar a cada render da tela.
  useState(() => ++mounts);
  return <span data-testid="layer">{name}</span>;
}

function Screens({ tab, label }: { tab: 'a' | 'b'; label: string }) {
  return (
    <>
      <div data-testid="map">
        <MapLayersOutlet />
      </div>
      {tab === 'a' ? (
        <MapLayers key="a">
          <Layer name={label} />
        </MapLayers>
      ) : (
        <MapLayers key="b" />
      )}
    </>
  );
}

afterEach(() => {
  resetMapLayers();
  mounts = 0;
});

describe('MapLayers', () => {
  it('desenha as camadas da tela no outlet do mapa e as tira quando a tela sai', () => {
    const { rerender } = render(<Screens tab="a" label="ônibus" />);
    expect(screen.getByTestId('map')).toHaveTextContent('ônibus');

    rerender(<Screens tab="a" label="ônibus da linha" />);
    expect(screen.getByTestId('map')).toHaveTextContent('ônibus da linha');
    expect(mounts).toBe(1);

    rerender(<Screens tab="b" label="" />);
    expect(screen.queryByTestId('layer')).not.toBeInTheDocument();
  });
});
