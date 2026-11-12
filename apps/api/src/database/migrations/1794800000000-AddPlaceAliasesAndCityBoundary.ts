// Busca de lugar: nomes alternativos (MASP, Mercadão, Allianz Parque) com índice de trigramas,
// e o limite do município atendido para penalizar lugares de outras cidades.
// O limite fica em geometry (não geography): serve só para ST_Covers de pontos contra um
// polígono grande, e geometry com índice GIST é bem mais rápido para isso.
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlaceAliasesAndCityBoundary1794800000000 implements MigrationInterface {
  name = 'AddPlaceAliasesAndCityBoundary1794800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "places" ADD "aliases" text NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "places" ADD "in_city" boolean`);
    await queryRunner.query(
      `CREATE INDEX "idx_places_aliases_trgm" ON "places" USING gin (f_unaccent(lower("aliases")) gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE TABLE "city_boundaries" ("name" text NOT NULL, "area" geometry(MultiPolygon,4326) NOT NULL, CONSTRAINT "PK_city_boundaries_name" PRIMARY KEY ("name"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_city_boundaries_area" ON "city_boundaries" USING GiST ("area") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_city_boundaries_area"`);
    await queryRunner.query(`DROP TABLE "city_boundaries"`);
    await queryRunner.query(`DROP INDEX "public"."idx_places_aliases_trgm"`);
    await queryRunner.query(`ALTER TABLE "places" DROP COLUMN "in_city"`);
    await queryRunner.query(`ALTER TABLE "places" DROP COLUMN "aliases"`);
  }
}
