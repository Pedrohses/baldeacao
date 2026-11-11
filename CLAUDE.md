# Baldeação

App de transporte público no estilo do SBB Mobile, sem venda de passagem: mapa com ônibus em tempo real, previsão de chegada, planejamento de viagem e um servidor MCP para o Claude responder as mesmas perguntas. Começa pela cidade de São Paulo (SPTrans) e cresce cidade a cidade por adaptadores de dados.

Contexto completo (escopo, fontes de dados, modelo de dados, tools MCP, roadmap): `.claude/code-architecture/projeto.md`.

## Monorepo

```
apps/api        NestJS: REST, WebSocket (Socket.IO), MCP, worker BullMQ
apps/web        Next.js 16 (App Router) + MapLibre + PWA
packages/types  contratos compartilhados
infra/          docker-compose e configs (OTP, Caddy)
```

Gerenciador: pnpm workspaces + Turborepo. Node 22. Nome do repositório e do pacote raiz: `baldeacao`.

## Comandos

```bash
docker compose -f infra/docker-compose.yml up -d   # Postgres + PostGIS e Redis
pnpm install
pnpm dev                                           # api e web em paralelo
pnpm --filter api test                             # Jest
pnpm --filter web test                             # Vitest
pnpm --filter api migration:generate <Nome>
pnpm --filter api migration:run
pnpm lint && pnpm typecheck
```

Se algum comando acima ainda não existir no package.json, crie-o com esse nome em vez de inventar outro.

## Regras por área

- Ao trabalhar em `apps/api`: siga `.claude/rules/backend.md`.
- Ao trabalhar em `apps/web`: siga `.claude/rules/frontend.md`, que se apoia em `.claude/code-architecture/frontend-referencia.md`.
- Leia o arquivo da área antes de criar módulo, feature, migração ou tool MCP.

## Convenções gerais

- TypeScript strict, sem `any` gratuito.
- Código, nomes de arquivo e identificadores em inglês; textos de UI e descrições de tools MCP em português.
- Configuração só por `.env` validado (Zod); nunca commitar `.env`, manter `.env.example` atualizado.
- Desenvolvimento é local primeiro (fases 1 a 6 do roadmap); nada de configuração de nuvem antes da fase 7.

## Não fazer

- Gravar posição de veículo em tempo real no Postgres (vai para o Redis).
- Usar tiles de openstreetmap.org (usar OpenFreeMap).
- Chamar APIs externas reais (Olho Vivo, OTP, Nominatim) em teste automatizado.
- Importar arquivo interno de outro módulo (backend) ou de outra feature (frontend).
- Criar autenticação ou contas de usuário: fora do MVP.

## Fase atual

Fase 1, fundação local: monorepo, Docker Compose com Postgres + PostGIS e Redis, Nest e Next rodando, `/health` respondendo e mapa vazio abrindo.
