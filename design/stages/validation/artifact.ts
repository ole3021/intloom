/** Validation 当前明确范围内的验证结果；判断与统计规则见 README.md。 */

import type {
  SACCEPTANCE_ID,
  SCONSTRAINT_ID,
  SDOMAIN_ID,
  SFEATURE_ID,
  SRELATION_ID,
  SREQUIREMENT_ID,
} from "../specification/artifact.js";
import type {
  OAPP_ID,
  OCONCEPT_ID,
  ODECISION_ID,
  OMODULE_ID,
  OPACKAGE_ID,
  ORELATION_ID,
  ORESOURCE_ID,
  OSCENARIO_ID,
} from "../solution/artifact.js";

export type VEVIDENCE_ID = `VEVD-${string}`;
export type VTEST_CODE_ID = `VTCD-${string}`;
export type VFINDING_ID = `VFND-${string}`;

export type CHECK_METHODS =
  | "test" //  执行明确场景，并判断预期结果
  | "runtime_observation" // 观察实际运行行为
  | "static_analysis" // 通过静态分析工具检查
  | "code"; // 阅读代码、配置或结构
export type VALIDATION_RESULT =
  | "verified" // 验证通过
  | "partial" // 部分验证通过
  | "undone" // 未完成
  | "failed"; // 验证不通过

export type EVIDENCE = {
  // evidence 不可复用，每个证据只能用于一个检查
  id: VEVIDENCE_ID;
  method: CHECK_METHODS; // 检查方法类别。
  code_path: {
    path: string; // 项目相对路径，含已删除文件
    lines?: number[]; // 1-based 行号；整文件新增/删除时省略
  }[];
  target_ref:
    | SDOMAIN_ID
    | SFEATURE_ID
    | SREQUIREMENT_ID
    | SCONSTRAINT_ID
    | SRELATION_ID
    | SACCEPTANCE_ID
    | OAPP_ID
    | OPACKAGE_ID
    | OMODULE_ID
    | ORESOURCE_ID
    | ORELATION_ID
    | OSCENARIO_ID
    | OCONCEPT_ID
    | ODECISION_ID;
  result: "fullfill" | "partial" | "violated";
  note?: string; // 这份证据具体证明了什么, 有什么问题。
};

export type TEST_CODE = {
  id: VTEST_CODE_ID;
  path: string; // 项目相对路径，
  lineStart: number; // 1-based 行号；
  lineEnd: number; // 1-based 行号；
};

export type SAME_LOGIC = {
  code_paths: {
    path: string; // 项目相对路径，含已删除文件
    lines?: number[]; // 1-based 行号；整文件新增/删除时省略
  }[];
  reason: string;
  needRefactor: boolean;
};

export type DEAD_CODE = {
  code_paths: {
    path: string; // 项目相对路径，含已删除文件
    lines?: number[]; // 1-based 行号；整文件新增/删除时省略
  }[];
  reason: string;
  needRefactor: boolean;
};

export interface ValidationArtifact {
  scope: {
    specification: {
      requirement_refs: SREQUIREMENT_ID[];
      acceptance_refs: SACCEPTANCE_ID[];
      constraint_refs: SCONSTRAINT_ID[];
      relation_refs: SRELATION_ID[];
    };
    solution: {
      scenario_refs: OSCENARIO_ID[];
      concept_refs: OCONCEPT_ID[];
      decision_refs: ODECISION_ID[];
    }[];
    implementation: {
      test_code_refs: TEST_CODE[];
    }[];
  };

  specification_checks: {
    // 实现满足了哪些需求，哪些不满足，哪些尚未充分验证
    target:
      | {
          type: "domain";
          ref: SDOMAIN_ID;
        }
      | {
          type: "feature";
          ref: SFEATURE_ID;
        }
      | {
          type: "requirement";
          ref: SREQUIREMENT_ID;
        }
      | {
          type: "constraint";
          ref: SCONSTRAINT_ID;
        }
      | {
          type: "relation";
          ref: SRELATION_ID;
        }
      | {
          type: "acceptance";
          ref: SACCEPTANCE_ID;
        };

    evidences: EVIDENCE[];

    result: {
      status: VALIDATION_RESULT;
      reason: string;
    };
  }[];

  solution_checks: {
    // 实现是否遵守设计职责、接口、协作和共同规则，具体偏离在哪里？
    target:
      | {
          type: "app";
          ref: OAPP_ID;
        }
      | {
          type: "package";
          ref: OPACKAGE_ID;
        }
      | {
          type: "module";
          ref: OMODULE_ID;
        }
      | {
          type: "resource";
          ref: ORESOURCE_ID;
        }
      | {
          type: "relation";
          ref: ORELATION_ID;
        }
      | {
          type: "scenario";
          ref: OSCENARIO_ID;
        }
      | {
          type: "concept";
          ref: OCONCEPT_ID;
        }
      | {
          type: "decision";
          ref: ODECISION_ID;
        };

    evidences: EVIDENCE[];

    result: {
      status: VALIDATION_RESULT;
      reason: string;
    };
  }[];

  tests_checks: {
    test_code_ref: TEST_CODE;
    ttarget_refs: (
      | SREQUIREMENT_ID
      | SCONSTRAINT_ID
      | SRELATION_ID
      | SACCEPTANCE_ID
      | OSCENARIO_ID
      | OCONCEPT_ID
      | ODECISION_ID
    )[];
    status: "passed" | "failed" | "not_run";
  }[];

  code_issues: (SAME_LOGIC | DEAD_CODE)[];

  results: {
    specification: {
      type: "requirement" | "constraint" | "relation" | "acceptance";
      total_count: number;
      verified_count: number;
      partial_count: number;
      undone_count: number;
      failed_count: number;
    }[];
    solution_module: {
      type: "scenario" | "concept" | "decision";
      total_count: number;
      verified_count: number;
      partial_count: number;
      undone_count: number;
      failed_count: number;
    };
  };

  findings: {
    id: VFINDING_ID;
    status: "confirmed" | "suspected";
    description: string;
    impact?: string;
    locations: {
      path: string; // 项目相对路径，
      lineStart: number; // 1-based 行号；
      lineEnd: number; // 1-based 行号；
    }[];
    severity_level: "high" | "medium" | "low";
  }[];
}
