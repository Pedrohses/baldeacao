import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { Injectable } from '@nestjs/common';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { type OsmPoiFeature, OsmPoiExtractor } from '../../domain/ports/osm-poi-extractor.port';

export const OSMIUM_SOURCE = 'osmium';
const IMAGE = 'debian:trixie-slim';

/** Filtros do `osmium tags-filter` (mesmas categorias de osm-poi-category). */
export const OSMIUM_TAG_FILTERS = [
  'nwr/leisure=park,stadium,garden',
  'nwr/tourism=attraction,museum,zoo',
  'nwr/amenity=university,college,hospital,theatre,marketplace,bus_station',
  'nwr/shop=mall',
  'nwr/aeroway=aerodrome',
  'nwr/railway=station',
  'nwr/landuse=cemetery',
  'nwr/historic',
  'nwr/place=suburb,quarter,neighbourhood',
  // Limites municipais: o do município atendido penaliza na busca o que fica fora dele.
  'r/admin_level=8',
];

interface GeoJsonFeature {
  type: 'Feature';
  geometry: unknown;
  properties?: Record<string, unknown>;
}

/** Linha do GeoJSON Text Sequences (RFC 8142) do `osmium export`; null se não for um objeto válido. */
export function parseOsmiumFeature(line: string): OsmPoiFeature | null {
  // RS (U+001E) abre cada registro.
  const text = (line.startsWith('\u001e') ? line.slice(1) : line).trim();
  if (!text) return null;
  let feature: GeoJsonFeature;
  try {
    feature = JSON.parse(text) as GeoJsonFeature;
  } catch {
    return null;
  }
  const props = feature.properties ?? {};
  const osmType = props['@type'];
  const osmId = props['@id'];
  if (typeof osmType !== 'string' || typeof osmId !== 'number' || !feature.geometry) return null;
  const tags: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!key.startsWith('@') && typeof value === 'string') tags[key] = value;
  }
  return {
    osmType,
    osmId,
    tags,
    geometryGeoJson: JSON.stringify(feature.geometry),
  };
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} saiu com código ${code}: ${stderr}`)),
    );
  });
}

/**
 * Extrai os lugares com osmium num container Debian (mesmo padrão de infra/otp/prepare.sh):
 * `tags-filter` pelas categorias e `export` para GeoJSON, só pontos e áreas (via fechada vira
 * área, sem repetir como linha). O centroide da área é calculado no PostGIS na gravação.
 */
@Injectable()
export class OsmiumPoiExtractorAdapter extends OsmPoiExtractor {
  async extract(pbfPath: string): Promise<OsmPoiFeature[]> {
    const outDir = await mkdtemp(join(tmpdir(), 'baldeacao-places-'));
    try {
      const uid = process.getuid?.() ?? 0;
      const gid = process.getgid?.() ?? 0;
      const script = [
        'apt-get update -qq >/dev/null',
        'DEBIAN_FRONTEND=noninteractive apt-get install -y -qq osmium-tool >/dev/null',
        `osmium tags-filter --overwrite /in/${basename(pbfPath)} ${OSMIUM_TAG_FILTERS.join(' ')} -o /out/pois.osm.pbf`,
        'osmium export --overwrite -f geojsonseq -a type,id --geometry-types=point,polygon /out/pois.osm.pbf -o /out/pois.geojsonseq',
        `chown -R ${uid}:${gid} /out`,
      ].join(' && ');
      try {
        await run('docker', [
          'run',
          '--rm',
          '-v',
          `${dirname(pbfPath)}:/in:ro`,
          '-v',
          `${outDir}:/out`,
          IMAGE,
          'sh',
          '-c',
          script,
        ]);
      } catch (error) {
        throw new SourceUnavailableError(
          OSMIUM_SOURCE,
          'Não foi possível extrair os lugares do arquivo OSM (osmium via Docker).',
          { cause: error },
        );
      }
      const features: OsmPoiFeature[] = [];
      const lines = createInterface({
        input: createReadStream(join(outDir, 'pois.geojsonseq'), 'utf8'),
        crlfDelay: Infinity,
      });
      for await (const line of lines) {
        const feature = parseOsmiumFeature(line);
        if (feature) features.push(feature);
      }
      return features;
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }
}
