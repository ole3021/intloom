import { useHead } from "@rspress/core/runtime";
import { Hero } from "./hero.tsx";
import { Ticker } from "./ticker.tsx";
import { PrincipleSection } from "./principle-section.tsx";
import { WorkflowSection } from "./workflow/index.tsx";
import { CliSection } from "./cli-section.tsx";
import { StudioSection } from "./studio-section.tsx";
import { ProjectStatus } from "./project-status.tsx";
import { ClosingSection } from "./closing-section.tsx";

export const frontmatter = {
  pageType: "custom",
  title: "IntLoom — A loom of action",
  description:
    "Carry human intent through agents, code, and explicit decisions. Keep context, execution, and evidence connected.",
};

export default function Home() {
  useHead({ title: frontmatter.title });
  return (
    <main id="main" tabIndex={-1}>
      <Hero />
      <Ticker />
      <PrincipleSection />
      <WorkflowSection />
      <CliSection />
      <StudioSection />
      <ProjectStatus />
      <ClosingSection />
    </main>
  );
}
