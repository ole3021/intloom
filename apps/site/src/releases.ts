import { repositoryUrl } from "./site.ts";

export const latestReleaseUrl = `${repositoryUrl}/releases/latest`;
export const cliReleasesUrl = `${repositoryUrl}/releases?q=%40intloom%2Fcli%40`;
export const studioTargets = [
  {
    id: "macos-arm64",
    label: "macOS · Apple silicon",
    suffix: "macos-arm64.dmg",
  },
  { id: "macos-x64", label: "macOS · Intel", suffix: "macos-x64.dmg" },
  { id: "windows-x64", label: "Windows · x64", suffix: "win-x64.zip" },
  { id: "linux-x64", label: "Linux · x64", suffix: "linux-x64.tar.gz" },
] as const;

interface Release {
  version: string;
  url: string;
}
export interface WebsiteReleases {
  cli?: Release;
  studio?: Release & {
    downloads?: Partial<
      Record<(typeof studioTargets)[number]["id"], string | null>
    >;
  };
}

export async function readReleases(
  signal: AbortSignal,
): Promise<WebsiteReleases> {
  const response = await fetch("/api/releases", { signal });
  if (!response.ok) throw new Error(`Site releases: HTTP ${response.status}`);
  return response.json();
}
