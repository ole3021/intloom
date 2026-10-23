import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface EvidenceEvent {
  sequence: number;
  at: string;
  kind: string;
  data: unknown;
}

export function redact(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === "string") {
    let text = value;
    for (const secret of secrets
      .filter(Boolean)
      .sort((a, b) => b.length - a.length))
      text = text.replaceAll(secret, "[REDACTED]");
    return text.replace(/Bearer\s+[A-Za-z0-9._~-]+/giu, "Bearer [REDACTED]");
  }
  if (Array.isArray(value)) return value.map((part) => redact(part, secrets));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, part]) => [
        key,
        /^(?:ownerToken|token|apiKey|authorization|cookie|password)$/iu.test(
          key,
        )
          ? "[REDACTED]"
          : redact(part, secrets),
      ]),
    );
  return value;
}
export class Evidence {
  private sequence = 0;
  private queue = Promise.resolve();
  readonly secrets: string[] = [];
  readonly directory: string;
  private readonly observer: ((event: EvidenceEvent) => void) | undefined;
  constructor(directory: string, observer?: (event: EvidenceEvent) => void) {
    this.directory = directory;
    this.observer = observer;
  }
  protect(value: unknown): void {
    if (typeof value === "string" && /^[[{]/u.test(value.trim())) {
      try {
        this.protect(JSON.parse(value));
      } catch {
        /* Plain text may start with a JSON delimiter. */
      }
    } else if (Array.isArray(value)) {
      for (const part of value) this.protect(part);
    } else if (value && typeof value === "object")
      for (const [key, part] of Object.entries(value)) {
        if (
          /^(?:ownerToken|token|apiKey|authorization|cookie|password)$/iu.test(
            key,
          ) &&
          typeof part === "string"
        )
          this.secrets.push(part);
        else this.protect(part);
      }
  }
  async prepare() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
  }
  event(kind: string, data: unknown) {
    this.protect(data);
    const event = {
      sequence: ++this.sequence,
      at: new Date().toISOString(),
      kind,
      data: redact(data, this.secrets),
    };
    const write = this.queue.then(async () => {
      await appendFile(
        join(this.directory, "actions.jsonl"),
        `${JSON.stringify(event)}\n`,
        { mode: 0o600 },
      );
      this.observer?.(event);
    });
    this.queue = write;
    return write;
  }
  async save(name: string, data: unknown) {
    await writeFile(
      join(this.directory, name),
      `${JSON.stringify(redact(data, this.secrets), null, 2)}\n`,
      { mode: 0o600, flag: "wx" },
    );
  }
  async flush() {
    await this.queue;
  }
}
