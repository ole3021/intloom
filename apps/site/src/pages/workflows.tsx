import { ComingSoon } from "./coming-soon.tsx";

export const frontmatter = {
  pageType: "custom",
  title: "Workflows — IntLoom",
  head: [["meta", { name: "robots", content: "noindex, nofollow" }]],
};

export default function Workflows() {
  return <ComingSoon title="Workflows" />;
}
