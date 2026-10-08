import {
  defineErrorCatalog,
  type ErrorDefinition,
  type LoomError,
} from "@intloom/utils";

export const KERNEL_ERROR_DEFINITIONS = {
  INVALID_REQUEST: {
    message: "The request is invalid.",
    retryable: false,
  },
  NOT_FOUND: {
    message: "The requested resource was not found.",
    retryable: false,
  },
  CONFLICT: {
    message: "The request conflicts with the current state.",
    retryable: false,
  },
  BUSY: {
    message: "The requested resource is busy.",
    retryable: true,
  },
  STORAGE_ERROR: {
    message: "The storage operation failed.",
    retryable: false,
  },
  KERNEL_UNAVAILABLE: {
    message: "The kernel is unavailable.",
    retryable: true,
  },
} as const satisfies Readonly<Record<string, ErrorDefinition>>;

export type KernelErrorCode = keyof typeof KERNEL_ERROR_DEFINITIONS;

export type KernelError = LoomError<KernelErrorCode>;

export const KERNEL_ERRORS = defineErrorCatalog(KERNEL_ERROR_DEFINITIONS);
