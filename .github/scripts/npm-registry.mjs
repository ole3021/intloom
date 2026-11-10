import timers from "node:timers/promises";

export async function lookupRegistry(registry, name, ref, waitForVersion) {
  const url = `${registry}/${encodeURIComponent(name)}/${encodeURIComponent(ref)}`;
  const deadline = Date.now() + 10 * 60_000;
  let backoff = 2000;
  let reason;
  while (Date.now() < deadline) {
    let response;
    let metadata;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(
          Math.max(1, Math.min(30_000, deadline - Date.now())),
        ),
      });
      if (response.ok) metadata = await response.json();
    } catch (error) {
      if (!(error instanceof TypeError) && error.name !== "TimeoutError")
        throw error;
      reason = error.message;
      response = undefined;
    }
    if (response?.ok) {
      if (typeof metadata?.version !== "string")
        throw new Error(
          `Registry returned invalid metadata for ${name}@${ref}`,
        );
      if (!waitForVersion || metadata.version === waitForVersion)
        return metadata;
      reason = `registry serves ${metadata.version}`;
    } else if (response) {
      await response.body?.cancel();
      reason = `HTTP ${response.status}`;
      if (response.status === 404) {
        if (!waitForVersion) return undefined;
      } else if (
        response.status !== 408 &&
        response.status !== 429 &&
        response.status < 500
      ) {
        throw new Error(`Registry lookup for ${name}@${ref} failed: ${reason}`);
      }
    }
    const retryAfter = response?.headers.get("retry-after");
    const retryMs =
      retryAfter && /^\d+$/.test(retryAfter)
        ? Number(retryAfter) * 1000
        : Date.parse(retryAfter ?? "") - Date.now();
    const pause = Math.min(
      deadline - Date.now(),
      Math.max(backoff, retryMs || 0),
    );
    if (pause <= 0) break;
    console.log(
      `Waiting for ${name}@${ref}: ${reason}. Checking again in ${Math.ceil(pause / 1000)}s.`,
    );
    await timers.setTimeout(pause);
    backoff = Math.min(backoff * 2, 30_000);
  }
  throw new Error(
    `Timed out reading ${name}@${ref}${waitForVersion ? ` (expected ${waitForVersion})` : ""} from npm after 10 minutes: ${reason}`,
  );
}
