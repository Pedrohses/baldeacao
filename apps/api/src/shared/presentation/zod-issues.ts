// Mensagens de validação do Zod em português do Brasil (HTTP e tools MCP).
import type { z } from 'zod';

type Issue = z.core.$ZodIssue;

// Mensagens padrão do Zod (inglês); qualquer outra foi escrita no schema e fica como está.
const ZOD_DEFAULT_MESSAGE = /^(Invalid|Too (small|big)|Unrecognized)\b/;

const TYPE_NAMES: Record<string, string> = {
  number: 'um número',
  int: 'um número inteiro',
  string: 'um texto',
  boolean: 'verdadeiro ou falso',
  object: 'um objeto',
  array: 'uma lista',
  date: 'uma data',
};

const FORMAT_NAMES: Record<string, string> = {
  datetime: 'data e hora ISO 8601 com fuso (ex.: 2026-11-12T08:00:00-03:00)',
  date: 'data AAAA-MM-DD',
  email: 'e-mail',
  url: 'URL',
  regex: 'formato esperado',
};

function sizeUnit(origin: string | undefined, count: number | bigint | Date): string {
  if (origin === 'string') return Number(count) === 1 ? 'caractere' : 'caracteres';
  if (origin === 'array' || origin === 'set') return Number(count) === 1 ? 'item' : 'itens';
  return '';
}

function describeIssue(issue: Issue): string {
  switch (issue.code) {
    case 'invalid_type': {
      // A issue final não traz o valor recebido; o texto padrão diz ("received undefined").
      if (/received undefined/.test(issue.message)) return 'é obrigatório';
      return `deve ser ${TYPE_NAMES[issue.expected] ?? issue.expected}`;
    }
    case 'too_small': {
      const unit = sizeUnit(issue.origin, issue.minimum);
      if (unit) return `deve ter pelo menos ${String(issue.minimum)} ${unit}`;
      return issue.inclusive === false
        ? `deve ser maior que ${String(issue.minimum)}`
        : `deve ser no mínimo ${String(issue.minimum)}`;
    }
    case 'too_big': {
      const unit = sizeUnit(issue.origin, issue.maximum);
      if (unit) return `deve ter no máximo ${String(issue.maximum)} ${unit}`;
      return issue.inclusive === false
        ? `deve ser menor que ${String(issue.maximum)}`
        : `deve ser no máximo ${String(issue.maximum)}`;
    }
    case 'invalid_value':
      return `deve ser ${issue.values.map((v) => `"${String(v)}"`).join(' ou ')}`;
    case 'invalid_format':
      return `deve estar no formato ${FORMAT_NAMES[issue.format] ?? issue.format}`;
    case 'not_multiple_of':
      return `deve ser múltiplo de ${String(issue.divisor)}`;
    case 'unrecognized_keys':
      return `tem campos desconhecidos (${issue.keys.join(', ')})`;
    default:
      return 'é inválido';
  }
}

/**
 * Mensagem em português da issue. Mensagem customizada no schema (diferente do padrão em
 * inglês do Zod) fica como está; a padrão é traduzida.
 */
export function zodIssueMessage(issue: Issue): string {
  if (issue.message && !ZOD_DEFAULT_MESSAGE.test(issue.message)) return issue.message;
  return describeIssue(issue);
}

/** "lat: deve ser um número; to: é obrigatório" (campo `fallbackPath` quando a issue é da raiz). */
export function formatZodIssues(issues: readonly Issue[], fallbackPath = 'entrada'): string {
  return issues
    .map(
      (issue) => `${issue.path.map(String).join('.') || fallbackPath}: ${zodIssueMessage(issue)}`,
    )
    .join('; ');
}
