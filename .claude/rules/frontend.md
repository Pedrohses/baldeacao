---
paths:
  - "apps/web/**"
---

# Frontend (apps/web)

Base: siga .claude/code-architecture/frontend-referencia.md (regras invioláveis, templates e checklist).
As regras abaixo complementam a base; em conflito, valem as daqui.

## Diferenças deste app
- Sem autenticação no MVP: não criar middleware.ts, shared/lib/auth nem header Authorization.
- Route groups: app/(map)/ para a experiência do mapa e app/(seo)/ para páginas indexáveis.
- Features: live-map, lines, stops, trip-planner, place-search, favorites. Nenhuma importa outra; composição acontece na página.
- Testes: Vitest + Testing Library.

## Estrutura
```
src/
├── app/
│   ├── (map)/        page.tsx, viagem/page.tsx, loading.tsx, error.tsx
│   ├── (seo)/        linha/[codigo]/page.tsx, parada/[id]/page.tsx
│   ├── manifest.ts, sw.ts, layout.tsx, globals.css
├── features/<feature>/{components,hooks,services,schemas,types}/ + index.ts
└── shared/
    ├── ui/map/       <BaseMap>
    ├── lib/          api-client.ts, realtime-client.ts, query-client.ts, providers.tsx, storage.ts
    ├── config/env.ts
    ├── hooks/, utils/, types/
```

## Tempo real
- WebSocket (Socket.IO client) só em shared/lib/realtime-client.ts: uma conexão, subscribe/unsubscribe.
- Hooks de feature assinam canais e atualizam o cache com queryClient.setQueryData; componentes nunca tocam no socket.
- Payload do WebSocket passa por schema Zod antes de entrar no cache.
- Fonte atrasada é estado de UI (isStale), não erro.

## Mapa
- MapLibre via react-map-gl, carregado com next/dynamic e ssr: false.
- shared/ui/map/<BaseMap> não conhece ônibus, linha nem parada.
- Camadas (VehiclesLayer, StopsLayer, RouteShapeLayer, ItineraryLayer) ficam na feature e usam Source/Layer GeoJSON; proibido um <Marker> React por veículo.
- Estado compartilhado do mapa (viewport, seleção, itinerário em foco) em Zustand dentro de features/live-map.
- Estilo do mapa vem de env.mapStyleUrl (OpenFreeMap); nunca usar tiles do openstreetmap.org.

## SEO e PWA
- Páginas em app/(seo)/ são Server Components com generateMetadata e revalidate; dado ao vivo entra como Client Component pequeno.
- Service worker (Serwist) faz cache do shell e de tiles; nunca de previsão ou posição.

## Armazenamento local
- localStorage só via shared/lib/storage.ts, com try/catch e validação Zod na leitura.

## Variáveis de ambiente
- NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL, NEXT_PUBLIC_MAP_STYLE_URL, lidas só em shared/config/env.ts.
