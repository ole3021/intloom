export async function githubReleaseExists(
  tag: string,
  run: (args: string[]) => Promise<{ stdout: string }>,
): Promise<boolean> {
  try {
    await run([
      "api",
      "--include",
      `repos/{owner}/{repo}/releases/tags/${encodeURIComponent(tag)}`,
    ]);
    return true;
  } catch (cause) {
    // Only an explicit HTTP 404 means absent; authentication and transport failures propagate.
    if (
      cause instanceof Error &&
      "stdout" in cause &&
      /^HTTP\/[\d.]+ 404(?:\s|$)/m.test(String(cause.stdout))
    )
      return false;
    throw cause;
  }
}
