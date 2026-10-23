export function observing() {
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  return {
    controller,
    close() {
      controller.abort();
      process.off("SIGINT", abort);
      process.off("SIGTERM", abort);
    },
  };
}
