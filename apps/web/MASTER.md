# Baldeação · Design system "Painel de estação"

Fonte única de verdade do visual do `apps/web`. Toda cor, fonte, espaço, raio, sombra e duração
usada no código sai daqui (tokens em `src/app/globals.css`, espelhados em hex em
`src/shared/ui/map/map-colors.ts` e `map-tint.ts`, porque o paint do MapLibre não lê variável CSS).

Prévia aprovada em 13/11/2026: https://claude.ai/artifact/UGszUXjA6TiHcKjFmu2MMD

## Teses

**Visual.** Quadro de partidas escuro por padrão: grafite com âmbar como único acento (ações,
foco, aba ativa). Cor saturada só nas linhas. Claro em branco-gelo com âmbar escurecido no texto.
Barlow Condensed 700 com algarismos tabulares nos números, códigos e títulos; Barlow no texto.
Densidade alta, base de 4 px, cantos de 4 a 6 px, filetes de 1 px em vez de cartões com sombra.
Mapa neutro.

**Interação.** Seco e rápido. O número que muda sobe e sai, o novo entra por baixo: 220 ms,
`cubic-bezier(0.22, 1, 0.36, 1)`. Hover clareia o fundo em 120 ms. Painel desliza em 240 ms.
Proibido: bounce, elástico, scale no hover, parallax, revelação no scroll. Com
`prefers-reduced-motion`, troca instantânea.

## Tema

- Escuro é o padrão, independente do sistema. Claro é alternativa.
- Preferência da pessoa: `escuro` (padrão), `claro` ou `sistema`, guardada via `shared/lib/storage.ts`.
- Aplicada como `data-theme="dark" | "light"` no `<html>` por um script inline antes da pintura
  (sem piscar). CSS: `:root` tem os valores escuros; `:root[data-theme="light"]` redefine.

## Cor

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#0E1116` | `#F6F7F9` | Fundo da página |
| `--surface` | `#161A21` | `#FFFFFF` | Painel, lista, campo |
| `--surface-2` | `#1E232C` | `#EDEFF3` | Hover, selecionado, trilho |
| `--border` | `#2A303B` | `#DADEE5` | Filetes entre itens |
| `--border-strong` | `#646D7D` | `#8A93A3` | Contorno de campo, selo claro (3:1) |
| `--text` | `#F4F5F7` | `#0E1116` | Texto principal |
| `--muted` | `#A3ABB8` | `#5B6472` | Texto secundário (4,5:1) |
| `--brand` | `#FFB300` | `#FFB300` | Fundo de botão primário, filete da aba ativa, alfinete |
| `--brand-fg` | `#0E1116` | `#0E1116` | Texto sobre `--brand` (9,9:1) |
| `--brand-ink` | `#FFB300` | `#8F5500` | Âmbar como texto, ícone ou contorno (4,5:1) |
| `--focus` | `#FFB300` | `#8F5500` | Anel de foco |
| `--live` | `#3DDC84` | `#0F7A3D` | Tempo real, "agora" |
| `--live-bg` | `#12291C` | `#E2F3E8` | Fundo de aviso de tempo real |
| `--warn` | `#FF9F43` | `#A04E00` | Dado atrasado |
| `--danger` | `#FF6B6B` | `#C62828` | Erro |
| `--line-fallback` | `#4A5262` | `#5B6472` | Linha sem cor no GTFS |
| `--line-fallback-fg` | `#FFFFFF` | `#FFFFFF` | Texto do selo neutro |

Regras:
- O âmbar **nunca** aparece em forma de selo nem como cor de dado: 181 linhas da SPTrans são
  `#FFD100` e 135 são `#FF671F`. Só botão cheio, filete da aba ativa, anel de foco e alfinete.
- `text-brand` é proibido (falha no claro). Âmbar como texto usa `text-brand-ink`.
- Cor de linha vem do GTFS (`route_color`/`route_text_color`), nunca de token.

### Mapa (hex em `map-tint.ts`)

| Camada | Escuro | Claro |
|---|---|---|
| Terra | `#12161C` | `#EEF0F3` |
| Água | `#0B1A26` | `#CFDDE8` |
| Parque | `#13201A` | `#DDE7DC` |
| Via | `#262C36` | `#FFFFFF` |
| Contorno de via | `#343B47` | `#D5DAE1` |
| Prédio | `#181D24` | `#E3E6EB` |
| Rótulo | `#7D8696` | `#6B7380` |
| Halo do rótulo | `#12161C` | `#EEF0F3` |
| Ônibus sem destaque | `#A3ABB8` | `#5B6472` |

## Tipografia

- `--font-display`: Barlow Condensed (500, 600, 700). Números, códigos de linha, tempos, títulos
  de seção, rótulos em caixa alta.
- `--font-sans`: Barlow (400, 500, 600). Texto corrido, nomes de parada, botões.
- Nenhuma fonte mono. Todo número em coluna usa `tabular-nums`.
- Escala: 12 · 14 · 16 · 20 · 24 · 28 · 40 (`text-xs` a `text-4xl`).
- Rótulo de seção: display 600, 14 px, caixa alta, `letter-spacing: 0.08em`, cor `--muted`.

## Espaço, raio, sombra

- Base 4 px: 4 · 8 · 12 · 16 · 24 · 32 · 48.
- Raios: `--radius-badge` 4 px (selo), `--radius-sm` 6 px (campo, botão), `--radius-md` 8 px
  (cartão raro), `--radius-lg` 12 px (só topo do painel do celular).
- Separação por filete de 1 px `--border`. Sombra só no que flutua sobre o mapa
  (`.surface-float`).

## Componentes base

- **Botão primário:** fundo `--brand`, texto `--brand-fg`, Barlow 600 16 px, raio 6 px, alvo
  mínimo 44 px. Hover mistura 14% de `--text`; active 28%; disabled opacidade 0,4.
- **Botão secundário:** transparente, borda `--border-strong`, hover `--surface-2`.
- **Campo:** fundo `--surface`, borda 1,5 px `--border-strong`, foco com anel `--focus`.
- **Selo de linha (`LineBadge`):** Barlow Condensed 700, raio 4 px, cor do GTFS.
- **Tempo de chegada (`ArrivalTime`):** número em display 700, "min" em Barlow 500 apagado,
  ponto `--live` para tempo real; muda com a virada de letreiro.
- **Aba ativa:** texto `--text` e filete de 3 px `--brand` no topo (celular) ou à esquerda
  (desktop). Sem pílula de fundo.

## Movimento

| Token | Valor | Uso |
|---|---|---|
| `--ease-app` | `cubic-bezier(0.22, 1, 0.36, 1)` | Tudo que entra ou se desloca |
| `--dur-roll` | 220 ms | Virada do número |
| `--dur-panel` | 240 ms | Painel do celular |
| `--dur-hover` | 120 ms | Cor de fundo e borda no hover e foco |

Só `transform` e `opacity` se animam; nunca largura, altura ou posição de layout.
