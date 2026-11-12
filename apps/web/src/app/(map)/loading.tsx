/** Troca de aba: o mapa continua; só um aviso discreto enquanto a tela carrega. */
export default function Loading() {
  return (
    <p
      role="status"
      className="surface-float absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-bold md:left-[calc(400px+50%)] md:-translate-x-[calc(50%+200px)]"
    >
      Carregando...
    </p>
  );
}
