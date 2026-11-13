import { SetMetadata } from '@nestjs/common';

export const HEAVY_ROUTE = 'baldeacao:heavy-route';

/** Rota cara (OTP ou Nominatim): além do limite geral, entra no limite `heavy`. */
export const HeavyRoute = (): MethodDecorator => SetMetadata(HEAVY_ROUTE, true);
