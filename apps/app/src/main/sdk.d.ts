// Electrobun 1.x ships TypeScript sources. Build declarations for the public APIs
// we consume separately so workspace typechecking does not check vendor FFI code.
export { BrowserWindow } from "../../.sdk/bun/core/BrowserWindow";
export { BrowserView } from "../../.sdk/bun/core/BrowserView";
export * as Utils from "../../.sdk/bun/core/Utils";
export * as ApplicationMenu from "../../.sdk/bun/core/ApplicationMenu";
export { Updater } from "../../.sdk/bun/core/Updater";
import events from "../../.sdk/bun/events/eventEmitter";
declare const Electrobun: { events: typeof events };
export default Electrobun;
