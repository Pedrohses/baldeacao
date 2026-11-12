/** Raw shapes returned by the Olho Vivo API (v2.1). Only what we use. */
export interface OlhoVivoRawVehicle {
  /** Vehicle prefix. */
  p: number;
  /** Accessible. */
  a: boolean;
  /** UTC timestamp of the reading. */
  ta: string;
  py: number;
  px: number;
}

export interface OlhoVivoRawLinePositions {
  /** Line sign, e.g. "8000-10". */
  c: string;
  /** Line code. */
  cl: number;
  /** Direction (1 or 2). */
  sl: number;
  lt0: string;
  lt1: string;
  qv: number;
  vs: OlhoVivoRawVehicle[];
}

export interface OlhoVivoRawPositions {
  /** Reference time (HH:mm). */
  hr: string;
  l: OlhoVivoRawLinePositions[];
}
