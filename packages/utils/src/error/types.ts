export interface LoomErrorOptions {
  readonly retryable?: boolean;
  readonly cause?: unknown;
}

export interface ErrorDefinition {
  readonly message: string;
  readonly retryable?: boolean;
}

export interface ErrorOverrides {
  readonly message?: string;
  readonly retryable?: boolean;
  readonly cause?: unknown;
}
