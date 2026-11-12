// Busca rápida de parada por nome (autocompletar): unaccent + índice GIN de trigramas sobre o nome sem acento.
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStopNameSearch1794600000000 implements MigrationInterface {
  name = 'AddStopNameSearch1794600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    // unaccent() é STABLE; o wrapper IMMUTABLE (com dicionário fixo) permite usá-lo em índice.
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_stops_name_trgm" ON "stops" USING gin (f_unaccent(lower("name")) gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_stops_name_trgm"`);
    await queryRunner.query(`DROP FUNCTION f_unaccent(text)`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS unaccent`);
  }
}
