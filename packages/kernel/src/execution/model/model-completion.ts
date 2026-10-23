const finishReasons = {
  stop: "stop",
  length: "length",
  content_filter: "content-filter",
  function_call: "tool-calls",
  tool_calls: "tool-calls",
} as const;

function own(value: unknown, key: PropertyKey): unknown {
  return value !== null && typeof value === "object"
    ? Object.getOwnPropertyDescriptor(value, key)?.value
    : undefined;
}

function classify(reason: unknown) {
  if (reason === undefined || reason === null) return "absent";
  return typeof reason === "string" && Object.hasOwn(finishReasons, reason)
    ? (reason as keyof typeof finishReasons)
    : "unrecognized";
}

/** Retains only completion metadata; raw chunks and unknown strings never escape. */
export function modelCompletion() {
  let rawChunks = 0;
  let chatChunks = 0;
  let finishMarkers = 0;
  let upstreamReason: ReturnType<typeof classify> = "absent";
  let finishParts = 0;
  let adapterRawReason: ReturnType<typeof classify> = "absent";
  return {
    raw(value: unknown) {
      rawChunks++;
      const choices = own(value, "choices");
      if (!Array.isArray(choices)) return;
      chatChunks++;
      // The installed OpenAI-compatible adapter consumes the first choice.
      const reason = own(own(choices, "0"), "finish_reason");
      if (reason === undefined || reason === null) return;
      finishMarkers++;
      upstreamReason = classify(reason);
    },
    finish(reason: unknown) {
      finishParts++;
      adapterRawReason = classify(own(reason, "raw"));
    },
    summary(providerFinishReason: string) {
      const mapping =
        chatChunks === 0
          ? "unavailable"
          : upstreamReason === "absent"
            ? "missing"
            : upstreamReason === "unrecognized"
              ? "unrecognized"
              : finishReasons[upstreamReason] === providerFinishReason
                ? "matched"
                : "mismatch";
      return {
        rawChunks,
        chatChunks,
        finishMarkers,
        upstreamReason,
        finishParts,
        adapterRawReason,
        mapping,
      };
    },
  };
}
