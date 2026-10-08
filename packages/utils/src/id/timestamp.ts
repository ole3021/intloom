export function formatIdTimestamp(date = new Date()): string {
  return date.toISOString().replaceAll(/[-:.]/gu, "");
}
