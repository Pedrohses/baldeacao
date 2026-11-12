import { SourceUnavailableError } from '../domain/errors/source-unavailable.error';

// Fonte fora do ar: a mensagem do adaptador pode citar o nome interno ou a configuração
// (OTP_URL etc.), então o usuário (HTTP e MCP) recebe o texto da fonte; o detalhe fica no log.
const SOURCE_UNAVAILABLE_BY_SOURCE: Record<string, string> = {
  'olho-vivo':
    'A fonte de tempo real da SPTrans (Olho Vivo) está indisponível no momento. Tente novamente em instantes.',
  otp: 'O planejador de viagens está indisponível no momento. Tente novamente em instantes.',
  nominatim:
    'A busca de endereços está indisponível no momento. Tente novamente em instantes ou informe outro lugar.',
};

const GENERIC_UNAVAILABLE =
  'Uma fonte de dados está indisponível no momento. Tente novamente em instantes.';

/** Texto amigável para a fonte que caiu, sem nomes internos nem configuração. */
export function friendlySourceMessage(error: SourceUnavailableError): string {
  return SOURCE_UNAVAILABLE_BY_SOURCE[error.source] ?? GENERIC_UNAVAILABLE;
}
