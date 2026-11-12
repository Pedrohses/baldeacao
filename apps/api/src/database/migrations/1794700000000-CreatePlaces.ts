// Lugares conhecidos do OSM (parques, museus, hospitais...) para a busca local de lugar.
// Busca por nome igual à de paradas: índice GIN de trigramas sobre f_unaccent(lower(name)).
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlaces1794700000000 implements MigrationInterface {
  name = 'CreatePlaces1794700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "places" ("osm_id" text NOT NULL, "name" text NOT NULL, "category" text NOT NULL, "kind" text NOT NULL DEFAULT 'poi', "importance" smallint NOT NULL DEFAULT '0', "address" text, "suburb" text, "city" text, "location" geography(Point,4326) NOT NULL, CONSTRAINT "PK_places_osm_id" PRIMARY KEY ("osm_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_places_location" ON "places" USING GiST ("location") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_places_name_trgm" ON "places" USING gin (f_unaccent(lower("name")) gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_places_name_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."idx_places_location"`);
    await queryRunner.query(`DROP TABLE "places"`);
  }
}
