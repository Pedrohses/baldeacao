import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePostgis1794401711811 implements MigrationInterface {
  name = 'EnablePostgis1794401711811';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP EXTENSION IF EXISTS postgis');
  }
}
