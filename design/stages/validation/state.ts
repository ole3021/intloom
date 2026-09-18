/** Validation 在评估、记录检查和结果生成之间共享的工作状态。 */

import type {
  RUN_ID
} from "../const.type.js";
import type { ValidationArtifact } from "./artifact.js";

export interface ValidationState {
  id: RUN_ID;

  scope: ValidationArtifact["scope"];

  specification_checks: ValidationArtifact["specification_checks"];
  solution_checks: ValidationArtifact["solution_checks"];
  tests_checks: ValidationArtifact["tests_checks"];
  code_issues: ValidationArtifact["code_issues"];

  findings: ValidationArtifact["findings"];
}
