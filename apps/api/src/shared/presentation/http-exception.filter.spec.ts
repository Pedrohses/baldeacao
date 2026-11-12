import { Body, Controller, Get, type INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiErrorBodySchema } from '@baldeacao/types';
import request from 'supertest';
import type { App } from 'supertest/types';
import { z } from 'zod';
import { SourceUnavailableError } from '../domain/errors/source-unavailable.error';
import { HttpExceptionFilter } from './http-exception.filter';
import { formatZodIssues } from './zod-issues';

@Controller('teste')
class ProbeController {
  @Post('eco')
  echo(@Body() body: unknown): unknown {
    return body;
  }

  @Get('otp')
  otp(): never {
    throw new SourceUnavailableError('otp', 'A fonte de dados otp está indisponível (OTP_URL).');
  }

  @Get('quebra')
  broken(): never {
    throw new Error('segredo interno');
  }
}

describe('HttpExceptionFilter (global)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterAll(() => app?.close());

  it('rota inexistente: 404 { code, message } em português', async () => {
    const res = await request(app.getHttpServer()).get('/nada?x=1').expect(404);
    expect(ApiErrorBodySchema.parse(res.body)).toEqual({
      code: 'NOT_FOUND',
      message: 'Rota não encontrada: GET /nada.',
    });
  });

  it('JSON inválido: 400 { code, message }', async () => {
    const res = await request(app.getHttpServer())
      .post('/teste/eco')
      .set('Content-Type', 'application/json')
      .send('{ruim')
      .expect(400);
    expect(ApiErrorBodySchema.parse(res.body)).toEqual({
      code: 'INVALID_QUERY',
      message: 'Corpo da requisição não é um JSON válido.',
    });
  });

  it('fonte fora do ar: 503 com texto amigável, sem citar "otp"', async () => {
    const res = await request(app.getHttpServer()).get('/teste/otp').expect(503);
    const body = ApiErrorBodySchema.parse(res.body);
    expect(body.code).toBe('SOURCE_UNAVAILABLE');
    expect(body.message).toBe(
      'O planejador de viagens está indisponível no momento. Tente novamente em instantes.',
    );
    expect(body.message.toLowerCase()).not.toContain('otp');
  });

  it('erro inesperado: 500 genérico, sem vazar a mensagem interna', async () => {
    const res = await request(app.getHttpServer()).get('/teste/quebra').expect(500);
    const body = ApiErrorBodySchema.parse(res.body);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).not.toContain('segredo');
  });
});

describe('formatZodIssues', () => {
  const schema = z.object({
    lat: z.number().min(-90).max(90),
    q: z.string().min(2),
    mode: z.enum(['quick', 'full']),
    when: z.iso.datetime({ offset: true }).optional(),
    n: z.number().int(),
    custom: z.string().refine((v) => v === 'ok', { message: 'Use "ok".' }),
  });

  it('traduz as mensagens padrão e mantém as customizadas', () => {
    const result = schema.safeParse({
      lat: 100,
      q: 'a',
      mode: 'x',
      when: 'amanhã',
      n: 1.5,
      custom: 'não',
    });
    expect(result.success).toBe(false);
    expect(formatZodIssues(result.error?.issues ?? [])).toBe(
      [
        'lat: deve ser no máximo 90',
        'q: deve ter pelo menos 2 caracteres',
        'mode: deve ser "quick" ou "full"',
        'when: deve estar no formato data e hora ISO 8601 com fuso (ex.: 2026-11-12T08:00:00-03:00)',
        'n: deve ser um número inteiro',
        'custom: Use "ok".',
      ].join('; '),
    );
  });

  it('campo ausente é obrigatório; tipo errado diz o tipo esperado', () => {
    const result = z.object({ to: z.object({}), lat: z.number() }).safeParse({ lat: 'x' });
    expect(formatZodIssues(result.error?.issues ?? [], 'corpo')).toBe(
      'to: é obrigatório; lat: deve ser um número',
    );
  });
});
