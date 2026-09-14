export const siteLinks = {
  github: "https://github.com/ole3021/intloom",
  documentation: "/guide/introduction",
} as const;

export const navigationLinks = [
  { text: "核心理念", href: "#principles" },
  { text: "开发流程", href: "#development" },
  { text: "项目进度", href: "#progress" },
  { text: "文档", href: siteLinks.documentation },
] as const;
