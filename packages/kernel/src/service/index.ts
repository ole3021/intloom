export {
  startProjectHost,
  type ProjectHost,
  type StartHostOptions,
} from "./host.ts";
export {
  startService,
  stopService,
  type StopServiceResult,
} from "./lifecycle.ts";
export { serviceStatus } from "./control.ts";
export { projectRoot, readConnection, readServiceInfo } from "./discovery.ts";
export * from "./contracts.ts";
export * from "./api-contracts.ts";
