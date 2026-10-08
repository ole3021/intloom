import styles from "./cli-section.module.css";
import { Command } from "../../components/command.tsx";
import { Arrow } from "../../components/brand.tsx";
import { SectionLabel } from "../../components/section-label.tsx";
import { github } from "../../site.ts";

export function CliSection() {
  return (
    <section id="cli" className={styles["field-cli"]} data-reveal>
      <SectionLabel number="03">INTLOOM CLI</SectionLabel>
      <div className={styles["field-cli-grid"]}>
        <div className={styles["cli-introduction"]}>
          <span className={`${styles.eyebrow} ${styles["cli-requirement"]}`}>
            NODE.JS 24+ / NPM
          </span>
          <h2>
            Your terminal.
            <br />
            <span>Your starting point.</span>
          </h2>
          <p>
            Initialize a project, start its local service, and run workflows
            from the command line. Clarify, confirm, and keep the results.
          </p>
          <div className={styles["cli-capabilities"]}>
            <div>
              <code>intloom flows</code>
              <span>Discover installed workflows.</span>
            </div>
            <div>
              <code>intloom runs</code>
              <span>Inspect your runs.</span>
            </div>
            <div>
              <code>intloom artifacts</code>
              <span>Find committed results.</span>
            </div>
            <div>
              <code>intloom stop</code>
              <span>Stop the project service.</span>
            </div>
          </div>
          <p className={styles["cli-release-note"]}>
            npm release in preparation. These commands describe the upcoming
            package installation.{" "}
            <a
              href={`${github}/tree/main/apps/cli`}
              target="_blank"
              rel="noreferrer"
            >
              Build from source <Arrow />
            </a>
          </p>
        </div>
        <div className={styles["cli-terminal"]}>
          <div className={styles["cli-terminal-title"]}>
            <span>
              <i /> QUICK START
            </span>
            <span>LOCAL / TERMINAL</span>
          </div>
          <ol className={styles["cli-steps"]}>
            <li>
              <h3>Install the CLI</h3>
              <Command compact command="npm install -g intloom" />
              <p>
                Or prefix commands with <code>npx</code> to use the launcher.
              </p>
            </li>
            <li>
              <h3>Create a project</h3>
              <Command
                compact
                command={
                  "intloom init my-project --workflow @intloom/workflow-intent\ncd my-project"
                }
              />
              <p>
                In <code>intloom.yaml</code>, configure <code>llms</code> and
                supply your model credentials through the environment before
                running Intent.
              </p>
            </li>
            <li>
              <h3>Start the local service</h3>
              <Command compact command="intloom start" />
              <p>
                Run inside the project. This starts the host; it does not
                execute a workflow.
              </p>
            </li>
            <li>
              <h3>Run your first intent</h3>
              <Command compact command="intloom flow intent" />
              <p>
                Describe what you want to build, answer questions, and confirm
                the specification.
              </p>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
