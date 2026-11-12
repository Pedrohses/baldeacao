import { DomainError } from './domain-error';

export class OlhoVivoAuthError extends DomainError {
  readonly code = 'OLHO_VIVO_AUTH_FAILED';

  constructor(message = 'A Olho Vivo recusou o token de acesso. Verifique OLHOVIVO_TOKEN.') {
    super(message);
  }
}
