/** Relógio do planejador (hora pedida no passado, data de hoje para a validade do GTFS). */
export abstract class Clock {
  abstract now(): Date;
}
