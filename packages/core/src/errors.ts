export type ThrexusErrorCode =
  | 'APP_STATE'
  | 'CLEANUP_STATE'
  | 'DUPLICATE_FEATURE'
  | 'DUPLICATE_SERVICE'
  | 'FEATURE_DEPENDENCY_CYCLE'
  | 'FEATURE_SETUP'
  | 'MISSING_SERVICE'
  | 'SCOPE_STATE'
  | 'SERVICE_CONTRACT';

export class ThrexusError extends Error {
  readonly code: ThrexusErrorCode;

  constructor(
    code: ThrexusErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ThrexusError';
    this.code = code;
  }
}

export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
