// Common
export type RUN_ID = `RUN-${string}`; // 运行；example: RUN-Ab3_xY7
export type QUESTION_ID = `QST-${number}`; // 问答；example: QST-1
export type OPTION_ID = `${QUESTION_ID}:${string}`; // 本题选项；example: QST-1:A

export type LIFE_CYCLE_STATUS = "active" | "retired"; // 有效 / 已弃用

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type PATCH_STRUCTURE =
  | {
      op: "test" | "add" | "replace";
      path: "" | `/${string}`; // 相对目标对象；嵌套内容在所属对象内修改。
      value: JsonValue;
    }
  | {
      op: "remove";
      path: "" | `/${string}`;
      value?: never;
    };

export type STATE_QUESTION_STRUCTURE = {
  id: QUESTION_ID;
  question: string;
  description?: string;
  options?: {
    id: OPTION_ID;
    label: string;
    description?: string;
  }[];
  answer?: string;
  isBlock: boolean; // 是否仍阻塞本轮设计成立。
  isSolved: boolean; // 本轮是否已处理完成。
};
export type RECORD_QUESTION_STRUCTURE = {
  id: QUESTION_ID;
  question: string;
  description?: string;
  answer: string;
};

export type STATE_FEEDBACK_STRUCTURE = {
  source: "user" | "check";
  content: string;
};

export type RECORD_FEEDBACK_STRUCTURE = {
  source: "user" | "check";
  content: string;
};
