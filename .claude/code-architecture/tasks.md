# Baldeação - Plano de Tasks Multiagente

## Como o time funciona

Um orquestrador e sete agentes trabalhando em ondas: dentro de uma onda os agentes rodam em paralelo, cada um só mexe nas pastas que são dele, e o orquestrador integra tudo antes de abrir a próxima onda.

**Papéis**

- **Orquestrador (agente principal):** dono dos contratos, das configurações compartilhadas e da integração. Não implementa feature; quebra a onda em tasks, despacha, revisa, faz o merge e roda a verificação completa.
- **Agentes de backend:** A1 dados, A2 tempo real, A3 rotas, A4 MCP.
- **Agentes de frontend:** F1 mapa, F2 transporte, F3 viagem.

**Regras que impedem conflito**

1. **Um worktree e uma branch por agente.** Cada agente trabalha isolado (`agent/<id>-<task>`), sem ver o trabalho em andamento dos outros.
2. **Posse de arquivos.** Cada agente só edita as pastas listadas para ele na seção de posse. Precisou mexer fora delas, pede ao orquestrador.
3. **Contrato antes do código.** Antes de uma onda paralela, o orquestrador publica em `packages/types` os schemas (Zod) e tipos que back e front vão trocar. Back implementa o contrato; front consome o contrato com fixtures, sem esperar o back ficar pronto.
4. **Arquivos compartilhados são só do orquestrador.** `package.json` da raiz, `app.module.ts`, `docker-compose.yml`, `.env.example`, `packages/types`, `CLAUDE.md` e `.claude/`.
5. **Portão entre ondas.** Uma onda só começa quando a anterior está integrada na `main` com lint, typecheck, testes e verificação manual passando.

## Mapa das ondas

| Agente | Onda 0 - Base | Onda 1 - Dados ao vivo | Onda 2 - Rotas e MCP | Onda 3 - Experiência | Onda 4 - Deploy |
| --- | --- | --- | --- | --- | --- |
| Orquestrador | Base e contratos | Integra e revisa | Integra e revisa | Integra e revisa | Deploy |
| A1 Back dados | | GTFS e paradas | | | |
| A2 Back tempo real | | Worker e WS | | | |
| A3 Back rotas | | | OTP e geocoding | | |
| A4 MCP | | | Tools MCP | | |
| F1 Front mapa | | Mapa ao vivo | | PWA e viagem | |
| F2 Front transporte | | Linhas e paradas | | Páginas SEO | |
| F3 Front viagem | | | Planejador | Favoritos | |

No máximo quatro agentes trabalham ao mesmo tempo. Entre cada onda há um portão: a seguinte só é despachada quando a anterior está integrada na `main` e verificada ponta a ponta.

## Posse de arquivos

| Agente | Pode editar | Não pode editar |
| --- | --- | --- |
| Orquestrador | Raiz, `infra/`, `packages/types`, `apps/api/src/{app.module.ts,config,shared,database}`, `apps/web/src/{app/layout.tsx,shared/lib,shared/config}`, `.claude/`, `CLAUDE.md` | Código interno dos módulos e features |
| A1 Back dados | `apps/api/src/modules/sources`, `apps/api/src/modules/transit` (exceto `presentation/mcp`), migrações das tabelas GTFS | Módulos de outros agentes, `app.module.ts` |
| A2 Back tempo real | `apps/api/src/modules/realtime` (exceto `presentation/mcp`) | Tabelas do Postgres; posições vão para o Redis |
| A3 Back rotas | `apps/api/src/modules/routing`, `apps/api/src/modules/geocoding` (exceto `presentation/mcp`), migração de `geocode_cache` | `infra/` (pede ao orquestrador o serviço do OTP) |
| A4 MCP | `apps/api/src/mcp`, `apps/api/src/modules/*/presentation/mcp` | Casos de uso; só consome os exportados pelos módulos |
| F1 Front mapa | `apps/web/src/shared/ui/map`, `apps/web/src/features/live-map`, `apps/web/src/app/(map)/page.tsx` | Outras features |
| F2 Front transporte | `apps/web/src/features/{lines,stops}`, `apps/web/src/app/(seo)` | `app/(map)` |
| F3 Front viagem | `apps/web/src/features/{trip-planner,place-search,favorites}`, `apps/web/src/app/(map)/viagem` | `app/(map)/page.tsx` |

**Pontos de encontro, sempre pelo orquestrador**

- Registrar um módulo novo no `app.module.ts`.
- Adicionar dependência no `package.json` de um app (o agente pede, o orquestrador instala).
- Mudar ou criar contrato em `packages/types`.
- Compor camadas de outras features na tela do mapa: F1 é dono da página e o orquestrador decide a ordem das camadas.

## Onda 0 - Base e contratos

Só o orquestrador, em sequência.

| ID | Tarefa | Depende de | Pronto quando |
| --- | --- | --- | --- |
| O-01 ✅ | Esqueleto da fase 1: monorepo, Compose, Nest, Next, CI | - | `/health` responde, mapa vazio abre, CI verde |
| O-02 ✅ | `shared/infrastructure` do backend: DataSource, cliente Redis, http client com timeout e retry, `DomainError` e `SourceUnavailableError` | O-01 | Usado pelo health, com testes |
| O-03 ✅ | Cliente da Olho Vivo em `shared/infrastructure/olho-vivo`: login por token, sessão em cookie, re-login automático | O-02 | Teste com fixture de login e de sessão expirada |
| O-04 ✅ | Contratos v1 em `packages/types` (Zod): Stop, Route, LineShape, Arrival, VehiclePosition, VehicleSnapshot, eventos do WebSocket | O-01 | Importável na api e no web, typecheck passa |
| O-05 ✅ | Fixtures compartilhadas: recorte pequeno do GTFS da SPTrans e respostas gravadas da Olho Vivo em `test/fixtures` | O-03 | Fixtures versionadas e citadas nos contratos |
| O-06 ✅ | Esqueleto dos módulos registrados no `app.module.ts` (transit, sources, realtime) e das features no web, vazios | O-01 | App sobe com os módulos vazios |
| O-07 ✅ | `shared/lib/realtime-client.ts` no web (Socket.IO) e `shared/lib/api-client.ts` | O-04 | Teste com servidor de socket falso |

**Portão 0:** contratos v1 e fixtures na `main`, CI verde.

**Registro da Onda 0 (2026-11-12):** O-01 a O-07 integradas na `main`; lint, typecheck, testes (api 49, web 23) e build passando localmente. **Portão 0 fechado:** CI verde em 75c4ddf; api sobe com os módulos novos e `/health` responde 200 com Postgres e Redis.

Decisões tomadas na Onda 0, fora dos documentos:
- Node 26 LTS (antes 22): o Jest só carrega o Nest 12 (ESM) via `require` a partir do Node 24.9; o CI falhava desde a fase 1 por isso.
- `packages/types` compila para `dist/` (ESM com `.d.ts`); a api (CommonJS) carrega via `require(esm)` do Node; a turbo roda `^build` antes de `dev`, `lint`, `typecheck` e `test`; o Jest da api mapeia `@baldeacao/types` para o código-fonte.
- Contratos: coordenadas em `{lat, lon}` (`toLonLat` para o MapLibre), datas ISO com fuso, ids sempre string, sentido 0/1 do GTFS; canal por linha usa o `route_id`; cada ciclo envia a foto completa do canal; dado atrasado a partir de 90 s (3 ciclos).
- http client: 4xx volta como resposta, sem retry; 5xx, rede e timeout repetem com backoff exponencial e, esgotados, viram `SourceUnavailableError`; timeout por tentativa.
- Olho Vivo: login lazy, só o cookie `apiCredentials`, um re-login por 401, login concorrente deduplicado; `OLHOVIVO_USER_AGENT` com default `baldeacao/0.1`.
- Fixtures do GTFS são sintéticas no formato da SPTrans (o GTFS real exige login no portal); `stop_id` igual ao `cp` da Olho Vivo; `sl` 1 vira `direction_id` 0 e `sl` 2 vira 1.

## Onda 1 - Dados e tempo real

Quatro agentes em paralelo (fases 2 e 3 do roadmap).

| ID | Agente | Tarefa | Depende de | Pronto quando |
| --- | --- | --- | --- | --- |
| A1-01 ✅ | A1 | Migrações das tabelas GTFS com PostGIS (`routes`, `stops`, `trips`, `stop_times`, `calendar`, `frequencies`, `shapes`) | Portão 0 | `migration:run` cria tudo com índices GIST |
| A1-02 ✅ | A1 | Importador do GTFS da SPTrans em lote (`sources`), com comando `pnpm --filter api gtfs:import` | A1-01 | Importa o recorte de fixture em teste e o GTFS completo local |
| A1-03 ✅ | A1 | Casos de uso e endpoints: buscar linha, linha por código com traçado, paradas num raio | A1-02 | Testes de aplicação e de repositório (Testcontainers) passam |
| A1-04 ✅ | A1 | Previsão de chegada por parada via Olho Vivo, com cache curto no Redis | A1-03 | Endpoint responde com o contrato `Arrival` |
| A2-01 ✅ | A2 | Worker BullMQ que consulta posições a cada ~30 s e grava no Redis (GEO + `updated_at`) | Portão 0 | Teste com fixture; Redis local preenchido em execução real |
| A2-02 ✅ | A2 | Endpoint de snapshot de posições (todas ou por linha) | A2-01 | Responde com o contrato `VehicleSnapshot` |
| A2-03 ✅ | A2 | Gateway Socket.IO publicando por canal (`positions:all`, `positions:line:<codigo>`) a cada ciclo | A2-01 | Cliente de teste recebe eventos no formato do contrato |
| F1-01 ✅ | F1 | `VehiclesLayer` em GeoJSON e hook `useVehiclePositions` (snapshot + socket + `setQueryData`) | Portão 0 | Teste do hook com socket falso; camada renderiza fixture |
| F1-02 ✅ | F1 | Store Zustand do mapa (viewport, seleção) e estado "dados atrasados" | F1-01 | Teste do store; aviso aparece com `isStale` |
| F2-01 ✅ | F2 | Feature `stops`: `StopsLayer`, `StopSheet` e `ArrivalsList` sobre o contrato | Portão 0 | Testes com fixture passam |
| F2-02 ✅ | F2 | Feature `lines`: `LineHeader` e `RouteShapeLayer` | Portão 0 | Traçado de fixture aparece no mapa de teste |

**Registro da Onda 1 (2026-11-12):** as 11 tasks integradas na `main` (api 162 testes, web 57). Pendente para o Portão 1: compor as camadas na tela do mapa, `WEB_ORIGIN` na config (hoje fixo no gateway), build do web sem `.env` e a verificação ponta a ponta.

Decisões da Onda 1 fora dos documentos:
- Entrada de HTTP validada com os schemas Zod do contrato, não com class-validator (que não está instalado); a regra do backend precisa ser atualizada ou o class-validator adotado.
- GTFS: chave (source_id, id), pg_trgm para busca de linha, importação por `INSERT ... SELECT FROM unnest` em lotes de 5000 numa transação, trocando o feed anterior da fonte.
- Previsão: cache Redis de 20 s; `headsign` é lt1 quando sl=1 e lt0 quando sl=2; `expectedAt` no fuso America/Sao_Paulo.
- Tempo real: Redis com `vehicles:sptrans` (GEO), `vehicle:sptrans:{id}` (TTL 300 s), `realtime:sptrans:updated_at` e pub/sub `positions:sptrans`; o subscribe responde ack e já envia a foto atual do canal.
- Front: `ArrivalsList` refaz a consulta a cada 15 s; o socket mantém as posições frescas (`staleTime: Infinity`); `isStale` reavaliado a cada 5 s.

**Portão 1 (integração):** o orquestrador junta as branches, compõe as camadas na tela do mapa, troca fixtures por API real e confere ponta a ponta: GTFS importado, ônibus se movendo, toque numa parada mostra a previsão. Esse é o vídeo do post 1.

## Onda 2 - Rotas e MCP

Três agentes em paralelo (fases 4 e 5).

**Antes de despachar (orquestrador):** contratos v2 em `packages/types` (Place, TripRequest, Itinerary, Leg) e o serviço do OpenTripPlanner no `docker-compose.yml`, com o grafo gerado a partir do GTFS e do extrato do OpenStreetMap.

| ID | Agente | Tarefa | Depende de | Pronto quando |
| --- | --- | --- | --- | --- |
| A3-01 | A3 | Geocoding: adaptador Nominatim com limite de 1 req/s, cache em `geocode_cache` e endpoint de busca de lugar | Portão 1 | Testes com fixture; segunda busca igual não chama o Nominatim |
| A3-02 | A3 | Routing: adaptador do OTP (GraphQL) e endpoint de planejar viagem devolvendo `Itinerary[]` | Portão 1 | Itinerário com baldeação ônibus + trilho no teste com fixture |
| A3-03 | A3 | Medir memória do OTP com o grafo de SP e registrar no `projeto.md` (via orquestrador) | A3-02 | Número medido e anotado |
| A4-01 | A4 | Servidor MCP (Streamable HTTP) montado em `src/mcp`, com limite de requisições por IP | Portão 1 | Inspector do MCP lista o servidor |
| A4-02 | A4 | Tools `buscar_linha`, `paradas_proximas`, `previsao_chegada`, `onibus_da_linha`, `status_dados` | A4-01 | Testes e2e com o cliente do SDK passam |
| A4-03 | A4 | Tool `planejar_viagem` sobre os casos de uso do A3 | A3-02, A4-01 | Tool devolve itinerário em linguagem clara |
| F3-01 | F3 | `place-search`: `PlaceAutocomplete` com debounce | Portão 1 | Teste com service mockado |
| F3-02 | F3 | `trip-planner`: `TripForm`, `ItineraryList` e `ItineraryLayer`, rota `/viagem` | F3-01 | Itinerário de fixture aparece no mapa e na lista |

**Portão 2 (integração):** o orquestrador expõe a API local por Cloudflare Tunnel, conecta o servidor MCP no Claude e confere: o Claude responde previsão de chegada e planeja "do Morumbis ao Tietê" com dado real. Esse é o post 2.

## Onda 3 - Experiência

Três agentes de front em paralelo (fase 6).

| ID | Agente | Tarefa | Depende de | Pronto quando |
| --- | --- | --- | --- | --- |
| F1-03 | F1 | PWA: `manifest.ts`, service worker com Serwist (cache do shell e de tiles, nunca de previsão ou posição) | Portão 2 | App instala no celular e abre offline no shell |
| F1-04 | F1 | Acompanhar viagem: itinerário em foco no mapa com o veículo da linha destacado | Portão 2 | Fluxo testado com fixture e em uso real |
| F2-03 | F2 | Páginas SEO `/linha/[codigo]` e `/parada/[id]` com `generateMetadata`, `revalidate` e `sitemap.ts` | Portão 2 | Páginas renderizam no servidor e aparecem no sitemap |
| F3-03 | F3 | `favorites`: salvar parada e trajeto em `localStorage` via `shared/lib/storage` | Portão 2 | Favoritos persistem e funcionam offline |
| F3-04 | F3 | Atalho de favorito na tela do mapa (componente entregue ao orquestrador para compor) | F3-03 | Um toque abre a parada ou refaz o trajeto |

**Portão 3:** o orquestrador roda um teste de uso real (um trajeto do dia a dia ponta a ponta) e só então libera o deploy.

## Onda 4 e depois

**Onda 4 - Deploy (fase 7, só o orquestrador)**

| ID | Tarefa | Pronto quando |
| --- | --- | --- |
| O-20 | VM Oracle Always Free na região de São Paulo, Docker e Caddy | VM acessível por SSH, Caddy servindo HTTPS no subdomínio |
| O-21 | Neon com PostGIS e migrações aplicadas | `migration:run` contra o Neon passa |
| O-22 | Compose de produção na VM (api, worker, Redis, OTP) e backup do volume | `/health` em HTTPS responde |
| O-23 | Front na Vercel apontando para `apps/web` | App abre pelo celular com dados reais |
| O-24 | Conector MCP do Claude apontando para a URL de produção, Sentry e UptimeRobot | Claude responde via produção; alerta de queda configurado |

**Onda 5 - Expansão (fase 8)**

- Um agente por fonte nova, cada um dono de um adaptador em `modules/sources/infrastructure/adapters/<cidade>`.
- Primeiros candidatos: ônibus metropolitanos (Artesp) e municipais de Guarulhos, se os dados forem obtidos.
- O orquestrador inclui o GTFS novo no grafo do OTP e registra a fonte.

## Protocolo do orquestrador

**Ciclo por onda**

1. **Preparar:** publicar contratos e mudanças compartilhadas da onda na `main`.
2. **Despachar:** um subagente por task, cada um em worktree próprio, todos da onda ao mesmo tempo.
3. **Acompanhar:** responder pedidos de mudança fora da posse (dependência, contrato, `app.module.ts`) fazendo a mudança ele mesmo.
4. **Revisar:** conferir cada branch contra a posse de arquivos e as regras de `.claude/rules`; arquivo fora da posse volta para o agente.
5. **Integrar:** merge na ordem back antes de front, rodando lint, typecheck e testes após cada merge.
6. **Verificar o portão:** checagem ponta a ponta descrita na onda; só depois abrir a próxima.
7. **Registrar:** marcar as tasks concluídas e anotar decisões novas em `.claude/code-architecture/projeto.md`.

**Modelo de prompt para cada agente**

```text
Você é o agente <ID> (<papel>) do projeto Baldeação. Task: <ID da task> - <descrição>.

Antes de começar, leia CLAUDE.md, .claude/code-architecture/projeto.md e a regra da sua área em .claude/rules/.

Você só pode editar: <pastas da posse>.
Não edite nada fora disso. Se precisar de mudança em contrato (packages/types), dependência, app.module.ts ou docker-compose, pare e me descreva a mudança.

Contrato a seguir: <arquivos de packages/types>. Fixtures: <caminhos em test/fixtures>.

Pronto quando: <critério da task>.
Antes de reportar, rode lint, typecheck e os testes do seu escopo. Não declare pronto o que não executou.

No final, responda em até 5 linhas: o que fez, arquivos criados, testes rodados e qualquer decisão fora dos documentos.
```

**Quando parar e chamar o Pedro**

- Mudança de contrato que quebra algo já integrado.
- Qualquer task da Onda 4 que crie conta, gaste dinheiro ou exponha segredo.
- Decisão de arquitetura que não está nos documentos.
