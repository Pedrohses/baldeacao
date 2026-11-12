import { Injectable } from '@nestjs/common';
import { LineNotFoundError } from '../../domain/errors/line-not-found.error';
import { RouteRepository } from '../../domain/ports/route-repository.port';
import type { GetLineDetailsInput, GetLineDetailsOutput } from '../dto/transit-queries.dto';

@Injectable()
export class GetLineDetailsUseCase {
  constructor(private readonly routes: RouteRepository) {}

  async execute(input: GetLineDetailsInput): Promise<GetLineDetailsOutput> {
    const line = await this.routes.findById(input.routeId);
    if (!line) throw new LineNotFoundError(input.routeId);

    // Um traçado por sentido; com menos de dois pontos não há o que desenhar.
    const shapes = (await this.routes.findShapes(line)).filter((s) => s.points.length >= 2);
    return { line, shapes };
  }
}
