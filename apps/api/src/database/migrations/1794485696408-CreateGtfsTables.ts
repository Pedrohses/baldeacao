// Tabelas GTFS (rede planejada). Gerada com migration:generate; pg_trgm e índices de trigramas à mão.
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGtfsTables1794485696408 implements MigrationInterface {
  name = 'CreateGtfsTables1794485696408';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(
      `CREATE TABLE "calendar" ("source_id" text NOT NULL, "service_id" text NOT NULL, "monday" boolean NOT NULL, "tuesday" boolean NOT NULL, "wednesday" boolean NOT NULL, "thursday" boolean NOT NULL, "friday" boolean NOT NULL, "saturday" boolean NOT NULL, "sunday" boolean NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, CONSTRAINT "PK_83ccc8fbc6a0649d51d1dc03141" PRIMARY KEY ("source_id", "service_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "routes" ("source_id" text NOT NULL, "route_id" text NOT NULL, "agency_id" text, "short_name" text NOT NULL, "long_name" text NOT NULL, "route_type" smallint NOT NULL, "color" character(6), "text_color" character(6), CONSTRAINT "PK_152af685aa528757d8a127d7956" PRIMARY KEY ("source_id", "route_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "trips" ("source_id" text NOT NULL, "trip_id" text NOT NULL, "route_id" text NOT NULL, "service_id" text NOT NULL, "headsign" text, "direction_id" smallint, "shape_id" text, CONSTRAINT "PK_555fefbe220b4d89cea1a3a087d" PRIMARY KEY ("source_id", "trip_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_trips_route_direction" ON "trips"  ("source_id", "route_id", "direction_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "frequencies" ("source_id" text NOT NULL, "trip_id" text NOT NULL, "start_time" integer NOT NULL, "end_time" integer NOT NULL, "headway_secs" integer NOT NULL, CONSTRAINT "PK_953f6e5105ec7f7baa01b480e5e" PRIMARY KEY ("source_id", "trip_id", "start_time"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "shapes" ("source_id" text NOT NULL, "shape_id" text NOT NULL, "path" geography(LineString,4326) NOT NULL, CONSTRAINT "PK_e3ac3bdd5c1e87ead0e512e3015" PRIMARY KEY ("source_id", "shape_id"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_shapes_path" ON "shapes" USING gist ("path") `);
    await queryRunner.query(
      `CREATE TABLE "stops" ("source_id" text NOT NULL, "stop_id" text NOT NULL, "code" text, "name" text NOT NULL, "description" text, "location" geography(Point,4326) NOT NULL, CONSTRAINT "PK_6da8d19c736774a02970f9a9a6d" PRIMARY KEY ("source_id", "stop_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_stops_location" ON "stops" USING gist ("location") `,
    );
    await queryRunner.query(
      `CREATE TABLE "stop_times" ("source_id" text NOT NULL, "trip_id" text NOT NULL, "stop_sequence" integer NOT NULL, "stop_id" text NOT NULL, "arrival_time" integer, "departure_time" integer, CONSTRAINT "PK_aff87b9e0321da0e1ea48ddfb38" PRIMARY KEY ("source_id", "trip_id", "stop_sequence"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_stop_times_stop" ON "stop_times"  ("source_id", "stop_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_routes_short_name_trgm" ON "routes" USING gin ("short_name" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_routes_long_name_trgm" ON "routes" USING gin ("long_name" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ADD CONSTRAINT "FK_9cd2c7051be3e7c56e774c0510c" FOREIGN KEY ("source_id", "route_id") REFERENCES "routes"("source_id","route_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "frequencies" ADD CONSTRAINT "FK_f5bf8979054bfa75d2efade4362" FOREIGN KEY ("source_id", "trip_id") REFERENCES "trips"("source_id","trip_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stop_times" ADD CONSTRAINT "FK_8b1ec72d2dcb925f928bd1f1a16" FOREIGN KEY ("source_id", "trip_id") REFERENCES "trips"("source_id","trip_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stop_times" ADD CONSTRAINT "FK_37939453945ccb257ad4c0592ba" FOREIGN KEY ("source_id", "stop_id") REFERENCES "stops"("source_id","stop_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stop_times" DROP CONSTRAINT "FK_37939453945ccb257ad4c0592ba"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stop_times" DROP CONSTRAINT "FK_8b1ec72d2dcb925f928bd1f1a16"`,
    );
    await queryRunner.query(
      `ALTER TABLE "frequencies" DROP CONSTRAINT "FK_f5bf8979054bfa75d2efade4362"`,
    );
    await queryRunner.query(`ALTER TABLE "trips" DROP CONSTRAINT "FK_9cd2c7051be3e7c56e774c0510c"`);
    await queryRunner.query(`DROP INDEX "public"."idx_stop_times_stop"`);
    await queryRunner.query(`DROP TABLE "stop_times"`);
    await queryRunner.query(`DROP INDEX "public"."idx_stops_location"`);
    await queryRunner.query(`DROP TABLE "stops"`);
    await queryRunner.query(`DROP INDEX "public"."idx_shapes_path"`);
    await queryRunner.query(`DROP TABLE "shapes"`);
    await queryRunner.query(`DROP TABLE "frequencies"`);
    await queryRunner.query(`DROP INDEX "public"."idx_trips_route_direction"`);
    await queryRunner.query(`DROP TABLE "trips"`);
    await queryRunner.query(`DROP INDEX "public"."idx_routes_long_name_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."idx_routes_short_name_trgm"`);
    await queryRunner.query(`DROP TABLE "routes"`);
    await queryRunner.query(`DROP TABLE "calendar"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS pg_trgm`);
  }
}
