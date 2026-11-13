import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  API_PATHS,
  type ApiErrorBody,
  type PlanTripResponse,
  TripRequestSchema,
} from '@baldeacao/types';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { friendlySourceMessage } from '../../../../shared/presentation/source-messages';
import { HeavyRoute } from '../../../../shared/presentation/throttling/heavy-route.decorator';
import { formatZodIssues } from '../../../../shared/presentation/zod-issues';
import { PlanTripUseCase } from '../../application/use-cases/plan-trip.use-case';
import { InvalidTripRequestError } from '../../domain/errors/invalid-trip-request.error';

@Controller()
export class TripsController {
  constructor(private readonly planTrip: PlanTripUseCase) {}

  /** Planeja viagem de A até B (OpenTripPlanner). Corpo: TripRequest. */
  @Post(API_PATHS.planTrip)
  @HeavyRoute()
  @HttpCode(HttpStatus.OK)
  async plan(@Body() body: unknown): Promise<PlanTripResponse> {
    const parsed = TripRequestSchema.safeParse(body);
    if (!parsed.success) {
      const details = formatZodIssues(parsed.error.issues, 'corpo');
      throw new BadRequestException({
        code: 'INVALID_QUERY',
        message: `Pedido de viagem inválido (${details}).`,
      } satisfies ApiErrorBody);
    }
    try {
      // Itinerary do domínio tem o mesmo formato do contrato.
      return await this.planTrip.execute(parsed.data);
    } catch (error) {
      if (error instanceof InvalidTripRequestError) {
        throw new BadRequestException({
          code: error.code,
          message: error.message,
        } satisfies ApiErrorBody);
      }
      if (error instanceof SourceUnavailableError) {
        throw new ServiceUnavailableException({
          code: error.code,
          message: friendlySourceMessage(error),
        } satisfies ApiErrorBody);
      }
      throw error;
    }
  }
}
