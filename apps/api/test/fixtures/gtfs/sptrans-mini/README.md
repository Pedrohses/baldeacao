# sptrans-mini

Recorte **sintético** do GTFS da SPTrans, montado à mão para testes. Não é um extrato do feed oficial: nomes, coordenadas, horários e `shape_id` são inventados, só o formato (colunas, ids e uso de `frequencies.txt`) imita o real.

- 3 linhas: `8000-10`, `875A-10` e `477U-10`, cada uma com os dois sentidos (`direction_id` 0 e 1, trip_id `<route_id>-<sentido>`).
- 13 paradas em São Paulo; `stop_id` é o mesmo código `cp` da Olho Vivo. A parada `4200953` é compartilhada por `8000-10` e `477U-10`.
- Um shape por sentido, com `shape_dist_traveled` em metros.
- Como no feed real, as viagens usam `frequencies.txt` (horários de `stop_times.txt` relativos a 00:00:00). Só `477U-10-0` tem horários completos e fica sem frequência.
- CSV simples: sem aspas e sem vírgula dentro de campos (o teste confere).

Os códigos de linha e parada batem com `../olho-vivo/*.json` e com `packages/types/src/__examples__.ts`. Mapeamento Olho Vivo: `sl` 1 é `direction_id` 0 e `sl` 2 é `direction_id` 1.

| route_id | cl sentido 1 | cl sentido 2 |
| --- | --- | --- |
| 8000-10 | 1273 | 33881 |
| 875A-10 | 1090 | 34698 |
| 477U-10 | 2517 | 35125 |
