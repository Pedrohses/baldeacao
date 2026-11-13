/**
 * IP do cliente para o limite por IP. Atrás de um proxy (Caddy na VM, cloudflared no PC) todo
 * pedido chega do IP do proxy; o IP real vem em X-Forwarded-For, que o proxy acrescenta no fim.
 * Só se confia nesse cabeçalho quando o pedido chega de um proxy confiável, e lê-se da direita
 * para a esquerda até o primeiro endereço que não é proxy: o que o cliente forjar fica à esquerda.
 */
export interface ClientIpRequest {
  socket?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
}

const LOOPBACK = ['127.0.0.0/8', '::1'];

/** "::ffff:10.0.0.2" (IPv4 mapeado em IPv6) vira "10.0.0.2". */
function normalize(ip: string): string {
  const trimmed = ip.trim();
  return trimmed.toLowerCase().startsWith('::ffff:') && trimmed.includes('.')
    ? trimmed.slice(7)
    : trimmed.toLowerCase();
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

/** Lista de proxies confiáveis: IPs exatos (v4 ou v6) e faixas IPv4 em CIDR. */
export class TrustedProxies {
  private readonly exact = new Set<string>();
  private readonly ranges: { base: number; mask: number }[] = [];

  constructor(entries: readonly string[]) {
    for (const entry of [...LOOPBACK, ...entries]) {
      const [address = '', bits] = entry.split('/');
      const base = ipv4ToInt(normalize(address));
      if (bits !== undefined && base !== null) {
        const size = Number(bits);
        if (size < 0 || size > 32) continue;
        const mask = size === 0 ? 0 : (0xffffffff << (32 - size)) >>> 0;
        this.ranges.push({ base: (base & mask) >>> 0, mask });
      } else {
        this.exact.add(normalize(address));
      }
    }
  }

  has(ip: string): boolean {
    const normalized = normalize(ip);
    if (this.exact.has(normalized)) return true;
    const value = ipv4ToInt(normalized);
    if (value === null) return false;
    return this.ranges.some(({ base, mask }) => (value & mask) >>> 0 === base);
  }
}

function header(req: ClientIpRequest, name: string): string | undefined {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value.join(',') : value;
}

export function clientIp(req: ClientIpRequest, trusted: TrustedProxies): string {
  const remote = normalize(req.socket?.remoteAddress ?? 'desconhecido');
  if (!trusted.has(remote)) return remote;

  const forwarded = (header(req, 'x-forwarded-for') ?? '')
    .split(',')
    .map((item) => normalize(item))
    .filter((item) => item !== '');
  for (let i = forwarded.length - 1; i >= 0; i--) {
    const hop = forwarded[i] as string;
    if (!trusted.has(hop)) return hop;
  }

  // cloudflared antigo pode mandar só o CF-Connecting-IP.
  const cf = header(req, 'cf-connecting-ip')?.trim();
  if (cf) return normalize(cf);
  return forwarded[0] ?? remote;
}
