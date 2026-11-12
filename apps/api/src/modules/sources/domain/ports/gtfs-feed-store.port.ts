import type { GtfsFeed, GtfsImportCounts } from '../entities/gtfs-feed.entity';

export abstract class GtfsFeedStore {
  /**
   * Troca toda a rede planejada da fonte pelo feed, numa transação só:
   * ou o feed novo entra inteiro, ou o anterior continua valendo.
   */
  abstract replace(sourceId: string, feed: GtfsFeed): Promise<GtfsImportCounts>;
}
