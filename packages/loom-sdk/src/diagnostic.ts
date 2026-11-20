export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly path?: readonly (string | number)[];
  readonly line?: number;
  readonly column?: number;
}
