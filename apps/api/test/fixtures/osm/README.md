# Fixtures do OSM

- `pois.geojsonseq`: cinco linhas reais da saída de
  `osmium export -f geojsonseq -a type,id --geometry-types=point,polygon` sobre o
  `tags-filter` de `OSMIUM_TAG_FILTERS` (recorte `infra/otp/data/sao-paulo.osm.pbf`).
  Jardim Botânico de São Paulo (relation, área), Parque Ibirapuera (way, área), um shopping
  (node) e dois nós sem nome que a importação descarta. Tags reduzidas às usadas e anéis
  reduzidos a poucos pontos.
