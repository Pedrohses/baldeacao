export abstract class GtfsArchiveDownloader {
  /** Baixa o zip em `url`. Lança SourceUnavailableError se esgotar as tentativas. */
  abstract download(url: string): Promise<Uint8Array>;
}
