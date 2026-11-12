# Fixtures do Nominatim

Respostas de `GET /search?format=jsonv2&addressdetails=1&countrycodes=br&viewbox=-47.21,-23.18,-45.69,-24.07&bounded=1&accept-language=pt-BR`
no formato jsonv2 do Nominatim 5.x (campos `category`, `addresstype`, `address`, `boundingbox`).

- `search-morumbis.json`: busca "estádio do morumbis". Quatro tipos de resultado: estádio
  (`leisure/stadium`, vira `poi`), ponto de ônibus (`highway/bus_stop`, vira `stop`), rua
  (`highway/residential`, vira `address`) e estação (`railway/station`, vira `stop`).
- `search-empty.json`: busca sem resultado (o Nominatim devolve `[]`).

Montadas à mão no formato real (sem chamar o Nominatim público); ids e coordenadas
são do OSM, mas podem ter mudado desde então. Os testes nunca chamam o Nominatim real.
