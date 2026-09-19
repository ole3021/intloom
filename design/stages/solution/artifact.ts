import type { LIFE_CYCLE_STATUS, RUN_ID } from "../const.type.js";
import type {
  SCONSTRAINT_ID,
  SREQUIREMENT_ID,
} from "../specification/artifact.js";

export type OAPP_ID = `OAPP-${string}`; // example: OAPP-web
export type OPACKAGE_ID = `OPKG-${string}`; // example: OPKG-@project/shared
export type OSCENARIO_ID = `OSCN-${string}`; // example: OSCN-create-todo
export type OPARTICIPANT_ID = `OPAR-${string}`; // example: OPAR-Ab3_xY7
export type OSCENARIO_STEP_ID = `${OSCENARIO_ID}-STEP-${number}`; // example: OSCN-create-todo-STEP-1
export type OMODULE_ID = `OMOD-${string}`; // example: OMOD-todo-editor
export type OINTERFACE_ID = `${OMODULE_ID}-INT-${string}`; // example: OMOD-todo-editor-INT-Ab3_xY7
export type ORESOURCE_ID = `ORES-${string}`; // example: ORES-database
export type OCONCEPT_ID = `OCON-${string}`; // example: OCON-Ab3_xY7
export type ORELATION_ID = `OREL-${string}`; // example: OREL-Ab3_xY7
export type OCONCEPT_RULE_ID = `${OCONCEPT_ID}-RULE-${number}`; // example: OCON-Ab3_xY7-RULE-1
export type ODECISION_ID = `ODEC-${string}`; // example: ODEC-Ab3_xY7
export type ORISK_ID = `ORISK-${string}`; // example: ORISK-Ab3_xY7
export type ODIAGRAM_ID = `ODIAG-${string}`;

export type SOLUTION_STRUCTURE_REFS =
  | OAPP_ID
  | OPACKAGE_ID
  | OMODULE_ID
  | ORESOURCE_ID;

export type APP_TYPE =
  | "web" // 网页应用
  | "mobile" // 移动应用
  | "service" // 服务应用
  | "worker"; // 后台任务或异步处理进程
export type TECHNOLOGY_TYPE =
  | "platform" //目标运行平台或托管环境
  | "language" // 实现语言
  | "runtime" // 载应用执行的运行时环境
  | "framework"; // 应用结构或开发模型有决定性影响的框架
export type INTERFACE_TYPE =
  | "call" // 对外提供可被主动调用的能力,调用方发起请求并获得处理结果, 不限定具体协议和实现方式。
  | "event"; // 对外发布异步事件或消息,用于通知而非同步请求
export type ACTION_TYPE =
  | "call" // 调用另一个对象的能力。
  | "return" // 返回之前调用的结果。
  | "event" // 异步事件,比如通知或消息。
  | "read" // 读取某个资源。
  | "write" // 写入某个资源。
  | "start" // 启动某个运行的进程或组件。
  | "stop" // 停止某个运行的进程或组件。
  | "activity"; // 构件内部自己做的事情,不强调和其他构件的交互。
export type RESOURCE_TYPE =
  | "database" // 持久化数据存储能力。
  | "message_bus" // 异步消息、事件发布和消费能力。
  | "cache" // 临时或高性能数据访问能力。
  | "object_storage" // 文件或对象持久化能力。
  | "external_service" // 系统边界之外依赖的外部服务能力。
  | "other";
export type ORELATION_TYPE =
  | "depends_on" // source 在架构上依赖 target。
  | "calls" // source 可以同步调用 target 提供的能力。（运行时交互）
  | "uses" // source 使用 target 提供的共享能力。（静态使用/复用）
  | "reads" // source 从 target Resource 读取数据。
  | "writes" // source 向 target Resource 写入数据。
  | "publishes" // source 向 target 发布事件或消息。
  | "subscribes"; // source 订阅 target 提供的事件或消息。
export type DIAGRAM_TYPE =
  | "overview" // 项目总体架构图，表达主要 App、Package、Resource 及关键关系。
  | "component" // 单个 App / Service 的内部结构图，重点表达 Module、Resource 和关系。
  | "scenario" // 对应 Scenario 的运行时交互流程图。
  | "state"; // 核心业务或技术对象的状态 / 生命周期转换图。
export type OUTCOME_TYPE =
  | "response" // 调用方直接拿到的同步结果,比如返回登录后的会话或数据。
  | "state" // 场景结束后系统中必须成立的状态,比如会话被持久化或订单状态变为已支付。
  | "event" // 应该发出的异步事件或消息。
  | "external_effect"; // 对系统边界之外产生的可观察副作用,比如向外部支付方提交扣款请求。
export type PARTICIPANT_TYPE =
  | "module"
  | "resource"
  | "actor"
  | "external_system";

export interface SolutionArtifact {
  // architecture: {}[],
  structure: {
    apps: {
      id: OAPP_ID;
      name: string;
      type: APP_TYPE;
      description: string; // 应用的职责和边界
      technologies?: {
        // 只包含架构上重要的技术,也就是换掉它,solution 必须重新设计才放,其它实现细节一律不放
        type: TECHNOLOGY_TYPE;
        name: string;
        version?: string; // 没有版本不约束
      }[];
      modules: {
        id: OMODULE_ID;
        parent_ref: OAPP_ID; // 所属 App，与外层对象 ID 一致。
        status: LIFE_CYCLE_STATUS;
        name: string;
        description: string; // 模块的职责和边界
        requirement_refs?: SREQUIREMENT_ID[];
        constraint_refs?: SCONSTRAINT_ID[];
        interfaces?: {
          id: OINTERFACE_ID;
          name: string;
          type: INTERFACE_TYPE;
          description: string;
        }[];
      }[];
    }[];
    packages: {
      id: OPACKAGE_ID;
      name: string;
      description: string; // 代码组织和分发边界
      modules: {
        id: OMODULE_ID;
        parent_ref: OPACKAGE_ID; // 所属 Package，与外层对象 ID 一致。
        status: LIFE_CYCLE_STATUS;
        name: string;
        description: string; // Package 内需要独立表达的模块职责和边界。
        requirement_refs?: SREQUIREMENT_ID[];
        constraint_refs?: SCONSTRAINT_ID[];
        interfaces?: {
          id: OINTERFACE_ID;
          name: string;
          type: INTERFACE_TYPE;
          description: string;
        }[];
      }[];
    }[];
    resources: {
      id: ORESOURCE_ID;
      name: string;
      type: RESOURCE_TYPE;
      description: string; // Resource 在架构中的职责和用途。
      capabilities?: {
        // 只有会影响 Solution 的关键能力才记录。
        name: string;
        description?: string;
      }[];
      requirement_refs?: SREQUIREMENT_ID[];
      constraint_refs?: SCONSTRAINT_ID[];
    }[]; // 逻辑资源，架构能力。不绑定厂商 和 产品
    relations: {
      id: ORELATION_ID;
      source_ref: SOLUTION_STRUCTURE_REFS;
      target_ref: SOLUTION_STRUCTURE_REFS;
      type: ORELATION_TYPE;
      description: string; // 两个结构对象之间被设计允许并需要长期保持的架构关系。
      requirement_refs?: SREQUIREMENT_ID[];
      constraint_refs?: SCONSTRAINT_ID[];
    }[];
  };
  scenarios: {
    // 每个场景有目标、参与方和步骤,步骤里写谁和谁交互,以及交互的描述
    id: OSCENARIO_ID;
    status: LIFE_CYCLE_STATUS;
    description: string; // 场景目标、范围及关键协作语义。
    requirement_refs: SREQUIREMENT_ID[];
    initial_state?: string; // 初始状态
    participants: {
      id: OPARTICIPANT_ID;
      ref?: OMODULE_ID | ORESOURCE_ID; // 只在 type 为 module 或 resource 时填写。
      type: PARTICIPANT_TYPE;
      name: string;
      description?: string;
    }[];
    steps: {
      id: OSCENARIO_STEP_ID;
      source_ref: OPARTICIPANT_ID; // 执行动作或发出交互的参与者。
      target_ref?: OPARTICIPANT_ID;
      type: ACTION_TYPE;
      action: string;
    }[];
    outcomes: {
      target_ref?: OPARTICIPANT_ID;
      type: OUTCOME_TYPE;
      description: string;
    }[]; // 完成后的结果，不代替 Specification Acceptance。
  }[];
  concepts: {
    // 跨 Module / Scenario 需要共同遵守、共同理解的设计概念与规则。
    id: OCONCEPT_ID;
    name: string;
    status: LIFE_CYCLE_STATUS;
    definition: string; // Concept 的明确含义和边界定义。 例如 Idempotency、Session、Money、Correlation、Authorization Context。
    scope_refs?: (SOLUTION_STRUCTURE_REFS | OSCENARIO_ID)[]; //不填写表示它是整个 Solution 的通用概念。
    requirement_refs?: SREQUIREMENT_ID[]; // 该 Concept 直接承接或支撑的功能需求。
    constraint_refs?: SCONSTRAINT_ID[]; // 该 Concept 直接承接的约束，尤其适合安全、可靠性、一致性等跨切要求。
    rules: {
      // 所有适用对象必须共同遵守的设计规则。
      id: OCONCEPT_RULE_ID;
      description: string;
    }[];
    record_refs: RUN_ID[];
  }[];
  decisions: {
    // 最终决定了什么、为什么、影响哪里、由哪些需求/约束驱动
    id: ODECISION_ID;
    name: string;
    status: LIFE_CYCLE_STATUS;
    decision: string; //已经确定并需要后续 Implementation 遵守的设计决定。
    reason: string; // 做出该决定的主要原因。为什么这个决定对当前 Solution 是必要或合理的。
    // 该 Decision 直接作用的 Solution 对象。不填写表示整个 Solution 都需要遵守。
    scope_refs?: (
      | SOLUTION_STRUCTURE_REFS
      | ORELATION_ID
      | OSCENARIO_ID
      | OCONCEPT_ID
    )[];
    requirement_refs?: SREQUIREMENT_ID[]; // 直接驱动该 Decision 的功能需求。
    constraint_refs?: SCONSTRAINT_ID[]; // 直接驱动该 Decision 的安全、性能、可靠性等约束。
    record_refs: RUN_ID[]; // 该 Decision 形成或修改的历史 Record。
  }[];
  risks: {
    //写风险和作用范围,以及风险的影响和缓解措施
    id: ORISK_ID;
    name: string;
    status: LIFE_CYCLE_STATUS;
    description: string; // 风险或不确定性本身是什么，以及在什么条件下可能发生。
    impact: string; // 风险发生后可能对业务、架构、可靠性、性能或后续演进造成什么影响。
    mitigation?: string; // 当前已经确定的缓解措施。 没有明确措施时省略，不为了填字段而生成假方案。
    // 风险直接影响的 Solution 对象。不填写表示风险作用于整个 Solution。
    scope_refs?: (
      | SOLUTION_STRUCTURE_REFS
      | ORELATION_ID
      | OSCENARIO_ID
      | OCONCEPT_ID
      | ODECISION_ID
    )[];
    requirement_refs?: SREQUIREMENT_ID[]; // 与该风险直接相关的功能需求。
    constraint_refs?: SCONSTRAINT_ID[]; // 与该风险直接相关的安全、性能、可靠性等约束。
    record_refs: RUN_ID[]; // 支撑风险提出、修改或解除的历史 Record。
  }[];
  diagrams: {
    //一个总体架构图、单个 app 或 service 的组件图、场景流程图,还有状态图
    id: ODIAGRAM_ID;
    name: string;
    status: LIFE_CYCLE_STATUS;
    type: DIAGRAM_TYPE;
    description?: string; // 这张图表达的范围和目的。
    // 图中表达或依据的 Solution 对象。Diagram 不重新定义这些对象，只引用已有设计内容。
    refs: (
      | SOLUTION_STRUCTURE_REFS
      | ORELATION_ID
      | OSCENARIO_ID
      | OCONCEPT_ID
      | ODECISION_ID
      | ORISK_ID
    )[];
    d2_code: string; // D2 源码。
    record_refs: RUN_ID[]; // 支撑该 Diagram 创建或修改的历史 Record。
  }[];
}
