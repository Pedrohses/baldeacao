// O paint do MapLibre não lê variáveis CSS: estes são os tokens do tema claro em hex,
// casados com o estilo positron (o estilo escuro do mapa fica para a P2).
export const MAP_COLORS = {
  brand: '#C7361F',
  text: '#2B1B14',
  muted: '#6F574A',
  surface: '#FFFFFF',
  live: '#1B7F45',
} as const;
