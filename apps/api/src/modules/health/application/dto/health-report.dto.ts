export type DependencyStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'error';
  checks: {
    postgres: DependencyStatus;
    redis: DependencyStatus;
  };
}
