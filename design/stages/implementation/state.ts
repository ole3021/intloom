/** Implementation 在实现、检查和修正之间共享的工作状态。 */

import type { RUN_ID, STATE_FEEDBACK_STRUCTURE } from "../const.type.js";
import type { ImplementationRecord } from "./record.js";

export interface ImplementationState {
  id: RUN_ID;
  changes: ImplementationRecord["changes"];

  feedbacks: STATE_FEEDBACK_STRUCTURE[];
}
