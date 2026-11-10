import type {
  Command,
  PackageInfo,
  SchemaField,
  Settings,
  Launch,
} from "./types.ts";
const title: SchemaField = { type: "string", title: "任务名称" };
const files: SchemaField = {
  type: "array",
  title: "参考素材",
  format: "files",
  items: { type: "string" },
};
function command(
  name: string,
  label: string,
  description: string,
  output: string,
  properties: Record<string, SchemaField>,
  required: string[],
): Command {
  return {
    name,
    title: label,
    description,
    output,
    input: { type: "object", properties, required },
  };
}
const create = command(
  "create",
  "生成文稿",
  "从素材拟定大纲并制作演示稿。",
  "可编辑的 PowerPoint 文稿",
  {
    title: { ...title, title: "演示主题" },
    audience: { type: "string", title: "目标听众", default: "客户与合作伙伴" },
    pages: {
      type: "integer",
      title: "页数",
      minimum: 1,
      maximum: 30,
      default: 6,
    },
    files,
    outline: { type: "boolean", title: "制作前先让我确认大纲", default: true },
  },
  ["title", "pages", "files"],
);
const revise = command(
  "revise",
  "修订文稿",
  "使用现有 PPTX 和修改要求生成独立的新版本。",
  "修订后的 PowerPoint 文稿",
  {
    title,
    changes: { type: "string", title: "修改要求" },
    files: {
      ...files,
      title: "原始 PPTX",
      maxItems: 1,
      items: { type: "string", pattern: "\\.[pP][pP][tT][xX]$" },
    },
  },
  ["title", "changes", "files"],
);
const photos = command(
  "color",
  "批量调色",
  "为一组照片应用统一风格并打包交付。",
  "照片示例 ZIP",
  {
    title,
    style: { type: "string", title: "风格要求", default: "自然暖色" },
    files: { ...files, title: "原始照片" },
  },
  ["title", "files"],
);
const report = command(
  "write",
  "生成报告",
  "把工作记录整理成结构化报告。",
  "Markdown 报告",
  {
    title,
    files,
    audience: { type: "string", title: "目标读者" },
    ask: { type: "boolean", title: "运行中询问目标读者", default: false },
  },
  ["title", "files"],
);
const generate = command(
  "generate",
  "生成演示稿",
  "根据目标、参考资料和模板生成演示稿。",
  "Editable presentation.pptx",
  {
    goal: { type: "string", title: "演示目标", minLength: 1 },
    materials: { ...files, title: "参考资料" },
    template: { type: "string", title: "演示模板", format: "file" },
    pages: { type: "integer", title: "页数", minimum: 1, maximum: 30 },
    audience: { type: "string", title: "目标听众" },
  },
  ["goal"],
);
const learn = command(
  "learn",
  "学习照片风格",
  "从成对的 RAW 和成片学习风格。",
  "Versioned style-profile.json for local RAW processing",
  {
    name: { type: "string", title: "风格名称", minLength: 1 },
    note: { type: "string", title: "备注" },
    pairs: {
      type: "array",
      title: "对照照片",
      format: "pairs",
      minItems: 1,
      items: {
        type: "object",
        properties: { raw: { type: "string" }, edited: { type: "string" } },
        required: ["raw", "edited"],
        additionalProperties: false,
      },
    },
  },
  ["name", "pairs"],
);
const apply = command(
  "apply",
  "应用照片风格",
  "为目录中的照片应用已有风格。",
  "ZIP of sRGB JPEGs, per-image adjustments and processing report",
  {
    directory: {
      type: "string",
      title: "RAW 照片目录",
      format: "directory",
      minLength: 1,
    },
    profile: {
      type: "string",
      title: "风格文件",
      format: "file",
      minLength: 1,
    },
    quality: { type: "integer", title: "质量", minimum: 1, maximum: 100 },
  },
  ["directory", "profile"],
);
for (const c of [generate, learn, apply]) c.input.additionalProperties = false;

function samplePackage(
  id: string,
  name: string,
  description: string,
  format: string,
  commands: Command[],
  digest: string,
  version = "1.0.0",
): PackageInfo {
  return {
    ref: { id, version, artifactDigest: `sha256:${digest.repeat(64)}` },
    name,
    description,
    format,
    commands,
    defaultCommand: commands[0].name,
  };
}
export const catalog: PackageInfo[] = [
  samplePackage(
    "demo-presentation",
    "演示文稿 · 交互演练",
    "练习大纲确认与修订。",
    "PPTX",
    [create, revise],
    "1",
  ),
  samplePackage(
    "demo-photo",
    "照片处理 · 交互演练",
    "演练照片批处理与子 Run。",
    "ZIP",
    [photos],
    "2",
  ),
  samplePackage(
    "report-writer",
    "报告整理 · 交互演练",
    "从工作记录生成示例报告。",
    "Markdown",
    [report],
    "3",
  ),
  samplePackage(
    "ppt-generator",
    "演示文稿",
    "按 0.4.0 文稿包清单启动。",
    "PPTX",
    [generate],
    "4",
    "0.4.0",
  ),
  samplePackage(
    "photo-editor",
    "照片处理",
    "按 0.4.0 照片包清单启动。",
    "ZIP",
    [apply, learn],
    "5",
    "0.4.0",
  ),
];
// Historical v1 Runs retain their original identity. New runs copied from those forms use the demo package.
export function launchPackage(launch: Launch) {
  if (
    launch.loom === "ppt-generator" &&
    ["create", "revise"].includes(launch.command)
  )
    return "demo-presentation";
  if (launch.loom === "photo-editor" && launch.command === "color")
    return "demo-photo";
  return launch.loom;
}
export const sampleFiles: Record<string, string[]> = {
  generate: ["示例/产品简报.md"],
  create: ["示例/发布简报.md", "示例/产品亮点.docx"],
  revise: ["示例/春季发布会.pptx"],
  color: ["示例/陈列近景.jpg", "示例/门店外景.jpg"],
  write: ["示例/筹备记录.md"],
};
export const sampleProjects = [
  "/Demo/春季发布",
  "/Demo/品牌图库",
  "/Demo/零售试点",
];
export function defaultSettings(): Settings {
  return {
    models: [
      {
        id: "fast",
        name: "通用模型",
        provider: "OpenAI",
        model: "gpt-4.1-mini",
        credentialId: "personal",
      },
      {
        id: "full",
        name: "文稿模型",
        provider: "OpenAI",
        model: "gpt-4.1",
        credentialId: "team",
      },
    ],
    credentials: [
      { id: "personal", name: "个人凭据", env: "PERSONAL_MODEL_KEY" },
      { id: "team", name: "团队凭据", env: "TEAM_MODEL_KEY" },
    ],
    harnesses: [
      { id: "mastra", name: "本机 Mastra", adapter: "Mastra" },
      { id: "opencode", name: "本机 OpenCode", adapter: "OpenCode" },
    ],
    profiles: [
      {
        id: "daily",
        name: "日常",
        modelId: "fast",
        planningModelId: "full",
        harnessId: "mastra",
      },
      {
        id: "quality",
        name: "高质量",
        modelId: "full",
        planningModelId: "",
        harnessId: "mastra",
      },
    ],
    globalProfile: "daily",
    projects: { [sampleProjects[0]]: "quality" },
    theme: "system",
    reduceMotion: false,
    notifications: true,
  };
}
