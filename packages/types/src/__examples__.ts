// Exemplos válidos de cada contrato: o typecheck garante a forma, o teste do web roda o parse.
// Usam os mesmos ids e coordenadas das fixtures em apps/api/test/fixtures (gtfs/sptrans-mini e olho-vivo).
import type {
  Arrival,
  LineShape,
  PositionsSubscription,
  PositionsUpdate,
  Route,
  Stop,
  VehiclePosition,
  VehicleSnapshot,
  Itinerary,
  Place,
  TripRequest,
} from './index.js';

export const routeExample = {
  id: '875A-10',
  sourceId: 'sptrans',
  shortName: '875A-10',
  longName: 'Perdizes - Aeroporto',
  type: 'bus',
  color: '509E2F',
  textColor: 'FFFFFF',
} satisfies Route;

export const stopExample = {
  id: '4301848',
  sourceId: 'sptrans',
  code: null,
  name: 'Av. Paulista 1578',
  description: 'Em frente ao MASP',
  location: { lat: -23.5614, lon: -46.6559 },
} satisfies Stop;

export const lineShapeExample = {
  routeId: '875A-10',
  sourceId: 'sptrans',
  directionId: 0,
  shapeId: '84609',
  points: [
    { lat: -23.535, lon: -46.675 },
    { lat: -23.5455, lon: -46.6685 },
  ],
} satisfies LineShape;

export const arrivalExample = {
  stopId: '4301848',
  routeId: '875A-10',
  routeShortName: '875A-10',
  directionId: 0,
  headsign: 'Aeroporto',
  vehicleId: '11433',
  expectedAt: '2026-11-12T12:36:00-03:00',
  isRealtime: true,
  accessible: true,
  vehicleLocation: { lat: -23.559, lon: -46.6612 },
} satisfies Arrival;

export const vehiclePositionExample = {
  vehicleId: '11433',
  sourceId: 'sptrans',
  routeId: '875A-10',
  routeShortName: '875A-10',
  directionId: 0,
  location: { lat: -23.559, lon: -46.6612 },
  accessible: true,
  recordedAt: '2026-11-12T15:34:10Z',
} satisfies VehiclePosition;

export const vehicleSnapshotExample = {
  sourceId: 'sptrans',
  routeId: null,
  updatedAt: '2026-11-12T15:34:30Z',
  vehicles: [vehiclePositionExample],
} satisfies VehicleSnapshot;

export const positionsSubscriptionExample = {
  channel: 'positions:line:875A-10',
} satisfies PositionsSubscription;

export const positionsUpdateExample = {
  ...vehicleSnapshotExample,
  routeId: '875A-10',
  channel: 'positions:line:875A-10',
} satisfies PositionsUpdate;

// ---- v2: lugares e viagem (Morumbis -> Terminal Tietê, dados ilustrativos) ----

export const placeOriginExample = {
  id: 'osm:way:23935207',
  name: 'Estádio do Morumbis',
  address: 'Praça Roberto Gomes Pedrosa, 1, Morumbi, São Paulo',
  kind: 'poi',
  location: { lat: -23.6, lon: -46.7202 },
} satisfies Place;

export const placeDestinationExample = {
  id: 'osm:node:2621468245',
  name: 'Terminal Rodoviário Tietê',
  address: 'Av. Cruzeiro do Sul, 1800, Santana, São Paulo',
  kind: 'poi',
  location: { lat: -23.5163, lon: -46.6252 },
} satisfies Place;

export const tripRequestExample = {
  from: placeOriginExample.location,
  to: placeDestinationExample.location,
  departAt: '2026-11-12T08:00:00-03:00',
  maxItineraries: 3,
} satisfies TripRequest;

export const itineraryExample = {
  startAt: '2026-11-12T08:00:00-03:00',
  endAt: '2026-11-12T09:04:00-03:00',
  durationS: 3840,
  walkDistanceM: 650,
  transfers: 1,
  legs: [
    {
      mode: 'walk',
      from: { name: 'Estádio do Morumbis', location: { lat: -23.6, lon: -46.7202 }, stopId: null },
      to: {
        name: 'Av. Giovanni Gronchi',
        location: { lat: -23.6012, lon: -46.7225 },
        stopId: '1906488',
      },
      startAt: '2026-11-12T08:00:00-03:00',
      endAt: '2026-11-12T08:05:00-03:00',
      durationS: 300,
      distanceM: 350,
      routeId: null,
      routeShortName: null,
      routeColor: null,
      headsign: null,
      intermediateStops: 0,
      isRealtime: false,
      points: [
        { lat: -23.6, lon: -46.7202 },
        { lat: -23.6012, lon: -46.7225 },
      ],
    },
    {
      mode: 'bus',
      from: {
        name: 'Av. Giovanni Gronchi',
        location: { lat: -23.6012, lon: -46.7225 },
        stopId: '1906488',
      },
      to: {
        name: 'Estação Butantã',
        location: { lat: -23.5719, lon: -46.7081 },
        stopId: '60016726',
      },
      startAt: '2026-11-12T08:07:00-03:00',
      endAt: '2026-11-12T08:25:00-03:00',
      durationS: 1080,
      distanceM: 4200,
      routeId: '7725-10',
      routeShortName: '7725-10',
      routeColor: '509E2F',
      headsign: 'Rio Pequeno',
      intermediateStops: 9,
      isRealtime: true,
      points: [
        { lat: -23.6012, lon: -46.7225 },
        { lat: -23.5719, lon: -46.7081 },
      ],
    },
    {
      mode: 'subway',
      from: { name: 'Butantã', location: { lat: -23.5719, lon: -46.7081 }, stopId: null },
      to: { name: 'Portuguesa-Tietê', location: { lat: -23.5163, lon: -46.6252 }, stopId: null },
      startAt: '2026-11-12T08:31:00-03:00',
      endAt: '2026-11-12T09:01:00-03:00',
      durationS: 1800,
      distanceM: 14500,
      routeId: null,
      routeShortName: 'L4 e L1',
      routeColor: 'FFD700',
      headsign: 'Tucuruvi',
      intermediateStops: 11,
      isRealtime: false,
      points: [
        { lat: -23.5719, lon: -46.7081 },
        { lat: -23.5163, lon: -46.6252 },
      ],
    },
    {
      mode: 'walk',
      from: { name: 'Portuguesa-Tietê', location: { lat: -23.5163, lon: -46.6252 }, stopId: null },
      to: {
        name: 'Terminal Rodoviário Tietê',
        location: { lat: -23.5163, lon: -46.6252 },
        stopId: null,
      },
      startAt: '2026-11-12T09:01:00-03:00',
      endAt: '2026-11-12T09:04:00-03:00',
      durationS: 180,
      distanceM: 300,
      routeId: null,
      routeShortName: null,
      routeColor: null,
      headsign: null,
      intermediateStops: 0,
      isRealtime: false,
      points: [
        { lat: -23.5163, lon: -46.6252 },
        { lat: -23.5165, lon: -46.6249 },
      ],
    },
  ],
} satisfies Itinerary;
