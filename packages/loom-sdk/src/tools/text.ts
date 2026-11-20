const encodingBrand = Symbol.for("@intloom/TextEncodingError");

export class TextEncodingError extends Error {
  readonly [encodingBrand] = true;
  override readonly name = "TextEncodingError";
  static [Symbol.hasInstance](error: unknown): boolean {
    return (
      error instanceof Error &&
      encodingBrand in error &&
      error[encodingBrand] === true
    );
  }
}

export function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch (cause) {
    throw new TextEncodingError("Expected valid UTF-8 text", { cause });
  }
}

export function encodeUtf8(text: string): Uint8Array {
  if (/[\uD800-\uDFFF]/u.test(text)) {
    throw new TextEncodingError("Text contains an unpaired surrogate");
  }
  return new TextEncoder().encode(text);
}
