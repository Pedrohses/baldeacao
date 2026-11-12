# Redesign de UX/UI do app web (2026-11-12)

Especificação do agente de UX/UI, aprovada pelo orquestrador. Implementação em `apps/web`.

## Diagnóstico
1. O mapa (`/`) não leva a lugar nenhum: sem busca, sem link para `/viagem`, sem escolher ponto.
2. O campo de lugar só aceita sugestão clicada; Enter sem sugestão ativa não faz nada. Sugestões não mostram o tipo (`Place.kind`).
3. ~11 mil pontos vermelhos (#d4001a, raio 3 px no zoom 10) viram ruído.
4. `StopSheet` fica abaixo da dobra em `map-screen.tsx` (sem `absolute`).
5. Formulário pesado: rótulos empilhados, botão "Buscar" obrigatório, `datetime-local` em formato americano, sem "chegar até".
6. Resumo do itinerário quebra em 3 linhas; caminhada com o mesmo peso das linhas; "METRÔ L4" gritando; ícone de metrô igual ao de ônibus; falta "sai em X min".
7. Alvos de toque < 44 px; zoom no canto superior direito; ônibus e paradas sem alternativa por teclado.
8. Sem sistema visual: `globals.css` só importa o Tailwind.

## Navegação (mobile-first)
- Shell em `app/(map)/layout.tsx` + `shared/ui/app-shell/`: celular com barra inferior fixa (64 px + safe-area) com abas **Mapa** (`/`), **Viagem** (`/viagem`), **Favoritos** (`/favoritos`); desktop (`md+`) com trilho vertical de 72 px à esquerda + painel lateral fixo de 400 px. Ícone + rótulo, alvo 48 px, `aria-current="page"`.
- Bottom sheet arrastável no celular com `vaul` (alturas 112 px, 50dvh, 92dvh). A alça é `<button>` que alterna alturas (WCAG 2.5.7). No desktop o mesmo conteúdo vai para o painel lateral.
- Tela inicial: na altura baixa, campo falso **"Para onde?"** (56 px, lupa) + até 3 recentes em chips; na média, **"Paradas perto de você"** (`useNearbyStops` com localização ou centro do mapa) com as 2 próximas chegadas. "Para onde?" abre `/viagem` com foco no destino e origem "Minha localização".
- Mapa para planejador: toque longo (clique direito no desktop) solta alfinete com **Ir para cá** (principal) e **Sair daqui**. `StopSheet` ganha os mesmos botões via slot `actions` passado pela página (stops não importa trip-planner). Navega para `/viagem?para=lat,lon&paraNome=...&paraTipo=stop` (e `de`, `deNome`, `deTipo`); `trip-screen` lê a URL.
- Controles: sem `NavigationControl` no celular (mantém no desktop); botão flutuante **Minha localização** 48 px no canto inferior direito acima do painel; mapa abre com o viewport do `useMapStore`.

## Origem e destino
- Cartão compacto com duas linhas (ponto de origem em anel, destino em alfinete, linha pontilhada) e botão inverter 44 px. Rótulos viram `aria-label`; placeholders "De onde?" / "Para onde?".
- Aceitar o digitado: Enter sem item ativo escolhe a 1ª sugestão; blur ou busca com texto e sem lugar escolhido faz busca `mode=full` e escolhe a 1ª (se houver mais de uma parecida, abre a lista).
- Autocompletar usa `mode=quick` (paradas e estações locais, rápido). Item fixo no fim da lista: **Buscar endereço "texto"** que chama `mode=full` (Nominatim; a política dele proíbe autocompletar).
- Linha de sugestão de 56 px com ícone por `kind` (`address` placa de rua, `poi` alfinete, `stop` placa de parada/estação, `coordinates` mira); título `name` 600, subtítulo `address` em `text-muted`, trecho digitado em negrito.
- Atalhos: **Minha localização** (`navigator.geolocation`, kind `coordinates`), **Escolher no mapa** (mira fixa no centro + "Confirmar este ponto"; nome "Ponto no mapa"), **Recentes** (até 5, via `shared/lib/storage.ts`).
- Não encontrado: `Não achamos "{texto}". Tente rua e número, por exemplo Rua Augusta, 1500, ou o nome de uma estação.` + botões Escolher no mapa / Usar minha localização. Erro de rede: "Sem conexão com a busca. Tente de novo." + "Tentar de novo".
- Hora: chip **"Sair agora"** que abre seletor *Sair às | Chegar até*, *Hoje / Amanhã*, hora 24 h de 5 em 5 min; preenche `departAt` ou `arriveBy`.
- Busca automática quando origem e destino estão definidos (e ao trocar a hora). Sem botão "Buscar"; "Tentar de novo" só no erro.

## Itinerários
- Cartão (um `<button>`): `10:36 → 11:48` em mono 20 px 700 e duração à direita; barra de 8 px com trechos proporcionais a `durationS` (transporte na cor da linha, caminhada cinza pontilhada, mínimo 6 px); chips só dos trechos de transporte com ícone + nome curto ("L4", "746H-10"); linha muted "Sai em 4 min · 1 baldeação · 2,2 km a pé" (ponto verde "ao vivo" se `isRealtime`; < 2 min vira "Sai agora" em cor de alerta). Selecionado: borda 2 px `brand`, check, `aria-pressed`.
- Carregando: 3 esqueletos no formato do cartão. Vazio: "Nenhuma rota de transporte para esse trajeto agora." + "Mudar horário" e "Inverter".
- Detalhe (`itinerary-timeline.tsx`): linha do tempo vertical com coluna de hora (56 px, mono), trilho (6 px na cor da linha; caminhada pontilhada 3 px; nós de 14 px; baldeação em anel 18 px) e texto (chip da linha + "sentido {headsign}", "Embarque em", "N paradas", "Desça em", selo "ao vivo"/"horário previsto"; caminhada "Caminhe 350 m (4 min) até {to.name}"; bloco "Baldeação · 4 min" em `surface-2`). No mapa, o trecho tocado fica em destaque e os demais com opacidade 0,35.
- Ícones de modo distintos em 16 px (`mode-icon.tsx`): ônibus, metrô (frente arredondada, um farol), trem (pantógrafo), a pé. Nome "METRÔ L4" vira "L4" (remover prefixo `METRÔ `/`CPTM `); "Destino"/"Origem" do OTP viram "o destino"/"a origem" no texto.

## Sistema visual (`globals.css`, Tailwind v4)
- Fontes via `next/font/google`: **Atkinson Hyperlegible Next** (interface) e **Atkinson Hyperlegible Mono** (horários, contagens, códigos). Se alguma não existir no `next/font`, usar **Atkinson Hyperlegible** e `ui-monospace`. Escala 12/14/16/20/28/40, pesos 400/700/800, corpo mínimo 16 px.
- Tokens em `:root` com modo escuro por `prefers-color-scheme`, expostos com `@theme inline` (`bg-surface`, `text-muted`...):

| token | claro | escuro |
|---|---|---|
| bg / surface / surface-2 | `#F4F6F7` / `#FFFFFF` / `#EBEFF1` | `#0E1418` / `#162026` / `#1F2B32` |
| border | `#D3DADF` | `#2E3C44` |
| text / muted | `#101A20` / `#4F5D67` | `#E6ECEF` / `#9CABB4` |
| brand / brand-fg | `#0B4F5C` / `#FFFFFF` | `#5CC3D2` / `#0E1418` |
| live / warn / danger | `#0A7A3E` / `#A85A00` / `#B42318` | `#4ADE80` / `#FBBF24` / `#F87171` |
| focus | `#0B4F5C` (anel 3 px, offset 2 px) | `#5CC3D2` |

- Raios 8/12/20 px; sombra só em superfícies sobre o mapa (claro `0 -4px 24px rgb(16 26 32 / .12)`, escuro `0 -4px 24px rgb(0 0 0 / .5)` + borda 1 px); espaçamento base 4; alvo mínimo 44 px; movimento 180 ms `cubic-bezier(.2,.8,.2,1)`, nada com `prefers-reduced-motion`.
- Estilo do mapa: `https://tiles.openfreemap.org/styles/positron`.

## Ônibus e paradas no mapa
- Zoom < 13: `heatmap` (transparente até `brand`, opacidade 0,35, raio 8 a 14 entre zoom 10 e 13). Zoom >= 13: `circle` raio 2,5 a 6 (zoom 13 a 17), cor `brand`, contorno branco 1 px. Fade cruzado (heatmap até 13.5, círculos a partir de 12.5).
- Paradas (zoom >= 14): círculo branco com anel `text` 2 px (oco vs cheio).
- Linha selecionada: demais veículos com opacidade 0,12 e sem heatmap; os da linha na cor da linha, raio 7 px, contorno branco 2 px.
- Com geolocalização autorizada, abre centrado no usuário no zoom 15.

## Favicon
`apps/web/src/app/icon.svg` (cápsula de baldeação ligando duas linhas sobre fundo petróleo). `apple-icon.png` 180 e ícones 192/512 (maskable sem cantos) para o `manifest.ts` na fase de PWA.

## Prioridades
- **P0:** shell + painel; tela inicial com "Para onde?" e localização; ações "Ir para cá"/"Sair daqui"; autocompletar que aceita o digitado e mostra o tipo; `/viagem` lendo a URL e buscando sozinho; ônibus em heatmap/círculos; tokens, fontes e positron.
- **P1:** cartão de itinerário novo + `itinerary-timeline.tsx`; `mode-icon.tsx`; chip de hora; recentes; escolher no mapa e toque longo; `GET /places/reverse`; `/favoritos` vazio; ícones.
- **P2:** aba Linhas; mapa persistente entre abas; estilo escuro do mapa; veículos filtrados por área no servidor.
