export abstract class CacheHealthPort {
  abstract isUp(): Promise<boolean>;
}
