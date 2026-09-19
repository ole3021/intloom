/**
 * Specification 工作数据结构；分析、问答与确认规则见 README.md。
 */

import type {
  STATE_QUESTION_STRUCTURE,
  STATE_FEEDBACK_STRUCTURE,
  RUN_ID,
} from "../const.type.js";
import type { SpecificationRecord } from "./record.js";

export interface SpecificationState {
  id: RUN_ID;
  intent: string; // 本轮原始 Intent。
  changes: SpecificationRecord["changes"];

  questions: STATE_QUESTION_STRUCTURE[];
  feedbacks: STATE_FEEDBACK_STRUCTURE[];
}
