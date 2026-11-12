import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppNav, isActivePath } from './app-nav';
import { AppPanel } from './app-panel';
import { type PanelSnap, mapPaddingFor, nextSnap } from './panel-snap';

const pathname = vi.hoisted(() => ({ current: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

function mockDesktop(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  pathname.current = '/';
});

describe('AppNav', () => {
  it('mostra as três abas e marca a atual com aria-current', () => {
    pathname.current = '/viagem';
    render(<AppNav />);

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((a) => a.textContent)).toEqual(['Mapa', 'Viagem', 'Favoritos']);
    expect(screen.getByRole('link', { name: 'Viagem' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Mapa' })).not.toHaveAttribute('aria-current');
  });

  it('a aba Mapa só fica ativa na raiz', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/viagem', '/')).toBe(false);
    expect(isActivePath('/favoritos', '/favoritos')).toBe(true);
  });
});

describe('alturas do painel', () => {
  it('a alça alterna baixa, média, alta e volta', () => {
    expect(nextSnap('low')).toBe('mid');
    expect(nextSnap('mid')).toBe('high');
    expect(nextSnap('high')).toBe('low');
  });

  it('a folga do mapa considera o painel lateral no desktop e o sheet no celular', () => {
    expect(mapPaddingFor(true, 'low', 900).left).toBe(448);
    expect(mapPaddingFor(false, 'mid', 800)).toMatchObject({ bottom: 424, left: 32 });
    expect(mapPaddingFor(false, 'high', 800).bottom).toBe(424);
  });
});

describe('AppPanel', () => {
  it('no desktop vira painel lateral com o título como h1', () => {
    mockDesktop(true);
    render(
      <AppPanel title="Planejar viagem">
        <p>conteúdo</p>
      </AppPanel>,
    );
    const panel = screen.getByRole('complementary', { name: 'Planejar viagem' });
    expect(panel).toHaveTextContent('conteúdo');
    expect(screen.getByRole('heading', { level: 1, name: 'Planejar viagem' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Altura do painel/ })).not.toBeInTheDocument();
  });

  it('no celular a alça é um botão que alterna as alturas', () => {
    mockDesktop(false);
    const onSnapChange = vi.fn();
    function Harness() {
      const [snap, setSnap] = useState<PanelSnap>('low');
      return (
        <AppPanel
          title="Mapa"
          snap={snap}
          onSnapChange={(next) => {
            onSnapChange(next);
            setSnap(next);
          }}
        >
          <p>conteúdo</p>
        </AppPanel>
      );
    }
    render(<Harness />);

    const handle = screen.getByRole('button', { name: /Altura do painel: baixa/ });
    fireEvent.click(handle);
    expect(onSnapChange).toHaveBeenLastCalledWith('mid');
    expect(screen.getByRole('button', { name: /Altura do painel: média/ })).toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('arrastar a alça para cima leva à altura mais próxima e não alterna de novo no clique', () => {
    mockDesktop(false);
    vi.stubGlobal('innerHeight', 800);
    const onSnapChange = vi.fn();
    render(
      <AppPanel title="Mapa" snap="low" onSnapChange={onSnapChange}>
        <p>conteúdo</p>
      </AppPanel>,
    );
    const handle = screen.getByRole('button', { name: /Altura do painel/ });
    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 700 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 520 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 520 });
    fireEvent.click(handle);

    // 216 + 180 = 396 px: a média (400 px) é a mais próxima.
    expect(onSnapChange).toHaveBeenCalledTimes(1);
    expect(onSnapChange).toHaveBeenCalledWith('mid');
  });

  it('o painel não é diálogo modal: o resto da tela continua acessível', () => {
    mockDesktop(false);
    render(
      <>
        <button type="button">fora</button>
        <AppPanel title="Mapa">
          <p>conteúdo</p>
        </AppPanel>
      </>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'fora' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Mapa' })).toBeInTheDocument();
  });
});
