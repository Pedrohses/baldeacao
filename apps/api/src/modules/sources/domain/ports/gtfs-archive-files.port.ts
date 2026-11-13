import type { GtfsFrequency, GtfsShape } from '../entities/gtfs-feed.entity';

/** GTFS aberto numa pasta; `release` apaga o que foi extraído (pasta de entrada fica). */
export interface UnpackedGtfs {
  dir: string;
  release(): Promise<void>;
}

/** Arquivos que o zip de saída troca; os demais vão como vieram. */
export interface GtfsArchiveOverrides {
  shapes: GtfsShape[];
  frequencies: Array<GtfsFrequency & { exactTimes: boolean }>;
}

export abstract class GtfsArchiveFiles {
  /** Abre um zip GTFS (extrai numa pasta temporária) ou usa a pasta indicada no lugar. */
  abstract unpack(location: string): Promise<UnpackedGtfs>;

  /**
   * Grava em `output` um zip com os .txt de `sourceDir`, trocando shapes.txt e
   * frequencies.txt pelos de `overrides`. Devolve o tamanho do zip em bytes.
   */
  abstract pack(
    sourceDir: string,
    output: string,
    overrides: GtfsArchiveOverrides,
  ): Promise<number>;
}
