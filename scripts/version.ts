export function validateVersion(version: string): void {
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      version,
    ) ||
    (version.includes("-") &&
      version
        .slice(version.indexOf("-") + 1)
        .split(".")
        .some((part) => /^0\d+$/.test(part))) ||
    version
      .split("-")[0]
      ?.split(".")
      .some((part) => !Number.isSafeInteger(Number(part)))
  )
    throw new Error(`Invalid release version: ${version}`);
}

export function validateRelease(
  version: string,
  tag: string,
  ref: string,
): void {
  validateVersion(version);
  if (version === "0.0.0" || ref !== "refs/heads/main")
    throw new Error(
      "Publish requires the main branch; 0.0.0 is development-only.",
    );
  if ((version.includes("-") ? "next" : "latest") !== tag)
    throw new Error("Prereleases use next; stable releases use latest.");
}

export function releaseChannel(version: string): "next" | "latest" {
  validateVersion(version);
  return version.includes("-") ? "next" : "latest";
}

export function compareVersions(left: string, right: string): number {
  validateVersion(left);
  validateVersion(right);
  const parts = (value: string) => {
    const index = value.indexOf("-");
    return {
      core: (index < 0 ? value : value.slice(0, index)).split(".").map(Number),
      prerelease: index < 0 ? [] : value.slice(index + 1).split("."),
    };
  };
  const a = parts(left);
  const b = parts(right);
  for (let i = 0; i < 3; i++) {
    const difference = (a.core[i] ?? 0) - (b.core[i] ?? 0);
    if (difference) return Math.sign(difference);
  }
  if (!a.prerelease.length || !b.prerelease.length)
    return Number(!a.prerelease.length) - Number(!b.prerelease.length);
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    const x = a.prerelease[i];
    const y = b.prerelease[i];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const numericX = /^\d+$/.test(x);
    const numericY = /^\d+$/.test(y);
    if (numericX && numericY) return BigInt(x) < BigInt(y) ? -1 : 1;
    if (numericX !== numericY) return numericX ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
