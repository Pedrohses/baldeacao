// Exemplos válidos de cada contrato: o typecheck garante a forma, o teste do web roda o parse.
import type {
  Arrival,
  LineShape,
  PositionsSubscription,
  PositionsUpdate,
  Route,
  Stop,
  VehiclePosition,
  VehicleSnapshot,
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
  id: '18848',
  sourceId: 'sptrans',
  code: null,
  name: 'Av. Paulista, 1578',
  description: 'Em frente ao MASP',
  location: { lat: -23.5614, lon: -46.6559 },
} satisfies Stop;

export const lineShapeExample = {
  routeId: '875A-10',
  sourceId: 'sptrans',
  directionId: 0,
  shapeId: '84609',
  points: [
    { lat: -23.5614, lon: -46.6559 },
    { lat: -23.5631, lon: -46.6544 },
  ],
} satisfies LineShape;

export const arrivalExample = {
  stopId: '18848',
  routeId: '875A-10',
  routeShortName: '875A-10',
  directionId: 0,
  headsign: 'Aeroporto',
  vehicleId: '11433',
  expectedAt: '2026-11-12T08:42:00-03:00',
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
  recordedAt: '2026-11-12T11:39:52Z',
} satisfies VehiclePosition;

export const vehicleSnapshotExample = {
  sourceId: 'sptrans',
  routeId: null,
  updatedAt: '2026-11-12T11:40:00Z',
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
