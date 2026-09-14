export const heroPhases = [
  { id: "idea", label: "想法", caption: "让可能性展开。", squeeze: 0.7 },
  { id: "clarify", label: "澄清", caption: "让目标逐渐清晰。", squeeze: 0.17 },
  { id: "shape", label: "成形", caption: "让下一步有了方向。", squeeze: 0.035 },
] as const;

export const developmentStages = [
  {
    id: "requirements",
    number: "01",
    label: "明确需求",
    english: "REQUIREMENTS",
    title: "先明确，什么才算完成。",
    description:
      "把一个想法展开为目标、约束与验收要求，让后续工作拥有共同依据。",
    input: "我想有个简单的地方，记下要做的事。",
    outcome: "可以新增和完成任务，重新打开页面后仍保留记录。首版无需账户。",
    reason: "先把完成标准说清楚，才能判断后面的设计和代码是否回应了目标。",
  },
  {
    id: "design",
    number: "02",
    label: "形成方案",
    english: "DESIGN",
    title: "让每个选择，都有来由。",
    description:
      "围绕已明确的需求安排职责与协作，让每项设计选择都能连接到它要解决的问题。",
    input: "同一个人在同一浏览器使用，任务需要保留，首版无需账户。",
    outcome: "任务列表负责呈现，任务状态负责更新，浏览器存储负责保存。",
    reason: "从当前使用范围出发，用本地保存满足需求，让第一版保持简单。",
  },
  {
    id: "implementation",
    number: "03",
    label: "实现与验证",
    english: "BUILD & VERIFY",
    title: "用代码与检查，回应最初的目标。",
    description: "依据方案完成实现，再回到验收要求，检查代码的实际行为。",
    input: "已明确的任务操作、状态更新与本地保存方案。",
    outcome: "实现任务记录的保存，并检查重新打开页面后的任务与完成状态。",
    reason: "每一项检查对应一个验收要求，结果是否正确有据可依。",
  },
] as const;

export type DevelopmentStageId = (typeof developmentStages)[number]["id"];

// Editorial status, verified against this workspace; not a live progress API.
export const projectProgress = [
  {
    id: "available",
    status: "已具备",
    title: "构建的基础，已经就位。",
    description: "基础工程、官网与文档入口已建立，为后续能力提供起点。",
    items: ["基础工程", "官网与文档"],
  },
  {
    id: "in-progress",
    status: "正在完善",
    title: "让产品流程，逐步清晰。",
    description:
      "持续打磨意图、需求、方案与实现的衔接方式，以及第一版的产品表达。",
    items: ["产品流程设计", "首版官网"],
  },
  {
    id: "next",
    status: "下一步",
    title: "让核心流程，真正运行起来。",
    description: "逐步落实需求澄清与确认、方案组织、实现与验证的基础流程。",
    items: ["需求澄清与确认", "方案组织", "实现与验证"],
  },
  {
    id: "exploring",
    status: "后续探索",
    title: "让构建过程，留下更多依据。",
    description:
      "探索阶段产物关联、变更影响说明与执行过程回看。具体范围随设计推进确认。",
    items: ["阶段产物关联", "变更影响说明", "执行过程回看"],
  },
] as const;

export const progressReviewedAt = "2026-09-14";
