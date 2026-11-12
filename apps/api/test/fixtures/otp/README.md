# Fixtures do OpenTripPlanner 2.10

Respostas de `POST /otp/gtfs/v1` (API GraphQL GTFS) para a consulta `planConnection`
de `src/modules/routing/infrastructure/adapters/otp-plan-connection.query.ts`, só com os
campos que ela pede. Formato da 2.10: `start`/`end` do trecho são `LegTime`
(`scheduledTime` e `estimated.time`), ids GTFS com prefixo do feed (`1:7725-10`) e geometria
em polyline do Google (precisão 5).

- `plan-connection-bus-subway.json`: Morumbi até a Luz saindo às 8h. Primeiro itinerário com
  baldeação ônibus (7725-10, com previsão em tempo real) + metrô (L4, cor com `#` minúsculo);
  segundo só de ônibus (875A-10, sem cor).
- `plan-connection-no-route.json`: `routingErrors` com `NO_TRANSIT_CONNECTION` e `edges` vazio.
- `graphql-validation-error.json`: erro de validação do GraphQL, sem `data`.
- `plan-connection-repeated-departures.json`: resposta real do OTP local (2.10, GTFS da
  SPTrans) para Av. Paulista 1578 até o Morumbi saindo às 14h, com `first: 12`. As mesmas
  linhas se repetem em saídas a cada minuto (L4 + 746H-10 seis vezes, 917H-10 e 857R-10 duas)
  e há uma opção só de ônibus (6262-10 + 775F-10). `legGeometry` foi zerada para encolher o
  arquivo (o mapper cai na reta entre as pontas).

Montadas no formato real (o OTP ainda não roda localmente); paradas e horários são
ilustrativos. Regerar quando o OTP local subir, com a mesma consulta. Os testes nunca chamam
o OTP real.
