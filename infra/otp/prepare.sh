#!/usr/bin/env bash
# Prepara os dados e gera o grafo do OpenTripPlanner para a Grande São Paulo.
# Uso: pnpm otp:prepare   (baixa o extrato OSM do Sudeste, recorta SP, baixa o GTFS e gera o grafo)
set -euo pipefail
cd "$(dirname "$0")"

OTP_IMAGE="opentripplanner/opentripplanner:2.10.0"
OSM_URL="https://download.geofabrik.de/south-america/brazil/sudeste-latest.osm.pbf"
GTFS_URL="${GTFS_SPTRANS_URL:-https://www.sptrans.com.br/umbraco/Surface/PerfilDesenvolvedor/BaixarGTFS?memberName=sptrans}"
GTFS_FALLBACK_URL="${GTFS_SPTRANS_FALLBACK_URL:-https://files.mobilitydatabase.org/mdb-8/latest.zip}"
# Recorte da Grande SP (cobre o bounding box do GTFS da SPTrans com folga): oeste,sul,leste,norte
BBOX="-47.05,-23.98,-46.10,-23.12"

mkdir -p cache data
cp build-config.json router-config.json data/

if [ ! -f cache/sudeste.osm.pbf ] || [ -n "$(find cache/sudeste.osm.pbf -mtime +30)" ]; then
  echo "Baixando extrato OSM do Sudeste (~860 MB)..."
  curl -fL --retry 3 -o cache/sudeste.osm.pbf.part "$OSM_URL"
  mv cache/sudeste.osm.pbf.part cache/sudeste.osm.pbf
fi

echo "Recortando a Grande São Paulo com osmium (container Debian)..."
docker run --rm -v "$PWD:/work" -w /work debian:trixie-slim sh -c \
  "apt-get update -qq >/dev/null && apt-get install -y -qq osmium-tool >/dev/null && \
   osmium extract --overwrite -s smart -b $BBOX cache/sudeste.osm.pbf -o data/sao-paulo.osm.pbf"

echo "Baixando GTFS da SPTrans..."
curl -fL --retry 2 -A "baldeacao/0.1" -o data/sptrans.gtfs.zip "$GTFS_URL" \
  || curl -fL --retry 2 -A "baldeacao/0.1" -o data/sptrans.gtfs.zip "$GTFS_FALLBACK_URL"

echo "Preparando o GTFS (exact_times=1 e reparo dos traçados)..."
# Mesma rotina usada na importação para o Postgres: apps/api/src/modules/sources (gtfs:prepare).
(cd ../../apps/api && pnpm -s gtfs:prepare "$OLDPWD/data/sptrans.gtfs.zip" "$OLDPWD/data/sptrans.gtfs.prepared.zip")
mv data/sptrans.gtfs.prepared.zip data/sptrans.gtfs.zip

echo "Gerando o grafo do OTP (pode levar vários minutos)..."
docker run --rm -e JAVA_TOOL_OPTIONS="-Xmx${OTP_BUILD_HEAP:-6g}" \
  -v "$PWD/data:/var/opentripplanner" "$OTP_IMAGE" --build --save

echo "Grafo pronto em infra/otp/data/graph.obj. Suba com: docker compose -f infra/docker-compose.yml up -d otp"
