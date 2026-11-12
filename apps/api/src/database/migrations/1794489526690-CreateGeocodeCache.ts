// Cache de geocodificação (Nominatim), pela consulta normalizada. Gerada com migration:generate.
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGeocodeCache1794489526690 implements MigrationInterface {
  name = 'CreateGeocodeCache1794489526690';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "geocode_cache" ("query_key" text NOT NULL, "query" text NOT NULL, "places" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_8ba6dc0af53b4fa67c877ba8931" PRIMARY KEY ("query_key"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_geocode_cache_expires_at" ON "geocode_cache"  ("expires_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_geocode_cache_expires_at"`);
    await queryRunner.query(`DROP TABLE "geocode_cache"`);
  }
}
