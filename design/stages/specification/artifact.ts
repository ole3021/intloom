/**
 * Specification 完整需求结构；需求模型与维护规则见 README.md。
 */

import type {
  RUN_ID,
  LIFE_CYCLE_STATUS,
} from "../const.type.js";

// Specification Artifact
export type SDOMAIN_ID = `SDOM-${string}`; // 业务领域；example: SDOM-order
export type SFEATURE_ID = `SFEA-${string}`; // 功能；example: SFEA-csv-export
export type SREQUIREMENT_ID = `SREQ-${string}`; // 功能要求；example: SREQ-Ab3_xY7
export type SACCEPTANCE_ID = `SACC-${string}`; // 验收条件；example: SACC-login-success
export type SCONSTRAINT_ID = `SCON-${string}`; // 约束；example: SCON-Ab3_xY7
export type SDEFERRED_ID = `SDEF-${string}`; // 待决问题；example: SDEF-Ab3_xY7
export type SRELATION_ID = `SREL-${string}`; // 需求关系；example: SREL-Ab3_xY7

export type RELATION_TYPE =
  | "depends_on" // source 依赖 target；source 的成立以 target 的条件、结果或业务事实为前提。
  | "conflicts_with" // source 与 target 在相同适用条件下不能同时成立；语义对称。
  | "refines"; // source 对 target 进行更具体的限定、补充或细化。

export interface SpecificationArtifact {
  domains: {
    id: SDOMAIN_ID;
    responsibility: string; // 领域的业务责任边界。
    status: LIFE_CYCLE_STATUS;
  }[];
  features: {
    id: SFEATURE_ID;
    responsibility: string; // 功能目标与职责。
    status: LIFE_CYCLE_STATUS;
    domain_ref: SDOMAIN_ID; // 所属领域，指向 domains[].id。
  }[];
  requirements: {
    id: SREQUIREMENT_ID;
    status: LIFE_CYCLE_STATUS;
    description: string; // 功能行为要求，包含条件、结果与验收含义。
    acceptances: {
      id: SACCEPTANCE_ID;
      requirement_ref: SREQUIREMENT_ID; // 所属 Requirement，与外层对象 ID 一致。
      description: string;
    }[];
    feature_ref: SFEATURE_ID; // 所属功能，指向 features[].id。
    record_refs: RUN_ID[]; // 需求来源记录。
  }[];
  constraints: {
    id: SCONSTRAINT_ID;
    status: LIFE_CYCLE_STATUS;
    description: string; // 约束内容及其适用范围。
    record_refs: RUN_ID[]; // 支撑本条要求的需求记录。
  }[];
  relations: {
    id: SRELATION_ID;
    status: LIFE_CYCLE_STATUS;
    source_req_ref: SREQUIREMENT_ID;
    target_req_ref: SREQUIREMENT_ID;
    type: RELATION_TYPE; // 依赖关系类型。
    description: string; // 关系的成立条件及业务影响。
    record_refs: RUN_ID[]; // 支撑本条依赖的需求记录。
  }[];
  deferreds: {
    id: SDEFERRED_ID;
    status: LIFE_CYCLE_STATUS;
    question: string; // 可暂缓的待决问题。
    description: string; // 问题背景与详情。
    impact?: string; // 对业务的影响。
    impact_refs: (SFEATURE_ID | SREQUIREMENT_ID | SCONSTRAINT_ID)[]; // 受影响的功能、要求或约束，可混合引用。
    record_refs: RUN_ID[]; // 支撑问题提出与保留的需求记录。
  }[];
}
