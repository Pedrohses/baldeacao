export interface GtfsImportState {
  sha256: string;
  importedAt: string;
}

export abstract class GtfsImportStateStore {
  abstract get(sourceId: string): Promise<GtfsImportState | null>;
  abstract save(sourceId: string, state: GtfsImportState): Promise<void>;
}
