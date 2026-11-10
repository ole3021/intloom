import { AsyncLocalStorage } from "node:async_hooks";

interface ExecutionScope {
  runId: string;
  loomId: string;
  componentId?: string;
  secrets: readonly string[];
}
const executionScope = new AsyncLocalStorage<ExecutionScope>();

export function withExecutionScope<T>(
  scope: ExecutionScope,
  action: () => T,
): T {
  return executionScope.run(scope, action);
}

export function redactDiagnostic(text: string, secrets: readonly string[]) {
  for (const secret of secrets)
    if (secret) text = text.replaceAll(secret, "[redacted]");
  return text.replace(
    /((?:authorization|api[-_]?key|token|password|secret)["']?\s*[:=]\s*["']?)(?:Bearer\s+)?[^\s,;"'}]+/gi,
    "$1[redacted]",
  );
}

export function redactDiagnosticValue<T>(
  value: T,
  secrets: readonly string[],
): T {
  return JSON.parse(
    JSON.stringify(value, (key, item: unknown) =>
      /^(?:authorization|api[-_]?key|token|password|secret|credential)$/i.test(
        key,
      )
        ? "[redacted]"
        : typeof item === "string"
          ? redactDiagnostic(item, secrets)
          : item,
    ),
  ) as T;
}

/** @internal Attach the actual async execution owner to local console diagnostics. */
export function currentExecutionLog(message: string) {
  const scope = executionScope.getStore();
  return scope
    ? {
        runId: scope.runId,
        loomId: scope.loomId,
        ...(scope.componentId && { componentId: scope.componentId }),
        message: redactDiagnostic(message, scope.secrets),
      }
    : undefined;
}
