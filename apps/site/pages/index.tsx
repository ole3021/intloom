import { useScrollAfterNav } from "@rspress/core/theme-original";
import {
  Activity,
  GroupObjects,
  Cube,
  FlowConnection,
  TaskComplete,
  WarningAlt,
} from "@carbon/icons-react";
import { ReuseVisual } from "../src/components/feature-visuals/reuse.tsx";
import { WorkflowVisual } from "../src/components/feature-visuals/workflow.tsx";
import { CompositionVisual } from "../src/components/feature-visuals/composition.tsx";
import { ManagedRunVisual } from "../src/components/feature-visuals/managed-run.tsx";
import { OutcomeVisual } from "../src/components/feature-visuals/outcomes.tsx";
import diagram from "../src/components/feature-visuals/visuals.module.css";
import { IntentField } from "../src/components/intent-field/index.tsx";
import { ClientPreview } from "../src/components/client-preview.tsx";
import {
  cliReleasesUrl,
  latestReleaseUrl,
  readReleases,
  type WebsiteReleases,
} from "../src/releases.ts";
import { docsUrl } from "../src/site.ts";
import { useHead } from "@rspress/core/runtime";
import { useEffect, useState } from "react";
import { SectionLabel } from "../src/components/section-label.tsx";
import { Command } from "../src/components/command.tsx";
import { SiteLink } from "../src/components/site-link.tsx";
import { DecryptedText } from "../src/components/motion/decrypted-text.tsx";
import { ScrollVelocity } from "../src/components/motion/scroll-velocity.tsx";
import "../src/styles/home.css";

export const frontmatter = {
  pageType: "custom",
  title: "IntLoom — Packaged intelligence",
};

const installers = {
  npm: `npm install -g intloom`,
  bun: `bun add -g intloom`,
  pnpm: `pnpm add -g intloom`,
  yarn: `yarn global add intloom`,
} as const;

const features = [
  {
    label: "Composable execution",
    shortLabel: "Compose",
    Icon: GroupObjects,
    Graphic: CompositionVisual,
    title: ["Assemble ", "a report Loom."],
    text: "A report Loom can use a skill for editorial guidance, a tool to read notes, an agent to draft, and code to write Markdown. Choose an agent, code, or a workflow as the entry point.",
    caption: "Components of a report Loom",
    flow: "Notes in → report Loom → Markdown out",
    ticker: "Compose agents, skills, tools & code",
  },
  {
    label: "Flexible orchestration",
    shortLabel: "Guide",
    Icon: FlowConnection,
    Graphic: WorkflowVisual,
    title: ["Let the agent plan. ", "Set the required steps."],
    text: "Give the agent a goal and let it choose its next action. Add a workflow when order matters. If a deck needs an approved outline, make approval a required step before export.",
    caption: "An outline review before export",
    flow: "Plan the deck → approve the outline → export slides",
    ticker: "Use workflows where order matters",
  },
  {
    label: "Defined outcomes",
    shortLabel: "Verify",
    Icon: TaskComplete,
    Graphic: OutcomeVisual,
    title: ["Define the result ", "and how to check it."],
    text: "Specify what a run should return. When the task needs quality checks, the Loom defines and runs them. A report Loom can verify the file format and required sections for the exact draft it delivers.",
    caption: "Checks on one report version",
    flow: "report.md → check format and sections → deliver the checked version",
    ticker: "Define outputs & check results",
  },
  {
    label: "Managed execution",
    shortLabel: "Track",
    Icon: Activity,
    Graphic: ManagedRunVisual,
    title: ["Follow a run ", "through delivery."],
    text: "IntLoom’s Kernel tracks the run, its interactions, and its artifacts. When a report is waiting for review, open the saved draft, submit your decision, and inspect the file and its history in the same run.",
    caption: "A report run waiting for a decision",
    flow: "Save draft → request review → record the answer → deliver",
    ticker: "Track runs, interactions & artifacts",
  },
  {
    label: "Built for reuse",
    shortLabel: "Reuse",
    Icon: Cube,
    Graphic: ReuseVisual,
    title: ["Share a version. ", "Run it on new inputs."],
    text: "Package a capability once. A person can run it from the CLI, an app can call it, and another agent can use it through MCP. Each caller supplies its own input to the same versioned Loom.",
    caption: "One calculator, three callers",
    flow: "One package version → independent runs → a result for each caller",
    ticker: "Reuse a Loom across callers",
  },
] as const;

export default function Home() {
  useScrollAfterNav();
  useHead({ title: frontmatter.title });
  const [active, setActive] = useState(0);
  const [releases, setReleases] = useState<WebsiteReleases>({});
  useEffect(() => {
    const controller = new AbortController();
    readReleases(controller.signal)
      .then(setReleases)
      .catch(() => {
        // The static release links also work when GitHub rate-limits the browser.
      });
    return () => controller.abort();
  }, []);
  const [manager, setManager] = useState<keyof typeof installers>("npm");
  const feature = features[active] ?? features[0];
  return (
    <main id="main" tabIndex={-1} className="frame home">
      <section className="hero" data-intent-surface>
        <aside className="hero-notice" aria-label="Development notice">
          <WarningAlt size={16} aria-hidden="true" />
          <p>
            <strong>Under development.</strong> Not ready for production.
          </p>
        </aside>
        <div className="hero-field" aria-hidden="true">
          <IntentField />
        </div>
        <div className="hero-main">
          <p className="eyebrow">
            <span className="hatch" /> Agentic Capability Packaging &amp;
            Execution Framework
          </p>
          <h1>
            Packaged intelligence
            <br />
            <em className="hero-verb" aria-hidden="true">
              <span className="hero-verb-track">
                <span>Build</span>
                <span>Share</span>
                <span>Reuse</span>
                <span>Build</span>
              </span>
            </em>
            <span className="sr-only">Build, share, and reuse</span>{" "}
            <span className="hero-action">the possible.</span>
          </h1>
          <p className="hero-copy">
            Compose agents, workflows, and codes into looms. <br />
            Build, run and share intelligent capabilities.
          </p>
          <div className="hero-command">
            <Command command="npx intloom startup" />
            <p>Start the local IntLoom service and watch run activity.</p>
            <SiteLink href="#cli">Install the CLI globally</SiteLink>
          </div>
        </div>
        <div className="instrument hero-foot">
          <SiteLink
            className="release-version"
            href={releases.cli?.url ?? cliReleasesUrl}
          >
            {releases.cli
              ? `CLI release / v${releases.cli.version}`
              : "CLI releases on GitHub"}
          </SiteLink>
          <SiteLink href={latestReleaseUrl}>Release notes</SiteLink>
        </div>
      </section>
      <ScrollVelocity texts={features.map((feature) => feature.ticker)} />
      <section className="module" id="principle">
        <SectionLabel number="01">THE OPERATING PRINCIPLE</SectionLabel>
        <div className="principle">
          <span aria-hidden="true">[</span>
          <h2>
            Agents bring
            <br />
            <em>intelligence.</em>
            <br />
            Looms deliver
            <br />
            <em>results</em>
          </h2>
          <span aria-hidden="true">]</span>
        </div>
        <p className="principle-note">
          Agents decide how work gets done. Code handles calculations and
          checks. Use workflows when steps must run in order. IntLoom brings
          them together in reusable, outcome-driven Looms.
        </p>
      </section>
      <section className="module" id="features">
        <SectionLabel number="02">
          <DecryptedText text="WHAT MAKES A LOOM" />
        </SectionLabel>
        <div className="feature-heading">
          <h2>
            More than an agent.
            <br />A complete executable capability.
          </h2>
          <p>
            A Loom packages the parts of a task and defines what it delivers.
            IntLoom manages each run, from the first input to the final result.
          </p>
        </div>
        <div className="explorer">
          <div
            role="tablist"
            aria-label="Loom features"
            className="feature-tabs"
          >
            {features.map((f, i) => (
              <button
                type="button"
                role="tab"
                id={`feature-${i}`}
                aria-label={`${f.shortLabel} — ${f.label}`}
                key={f.label}
                aria-controls="feature-panel"
                aria-selected={i === active}
                tabIndex={i === active ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(event) => {
                  let next = i;
                  if (["ArrowRight", "ArrowDown"].includes(event.key))
                    next = (i + 1) % features.length;
                  else if (["ArrowLeft", "ArrowUp"].includes(event.key))
                    next = (i + features.length - 1) % features.length;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = features.length - 1;
                  else return;
                  event.preventDefault();
                  setActive(next);
                  document.getElementById(`feature-${next}`)?.focus();
                }}
              >
                <f.Icon size={20} aria-hidden="true" />
                <span className="tab-name">{f.label}</span>
                <span className="tab-short">{f.shortLabel}</span>
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="feature-panel"
            aria-labelledby={`feature-${active}`}
            className="feature-panel"
          >
            <div className="feature-content" key={feature.label}>
              <div className="feature-copy">
                <small className="eyebrow">
                  <feature.Icon size={16} aria-hidden="true" />
                  {feature.label}
                </small>
                <h3>
                  {feature.title[0]}
                  <em>{feature.title[1]}</em>
                </h3>
                <p>{feature.text}</p>
              </div>
              <figure className="feature-figure">
                <svg
                  className={diagram.stage}
                  viewBox="0 0 240 240"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    className={diagram.registration}
                    d="M24 42V24h18m156 0h18v18M24 198v18h18m156 0h18v-18"
                  />
                  <feature.Graphic />
                </svg>
                <figcaption>{feature.caption}</figcaption>
              </figure>
              <code className="feature-flow">{feature.flow}</code>
            </div>
          </div>
        </div>
      </section>
      <section className="module" id="cli">
        <SectionLabel number="03">INTLOOM CLI</SectionLabel>
        <div className="split">
          <div>
            <h2>
              Run your
              <br />
              <em>first Loom.</em>
            </h2>
            <ol className="step-list">
              <li>
                <strong>Install the CLI</strong>
                <p>Set up IntLoom on your machine and start the local host.</p>
              </li>
              <li>
                <strong>Install a Loom</strong>
                <p>Add the package and check what input it expects.</p>
              </li>
              <li>
                <strong>Run it and inspect the result</strong>
                <p>
                  Give the Loom its input, follow the run, and open what it
                  delivers.
                </p>
              </li>
            </ol>
          </div>
          <div className="console">
            <div className="panel-head">
              <span className="live-dot">Local setup</span>
              <span>Terminal</span>
            </div>
            <div className="console-body">
              <h3>Install the CLI</h3>
              <p>Install the latest stable CLI from npm.</p>
              <fieldset className="installers">
                <legend className="sr-only">Choose a package manager</legend>
                {(Object.keys(installers) as (keyof typeof installers)[]).map(
                  (name) => (
                    <button
                      type="button"
                      key={name}
                      aria-pressed={manager === name}
                      onClick={() => setManager(name)}
                    >
                      {name}
                    </button>
                  ),
                )}
              </fieldset>
              <Command key={manager} compact command={installers[manager]} />
              {manager === "yarn" && (
                <p className="install-note">
                  Global installation with Yarn Classic.
                </p>
              )}
              <h3>Start the Intloom service</h3>
              <p>
                Run this from any directory after installation. For a local
                candidate, see the{" "}
                <SiteLink href="/docs/start/setup">setup guide</SiteLink>.
              </p>
              <Command compact command="intloom startup" />
              <div className="reserved">
                <SiteLink href="/docs/use/meeting-notes">
                  Install and run meeting-notes
                </SiteLink>
              </div>
            </div>
          </div>
        </div>
      </section>
      <ClientPreview release={releases.studio} />
      <section className="module" id="author">
        <SectionLabel number="05">CREATE A LOOM</SectionLabel>
        <div className="split">
          <div>
            <h2>
              Build a Loom with
              <br />
              your <em>coding agent.</em>
            </h2>
            <p className="lead">
              Start with a task you know well. Tell your coding agent what goes
              in, how you do the work, and what a good result looks like. Try
              the draft on a real input and refine it before sharing.
            </p>
          </div>
          <div className="placeholder">
            <p>Develop a Loom with IntLoom</p>
            <SiteLink href="/docs/ai/loom-authoring">
              Get the coding agent guide
            </SiteLink>
            <SiteLink href="/docs/start/build">Build a first package</SiteLink>
          </div>
        </div>
      </section>
      <section className="closing">
        <h2>
          Stay in <em>the loom.</em>
        </h2>
        <SiteLink href="/looms">Check Looms</SiteLink>
        <SiteLink href={docsUrl}>Read the documentation</SiteLink>
      </section>
    </main>
  );
}
