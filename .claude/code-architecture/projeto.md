# Baldeação - Contexto do projeto

## Visão
App de transporte público no estilo do SBB Mobile, sem venda de passagem. Começa pela cidade de São Paulo (SPTrans) e cresce cidade a cidade. Um backend único atende duas entradas: o app web (REST + WebSocket) e o Claude (MCP). O nome vem do que o app faz de melhor: combinar ônibus, metrô e trem numa viagem só.

## Escopo do MVP
- Mapa com os ônibus da SPTrans se movendo em tempo real.
- Busca de linhas e paradas, com previsão de chegada.
- Rota de A até B combinando ônibus e trilhos (trilhos só com horário planejado).
- Servidor MCP com as mesmas consultas.

Fora do MVP: pagamento, contas de usuário, apps nativos, outras cidades, posição em tempo real de Metrô/CPTM.

## Arquitetura em uma linha
SPTrans Olho Vivo → worker BullMQ (a cada ~30 s) → Redis → API Nest (REST, WebSocket, MCP) → app Next e Claude. GTFS + OpenStreetMap alimentam o OpenTripPlanner e são importados no Postgres + PostGIS. O worker é a única peça que fala com a SPTrans.

## Fontes de dados
| Fonte | Uso | Acesso |
| --- | --- | --- |
| SPTrans Olho Vivo (API v2.1, HTTPS) | Posição dos ônibus, previsão, linhas, paradas | Token gratuito da área de desenvolvedores; POST de login e sessão em cookie, que expira |
| SPTrans GTFS | Rede planejada (inclui linhas da CPTM) | Download na área de desenvolvedores; pode usar frequencies.txt |
| OpenStreetMap (extrato .pbf do Sudeste, Geofabrik) | Caminhada no OTP | Download; só necessário na fase 5 |
| OpenFreeMap | Tiles do mapa | URL de estilo, sem chave |
| Nominatim | Endereço para coordenada | API pública, máximo 1 req/s, cache obrigatório |

## Modelo de dados
Postgres (dados que mudam pouco), todos com source_id:
- sources, routes, stops (geography(Point) + GIST), trips, stop_times, calendar, frequencies, shapes (geography(LineString)), geocode_cache.

Redis (tempo real):
- vehicles:{source}: conjunto GEO com a posição de cada veículo (um GEOADD em lote por ciclo).
- vehicle:{source}:{id}: linha, sentido e horário da última leitura, com expiração curta.
- realtime:{source}:updated_at: último dado bom, para a UI mostrar "dados atrasados".
- Canal pub/sub positions:{source}: avisa o gateway WebSocket a cada ciclo.

Contrato do adaptador de fonte:
```ts
interface TransitSourceAdapter {
  id: string;                                   // ex.: "sptrans"
  fetchStatic(): Promise<GtfsFeed>;             // rede planejada
  fetchRealtime?(): Promise<VehiclePosition[]>; // opcional: nem toda cidade tem
}
```

## Tools MCP (somente leitura, Streamable HTTP)
| Tool | Pergunta | Lê de |
| --- | --- | --- |
| buscar_linha | "Qual linha vai para a Paulista?" | Postgres |
| paradas_proximas | "Quais pontos tem perto de mim?" | Postgres (PostGIS) |
| previsao_chegada | "Quando passa o 875A no meu ponto?" | Olho Vivo, com cache no Redis |
| onibus_da_linha | "Onde estão os ônibus dessa linha agora?" | Redis |
| planejar_viagem | "Como chego do Tatuapé à Paulista saindo às 8h?" | Nominatim + OpenTripPlanner |
| status_dados | "Os dados de tempo real estão atualizados?" | Redis |

Cada tool aceita a cidade como parâmetro opcional (padrão: São Paulo). Sem autenticação no início; limite de requisições por IP.

## Roadmap (local primeiro)
1. Fundação local: monorepo, Docker Compose (Postgres + PostGIS, Redis), Nest e Next rodando, lint e testes no CI. Pronto quando /health responde e o Next abre um mapa vazio.
2. Rede planejada: adaptador SPTrans, importação do GTFS, endpoints de linhas e paradas.
3. Tempo real + mapa: worker da Olho Vivo, Redis, WebSocket, ônibus se movendo no mapa.
4. MCP: módulo MCP exposto por túnel gratuito (Cloudflare Tunnel) e conectado ao Claude.
5. Roteamento: OTP no Compose, geocodificação, rota A até B; medir memória do OTP.
   - Medido em 2026-11-12 (OTP 2.10.0, GTFS SPTrans completo + OSM recortado da Grande SP, 151 MB): grafo de 312 MB gerado em 1m12s com heap de 5 GB; em execução o container usa ~2,3 GB de RAM (heap máximo 4 GB). Para a VM de produção, reservar ~3 GB para o OTP.
6. Experiência SBB: favoritos no aparelho, acompanhar viagem, páginas SEO, PWA.
7. Deploy: VM Oracle Always Free (mesmo Compose + Caddy), Neon, Vercel, subdomínio gratuito.
8. Expansão: novos adaptadores (metropolitano via Artesp, Guarulhos), depois outras capitais.

## Decisões já tomadas
- Nome: Baldeação (slug do repositório e pacotes: baldeacao).
- Stack: NestJS + Next.js em TypeScript, pnpm + Turborepo.
- Backend em Clean Architecture modular; entidade de domínio separada da entidade TypeORM, com mapper.
- Testes: Jest no backend, Vitest no frontend.
- Tempo real com Socket.IO; estado do mapa em Zustand.
- Hospedagem futura: Oracle Always Free sem cartão (free puro), Neon e Vercel; Render descartado porque dorme; plano B pago Hetzner.
- Sem domínio próprio por enquanto.

## Variáveis de ambiente
```
# api
OLHOVIVO_TOKEN=
DATABASE_URL=postgres://baldeacao:baldeacao@localhost:5432/baldeacao
REDIS_URL=redis://localhost:6379
OTP_URL=http://localhost:8080
NOMINATIM_USER_AGENT=
# web
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
NEXT_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
```
