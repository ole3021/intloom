import { ComingSoon } from "./coming-soon.tsx";

export const frontmatter = {
  pageType: "custom",
  title: "Examples — IntLoom",
  head: [["meta", { name: "robots", content: "noindex, nofollow" }]],
};

export default function Examples() {
  return <ComingSoon title="Examples" />;
}
