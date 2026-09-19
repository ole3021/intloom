/** Solution 最终设计变化及真实交互的历史记录。 */

import type { SOLUTION_STRUCTURE_REFS } from "./artifact.js";
import type { OINTERFACE_ID, ORELATION_ID, OSCENARIO_ID, OCONCEPT_ID, ODECISION_ID, ORISK_ID, ODIAGRAM_ID } from "./artifact.js";
import type { PATCH_STRUCTURE, RECORD_FEEDBACK_STRUCTURE, RECORD_QUESTION_STRUCTURE, RUN_ID } from "../const.type.js";
import type { SPEC_CHANGE_REFS } from "../specification/record.js";

export type SOLUTION_CHANGE_REFS =
  | OINTERFACE_ID
  | ORELATION_ID
  | OSCENARIO_ID
  | OCONCEPT_ID
  | ODECISION_ID;

export interface SolutionRecord {
  id: RUN_ID;
  origin_refs: (SPEC_CHANGE_REFS | SOLUTION_CHANGE_REFS)[]; // 本轮变动涉及的来源对象。

  changes: {
    target_ref: SOLUTION_STRUCTURE_REFS | SOLUTION_CHANGE_REFS | ORISK_ID | ODIAGRAM_ID;
    reason: string; // 修改依据及需要下游关注的影响。
    patch: PATCH_STRUCTURE[];
  }[];

  questions: RECORD_QUESTION_STRUCTURE[];
  feedbacks: RECORD_FEEDBACK_STRUCTURE[]; // 本轮已处理的用户反馈 以及 check 记录。
}
