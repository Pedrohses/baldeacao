import { z } from 'zod';

/** Cidade atendida pelas tools: nome para o usuário, fonte de dados e fuso para formatar horários. */
export interface McpCity {
  name: string;
  sourceId: string;
  timeZone: string;
}

const SAO_PAULO: McpCity = {
  name: 'São Paulo',
  sourceId: 'sptrans',
  timeZone: 'America/Sao_Paulo',
};

// Chaves sem acento, em minúsculas e com espaços como hífen.
const CITIES: Record<string, McpCity> = {
  'sao-paulo': SAO_PAULO,
  'sao-paulo-sp': SAO_PAULO,
  sp: SAO_PAULO,
};

/** Parâmetro opcional `cidade`, comum a todas as tools. */
export const cityInput = z
  .string()
  .max(60)
  .optional()
  .describe('Cidade da consulta. Padrão: São Paulo, que por enquanto é a única atendida.');

/** Resolve a cidade informada (padrão São Paulo) ou null se ela ainda não é atendida. */
export function resolveCity(input: string | undefined): McpCity | null {
  if (input === undefined || input.trim() === '') return SAO_PAULO;
  const key = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s,/]+/g, '-');
  return CITIES[key] ?? null;
}

export function unsupportedCityMessage(input: string | undefined): string {
  return `Ainda não tenho dados de ${input ?? 'essa cidade'}. Por enquanto só atendo São Paulo.`;
}
