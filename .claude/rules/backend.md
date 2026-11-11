---
paths:
  - "apps/api/**"
---

# Backend (apps/api)

## Arquitetura
- Clean Architecture modular: src/modules/<contexto>/{domain,application,infrastructure,presentation}.
- Contextos: sources, transit, realtime, routing, geocoding. src/mcp/ só monta o servidor MCP e registra as tools de cada contexto (presentation/mcp).
- domain/ não importa @nestjs, typeorm, @modelcontextprotocol ou qualquer lib de infraestrutura.
- Regra de negócio só em domain/ ou application/. Controllers, gateways e tools MCP apenas validam entrada, chamam um caso de uso e formatam a saída.
- Um contexto não importa repositórios de outro; usa casos de uso exportados pelo módulo.

## Estrutura de um contexto
```
src/modules/<contexto>/
├─ domain/          entities/, value-objects/, ports/, errors/
├─ application/     use-cases/, dto/
├─ infrastructure/  persistence/ (*.orm-entity.ts, repositórios TypeORM, mappers), adapters/
├─ presentation/    http/, ws/, mcp/
└─ <contexto>.module.ts   liga portas a adaptadores
```
Compartilhado entre contextos: src/shared/{domain,infrastructure,presentation}. Configuração: src/config. Migrações: src/database/migrations.

## Padrões
- Caso de uso: uma classe, um método execute(), dependências por portas no construtor.
- Porta: classe abstrata em domain/ports; ligação no *.module.ts com { provide: Porta, useClass: Adaptador }.
- Entidade de domínio e entidade TypeORM são classes separadas, convertidas por mapper.
- DTO de request/response só em presentation/http (class-validator); DTO de caso de uso em application/dto, sem decorators.
- Entradas de tools MCP validadas com Zod e descritas em português.
- Erros: estender DomainError com code estável; nunca lançar HttpException fora de presentation/. Falha de fonte externa vira SourceUnavailableError.
- Configuração: só via src/config (validada com Zod); proibido process.env em outro lugar.

## Banco
- synchronize sempre false; mudança de schema = nova migração.
- A primeira migração cria a extensão PostGIS.
- Colunas espaciais em geography(Point, 4326) ou geography(LineString, 4326) com índice GIST.
- Consultas espaciais com PostGIS (ST_DWithin) no banco, não em memória.
- Importação em lote (COPY ou inserts em lote em transação); nunca save() linha a linha para GTFS.
- Posições em tempo real vão para o Redis, nunca para o Postgres.

## Fontes externas
- Toda chamada à Olho Vivo, OTP ou Nominatim passa por um adaptador com timeout e retry.
- Olho Vivo: login por POST com token, sessão em cookie; re-login automático quando a sessão expirar.
- Respeitar 1 req/s no Nominatim e sempre consultar o cache antes.

## Testes
- Framework de testes: Jest (padrão do Nest).
- Caso de uso novo exige teste com adaptadores em memória.
- Repositórios e queries PostGIS: Testcontainers com a imagem postgis/postgis.
- Nunca chamar APIs externas reais em teste automatizado; usar test/fixtures.

## Nomes de arquivo
- *.use-case.ts, *.port.ts, *.adapter.ts, *.entity.ts, *.orm-entity.ts, *.mapper.ts, *.tool.ts
- Arquivos em kebab-case; classes em PascalCase.
