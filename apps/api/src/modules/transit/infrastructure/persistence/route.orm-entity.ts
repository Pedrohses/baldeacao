import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

// Tabelas GTFS: o módulo sources grava (importação em lote, SQL próprio); o transit lê por aqui.
@Entity('routes')
// Busca por texto (ILIKE '%q%') usa índices de trigramas criados na migração, fora do sync do TypeORM.
@Index('idx_routes_short_name_trgm', { synchronize: false })
@Index('idx_routes_long_name_trgm', { synchronize: false })
export class RouteOrmEntity {
  @PrimaryColumn({ name: 'source_id', type: 'text' })
  sourceId: string;

  @PrimaryColumn({ name: 'route_id', type: 'text' })
  routeId: string;

  @Column({ name: 'agency_id', type: 'text', nullable: true })
  agencyId: string | null;

  @Column({ name: 'short_name', type: 'text' })
  shortName: string;

  @Column({ name: 'long_name', type: 'text' })
  longName: string;

  @Column({ name: 'route_type', type: 'smallint' })
  routeType: number;

  @Column({ type: 'char', length: 6, nullable: true })
  color: string | null;

  @Column({ name: 'text_color', type: 'char', length: 6, nullable: true })
  textColor: string | null;
}
