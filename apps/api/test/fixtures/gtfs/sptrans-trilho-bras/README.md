# sptrans-trilho-bras

Recorte **real** do GTFS da SPTrans (feed de 11/11/2026), só o sentido 0 de três linhas, para testar o reparo de traçados (`repair-shapes`):

- `METRÔ L3` (shape 17842): tem um espinho de 209 m em Brás (vai até a plataforma da CPTM e volta).
- `CPTM L11` (shape 17854): reta de 4.107 m de Brás a Tatuapé (falta o trecho).
- `CPTM L12` (shape 17856): o traçado começa no Tatuapé, a 4.081 m da primeira parada (Brás).

Esperado depois do reparo: a L11 empresta os pontos da L3 entre Brás e Tatuapé, a L12 é estendida até Brás com os pontos da L11 já completa, e a L3 perde o espinho.

Os arquivos são cópias das linhas do feed (colunas reduzidas ao que o leitor usa); `frequencies.txt` só tem as seis primeiras faixas da L11. Sem `calendar.txt`.
