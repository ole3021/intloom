/**
 * Specification 历史记录结构；Changes 契约与内容筛选规则见 README.md。
 */

import type {
  PATCH_STRUCTURE,
  RECORD_FEEDBACK_STRUCTURE,
  RECORD_QUESTION_STRUCTURE,
  RUN_ID,
} from "../const.type.js";
import type {
  SACCEPTANCE_ID,
  SCONSTRAINT_ID,
  SDEFERRED_ID,
  SDOMAIN_ID,
  SFEATURE_ID,
  SRELATION_ID,
  SREQUIREMENT_ID,
} from "./artifact.js";

export type SPEC_CHANGE_REFS =
  | SDOMAIN_ID
  | SFEATURE_ID
  | SREQUIREMENT_ID
  | SCONSTRAINT_ID;

export type SOLUTION_CHANGE_SUB_REFS =
  | SACCEPTANCE_ID
  | SRELATION_ID
  | SDEFERRED_ID;

export interface SpecificationRecord {
  id: RUN_ID;
  intent: string; // 本轮原始 Intent。
  origin_refs: (SPEC_CHANGE_REFS | SOLUTION_CHANGE_SUB_REFS)[]; // 本轮变动涉及的来源对象。

  changes: {
    target_ref: SPEC_CHANGE_REFS | SOLUTION_CHANGE_SUB_REFS;
    reason: string; // 修改依据及需要下游关注的影响。
    patch: PATCH_STRUCTURE[];
  }[];

  questions: RECORD_QUESTION_STRUCTURE[];
  feedbacks: RECORD_FEEDBACK_STRUCTURE[]; // 本轮已处理的用户反馈 以及 check 记录。
}
