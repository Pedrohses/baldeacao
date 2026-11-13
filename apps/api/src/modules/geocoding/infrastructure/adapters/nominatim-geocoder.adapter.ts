import { Injectable } from '@nestjs/common';
import type { Coordinates, Place } from '../../domain/entities/place.entity';
import { Geocoder } from '../../domain/ports/geocoder.port';
import { SERVICE_CITY_NAME } from '../../domain/value-objects/service-city';
import { NominatimClient } from './nominatim.client';
import { NominatimPlaceMapper } from './nominatim-place.mapper';
import { normalizeAddressQuery, postalCodeOnly, streetOnlyQuery } from './nominatim-query';

/** Geocoder sobre o Nominatim (1 req/s, Grande SP). O cache fica no caso de uso. */
@Injectable()
export class NominatimGeocoderAdapter extends Geocoder {
  constructor(private readonly client: NominatimClient) {
    super();
  }

  async search(query: string, limit: number): Promise<Place[]> {
    // Só CEP: busca estruturada; sem resultado com o mesmo CEP, vazio (nada de texto livre,
    // que devolve qualquer lugar com aqueles dígitos).
    const postalCode = postalCodeOnly(query);
    if (postalCode) {
      const results = await this.client.searchPostalCode(postalCode, limit);
      const prefix = postalCode.slice(0, 5);
      const matching = results.filter((r) => {
        const found = r.address?.postcode?.replace(/\D/g, '');
        return !found || found.startsWith(prefix);
      });
      return NominatimPlaceMapper.toDomainList(matching).slice(0, limit);
    }
    const normalized = normalizeAddressQuery(query) || query;
    let results = await this.client.search(normalized, limit);
    // Endereço completo sem resultado: tenta só rua, número e cidade.
    const reduced = results.length === 0 ? streetOnlyQuery(normalized) : null;
    if (reduced) results = await this.client.search(reduced, limit);
    return NominatimPlaceMapper.toDomainList(results).slice(0, limit);
  }

  /** Só vias (category highway) da cidade atendida. */
  override async searchStreet(street: string, limit: number): Promise<Place[]> {
    const results = await this.client.searchStreet(street, SERVICE_CITY_NAME, limit);
    return NominatimPlaceMapper.toDomainList(results.filter((r) => r.category === 'highway')).slice(
      0,
      limit,
    );
  }

  async reverse(location: Coordinates): Promise<Place | null> {
    const result = await this.client.reverse(location.lat, location.lon);
    return result ? NominatimPlaceMapper.toDomain(result) : null;
  }
}
