import { clientIp, TrustedProxies } from './client-ip';

const req = (remote: string, headers: Record<string, string> = {}) => ({
  socket: { remoteAddress: remote },
  headers,
});

describe('clientIp', () => {
  const caddyNetwork = new TrustedProxies(['172.18.0.0/16']);

  it('sem proxy confiável, vale o endereço da conexão e os cabeçalhos são ignorados', () => {
    const forged = { 'x-forwarded-for': '203.0.113.7', 'cf-connecting-ip': '203.0.113.8' };
    expect(clientIp(req('198.51.100.2', forged), caddyNetwork)).toBe('198.51.100.2');
  });

  it('atrás do Caddy, pega o último IP que não é proxy em X-Forwarded-For', () => {
    expect(clientIp(req('172.18.0.5', { 'x-forwarded-for': '203.0.113.7' }), caddyNetwork)).toBe(
      '203.0.113.7',
    );
  });

  it('não deixa o cliente fugir do limite forjando X-Forwarded-For (o forjado fica à esquerda)', () => {
    const headers = { 'x-forwarded-for': '1.2.3.4, 203.0.113.7' };
    expect(clientIp(req('172.18.0.5', headers), caddyNetwork)).toBe('203.0.113.7');
  });

  it('pula proxies em cadeia (cloudflared, depois Caddy)', () => {
    const trusted = new TrustedProxies(['172.18.0.0/16', '10.0.0.9']);
    const headers = { 'x-forwarded-for': '203.0.113.7, 10.0.0.9' };
    expect(clientIp(req('172.18.0.5', headers), trusted)).toBe('203.0.113.7');
  });

  it('loopback é sempre confiável; sem X-Forwarded-For, usa o CF-Connecting-IP do cloudflared', () => {
    const none = new TrustedProxies([]);
    expect(clientIp(req('127.0.0.1', { 'cf-connecting-ip': '203.0.113.7' }), none)).toBe(
      '203.0.113.7',
    );
    expect(clientIp(req('::1', { 'cf-connecting-ip': '203.0.113.7' }), none)).toBe('203.0.113.7');
    expect(clientIp(req('::ffff:127.0.0.1'), none)).toBe('127.0.0.1');
  });

  it('IPv4 mapeado em IPv6 casa com a faixa CIDR', () => {
    expect(
      clientIp(req('::ffff:172.18.0.5', { 'x-forwarded-for': '203.0.113.7' }), caddyNetwork),
    ).toBe('203.0.113.7');
    expect(caddyNetwork.has('172.19.0.1')).toBe(false);
  });
});
