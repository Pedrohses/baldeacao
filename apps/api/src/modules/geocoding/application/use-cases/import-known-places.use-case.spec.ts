import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { InMemoryKnownPlaceRepository } from '../../../../../test/support/geocoding-in-memory';
import { type OsmPoiFeature, OsmPoiExtractor } from '../../domain/ports/osm-poi-extractor.port';
import { parseOsmiumFeature } from '../../infrastructure/adapters/osmium-poi-extractor.adapter';
import { ImportKnownPlacesUseCase } from './import-known-places.use-case';

// Saída real do `osmium export -f geojsonseq -a type,id` (recorte), com geometrias reduzidas.
const FIXTURE = join(__dirname, '../../../../../test/fixtures/osm/pois.geojsonseq');

class FixtureExtractor extends OsmPoiExtractor {
  readonly paths: string[] = [];
  extract(pbfPath: string): Promise<OsmPoiFeature[]> {
    this.paths.push(pbfPath);
    const features = readFileSync(FIXTURE, 'utf8')
      .split('\n')
      .map(parseOsmiumFeature)
      .filter((feature): feature is OsmPoiFeature => feature !== null);
    return Promise.resolve(features);
  }
}

describe('ImportKnownPlacesUseCase', () => {
  it('grava só os lugares com nome e categoria, com id no formato do Nominatim', async () => {
    const extractor = new FixtureExtractor();
    const repository = new InMemoryKnownPlaceRepository();
    const result = await new ImportKnownPlacesUseCase(extractor, repository).execute({
      pbfPath: '/dados/sao-paulo.osm.pbf',
    });

    expect(extractor.paths).toEqual(['/dados/sao-paulo.osm.pbf']);
    expect(result).toMatchObject({ extracted: 5, imported: 3, skipped: 2 });
    const [records] = repository.replaced;
    expect(records?.map((r) => [r.id, r.name, r.category])).toEqual([
      ['osm:relation:5349780', 'Jardim Botânico de São Paulo', 'leisure=garden'],
      ['osm:way:125450993', 'Parque Ibirapuera', 'leisure=park'],
      ['osm:node:174003742', 'Silvio Romero Plaza', 'shop=mall'],
    ]);
    expect(records?.[0]).toMatchObject({
      address: 'Avenida Miguel Estéfano, 3031, Água Funda, São Paulo',
      city: 'São Paulo',
    });
    expect(JSON.parse(records?.[1]?.geometryGeoJson ?? '{}')).toMatchObject({
      type: 'MultiPolygon',
    });
  });
});
