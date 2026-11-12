import { Injectable } from '@nestjs/common';
import type { Place } from '../../domain/entities/place.entity';
import { Geocoder } from '../../domain/ports/geocoder.port';
import { NominatimClient } from './nominatim.client';
import { NominatimPlaceMapper } from './nominatim-place.mapper';
import { normalizeAddressQuery, streetOnlyQuery } from './nominatim-query';

/** Geocoder sobre o Nominatim (1 req/s, Grande SP). O cache fica no caso de uso. */
@Injectable()
export class NominatimGeocoderAdapter extends Geocoder {
  constructor(private readonly client: NominatimClient) {
    super();
  }

  async search(query: string, limit: number): Promise<Place[]> {
    const normalized = normalizeAddressQuery(query) || query;
    let results = await this.client.search(normalized, limit);
    // Endereço completo sem resultado: tenta só rua, número e cidade.
    const reduced = results.length === 0 ? streetOnlyQuery(normalized) : null;
    if (reduced) results = await this.client.search(reduced, limit);
    return NominatimPlaceMapper.toDomainList(results).slice(0, limit);
  }
}
