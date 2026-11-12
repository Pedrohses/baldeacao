import { Injectable } from '@nestjs/common';
import type { Place } from '../../domain/entities/place.entity';
import { Geocoder } from '../../domain/ports/geocoder.port';
import { NominatimClient } from './nominatim.client';
import { NominatimPlaceMapper } from './nominatim-place.mapper';

/** Geocoder sobre o Nominatim (1 req/s, Grande SP). O cache fica no caso de uso. */
@Injectable()
export class NominatimGeocoderAdapter extends Geocoder {
  constructor(private readonly client: NominatimClient) {
    super();
  }

  async search(query: string, limit: number): Promise<Place[]> {
    const results = await this.client.search(query, limit);
    return NominatimPlaceMapper.toDomainList(results).slice(0, limit);
  }
}
