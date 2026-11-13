import { Injectable } from '@nestjs/common';
import { FindAccessStopsUseCase } from '../../../transit/application/use-cases/find-access-stops.use-case';
import type { Coordinates } from '../../domain/entities/place.entity';
import { KnownPlaceRepository } from '../../domain/ports/known-place-repository.port';
import {
  AIRPORT_ACCESS_RADIUS_M,
  AIRPORT_WALKABLE_STOP_M,
  COMPACT_ACCESS_RADIUS_M,
  isAirportStationName,
  LARGE_ACCESS_MIN_OFFSET_M,
  LARGE_ACCESS_RADIUS_M,
  PLACE_LOOKUP_RADIUS_M,
  type PlaceAccessRule,
  placeAccessRule,
  STOP_LOOKUP_RADIUS_M,
} from '../../domain/value-objects/place-access';
import type { ResolvePlaceAccessInput, ResolvePlaceAccessOutput } from '../dto/place-access.dto';

interface AccessStop {
  location: Coordinates;
  distanceM: number;
  isStation: boolean;
}

/**
 * Por onde a viagem sai ou chega num ponto (ver place-access.ts). O ponto que a busca ou o
 * mapa devolveu é reconhecido pelo lugar conhecido a até 50 m (o centroide); a regra da
 * categoria escolhe a parada ou estação de acesso. Ponto em cima de uma parada fica como está.
 * `airportShuttle` quando o acesso é a estação que atende um aeroporto.
 */
@Injectable()
export class ResolvePlaceAccessUseCase {
  constructor(
    private readonly knownPlaces: KnownPlaceRepository,
    private readonly accessStops: FindAccessStopsUseCase,
  ) {}

  async execute(input: ResolvePlaceAccessInput): Promise<ResolvePlaceAccessOutput> {
    const { location } = input;
    const [here, known] = await Promise.all([
      this.accessStops.execute({ center: location, radiusM: PLACE_LOOKUP_RADIUS_M }),
      this.knownPlaces.findNearest(location, PLACE_LOOKUP_RADIUS_M),
    ]);

    // Parada escolhida (busca, mapa): é ela mesma; avisa se for a estação do aeroporto.
    if (here.stop && here.stop.distanceM <= STOP_LOOKUP_RADIUS_M) {
      const isStation = here.station?.stop.id === here.stop.stop.id;
      return {
        location,
        airportShuttle: isStation && isAirportStationName(here.stop.stop.name),
      };
    }

    const rule = known ? placeAccessRule({ category: known.category, name: known.place.name }) : null;
    const access = known && rule ? await this.accessFor(rule, known.place.location) : null;
    if (!access) return { location, airportShuttle: false };
    return {
      location: access.location,
      airportShuttle: rule === 'airport' && access.isStation && access.distanceM > AIRPORT_WALKABLE_STOP_M,
    };
  }

  private async accessFor(rule: PlaceAccessRule, center: Coordinates): Promise<AccessStop | null> {
    const radiusM =
      rule === 'airport'
        ? AIRPORT_ACCESS_RADIUS_M
        : rule === 'large'
          ? LARGE_ACCESS_RADIUS_M
          : COMPACT_ACCESS_RADIUS_M;
    const { stop, station } = await this.accessStops.execute({ center, radiusM });
    const asStop = stop && {
      location: stop.stop.location,
      distanceM: stop.distanceM,
      isStation: station?.stop.id === stop.stop.id,
    };
    const asStation = station && {
      location: station.stop.location,
      distanceM: station.distanceM,
      isStation: true,
    };
    switch (rule) {
      case 'airport':
        // Parada a pé (Congonhas): ela; senão a estação (Guarulhos, pelo ônibus gratuito).
        if (asStop && asStop.distanceM <= AIRPORT_WALKABLE_STOP_M) return asStop;
        return asStation ?? asStop;
      case 'station':
        return asStation;
      case 'terminal':
        return asStation ?? asStop;
      case 'compact':
        return asStop;
      case 'large':
        return asStop && asStop.distanceM > LARGE_ACCESS_MIN_OFFSET_M ? asStop : null;
    }
  }
}
