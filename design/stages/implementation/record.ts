/** Implementation 本轮代码改动和已处理反馈的历史记录。 */

import type {
  RECORD_FEEDBACK_STRUCTURE,
  RUN_ID,
} from "../const.type.js";
import type { SOLUTION_CHANGE_REFS } from "../solution/record.js";
import type { SPEC_CHANGE_REFS } from "../specification/record.js";

export interface ImplementationRecord {
  id: RUN_ID;

  changes: {
    paths: {
      path: string; // 项目相对路径，含已删除文件
      lines?: number[]; // 1-based 行号；整文件新增/删除时省略
    }[]; // 项目相对路径，包含已删除文件。
    description: string;
    origin_refs: (SPEC_CHANGE_REFS | SOLUTION_CHANGE_REFS)[]; // 本项代码改动涉及的来源对象。
  }[];

  feedbacks: RECORD_FEEDBACK_STRUCTURE[]; // 本轮已处理的用户反馈 以及 check 记录。
}
