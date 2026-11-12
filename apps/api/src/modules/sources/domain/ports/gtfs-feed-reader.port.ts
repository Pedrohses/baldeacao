import type { RawGtfsFeed } from '../entities/gtfs-feed.entity';

export abstract class GtfsFeedReader {
  /**
   * Abre o feed em `location` (pasta com os .txt). Lança InvalidGtfsFeedError se faltar
   * arquivo obrigatório; erros de linha aparecem durante a leitura de cada arquivo.
   */
  abstract open(location: string): Promise<RawGtfsFeed>;
}
