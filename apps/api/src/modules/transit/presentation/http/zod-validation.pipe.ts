import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ApiErrorBody } from '@baldeacao/types';
import type { z } from 'zod';
import { formatZodIssues } from '../../../../shared/presentation/zod-issues';

/** Valida e converte query/params com um schema Zod do contrato; erro vira 400 ApiErrorBody. */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const details = formatZodIssues(result.error.issues);
    const body: ApiErrorBody = {
      code: 'INVALID_QUERY',
      message: `Parâmetros inválidos (${details}).`,
    };
    throw new BadRequestException(body);
  }
}
