// O paint do MapLibre não lê variáveis CSS: estes são os tokens do tema claro em hex,
// casados com o estilo positron (o estilo escuro do mapa fica para a P2).
export const MAP_COLORS = {
  brand: '#0B4F5C',
  text: '#101A20',
  muted: '#4F5D67',
  surface: '#FFFFFF',
  live: '#0A7A3E',
} as const;
