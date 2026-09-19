/** Solution 本轮分析、问答、确认和修正的工作状态。 */

import type {
  RUN_ID,
  STATE_FEEDBACK_STRUCTURE,
  STATE_QUESTION_STRUCTURE,
} from "../const.type.js";
import type { SolutionRecord } from "./record.js";

export interface SolutionState {
  id: RUN_ID;
  changes: SolutionRecord["changes"]; // 尚未应用、可继续修订的累计修改。

  questions: STATE_QUESTION_STRUCTURE[];
  feedbacks: STATE_FEEDBACK_STRUCTURE[];
}
