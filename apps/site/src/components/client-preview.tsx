import {
  Activity,
  Calculator,
  Catalog,
  Checkmark,
  Document,
  DocumentBlank,
  PlayFilledAlt,
} from "@carbon/icons-react";
import { useEffect, useRef, useState } from "react";
import logo from "../../assets/logo.svg";
import { useMotionControl } from "../motion/motion-provider.tsx";
import {
  latestReleaseUrl,
  studioTargets,
  type WebsiteReleases,
} from "../releases.ts";
import styles from "./client-preview.module.css";
import { SiteLink } from "./site-link.tsx";
import { SectionLabel } from "./section-label.tsx";

const scenes = [
  { label: "Library", Icon: Catalog },
  { label: "Runs", Icon: Activity },
  { label: "Result", Icon: Document },
] as const;

function StudioDemo() {
  const [scene, setScene] = useState(0);
  const [visible, setVisible] = useState(false);
  const { paused } = useMotionControl();
  const frame = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!frame.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.35 },
    );
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !visible) return;
    const timer = setInterval(() => {
      if (!document.hidden && !frame.current?.contains(document.activeElement))
        setScene((current) => (current + 1) % scenes.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [paused, visible]);

  return (
    <figure
      ref={frame}
      className={styles.preview}
      aria-label="Studio demo: run a Loom and read its result"
    >
      <div className={styles.titlebar}>
        <img src={logo} alt="" />
        IntLoom Studio
      </div>
      <div className={styles.workspace} id="studio-demo-scene">
        <div key={scene} className={styles.scene}>
          {scene === 0 && (
            <>
              <h3>Installed Looms</h3>
              <div className={styles.selected}>
                <Document size={20} />
                <div className={styles.detail}>
                  <strong>Meeting notes</strong>
                  <small>summarize</small>
                </div>
                <button
                  type="button"
                  className={styles.run}
                  onClick={() => setScene(1)}
                  aria-label="Run meeting-notes in the demo"
                >
                  <PlayFilledAlt size={16} /> Run
                </button>
              </div>
              <div className={styles.row}>
                <Calculator size={20} />
                <span>Order total</span>
              </div>
            </>
          )}
          {scene === 1 && (
            <>
              <h3>Recent runs</h3>
              <div className={styles.selected}>
                <Activity size={20} />
                <div className={styles.detail}>
                  <strong>Meeting notes</strong>
                  <small>notes.md</small>
                </div>
                <span className={styles.status}>Running</span>
                <span className={styles.progress} aria-hidden="true" />
              </div>
              <div className={styles.row}>
                <Checkmark size={20} />
                <span>Order total</span>
                <small>Completed</small>
              </div>
            </>
          )}
          {scene === 2 && (
            <>
              <h3>
                <Checkmark size={16} /> Run completed
              </h3>
              <div className={styles.paper}>
                <div className={styles.filename}>
                  <DocumentBlank size={16} /> meeting-notes.md
                </div>
                <p>
                  <strong>Decision</strong> Pilot with 10% of accounts.
                </p>
                <p>
                  <strong>Action</strong> Chen to share test results by
                  Thursday.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      <fieldset className={styles.steps} aria-label="Choose a demo scene">
        {scenes.map(({ label, Icon }, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={scene === index}
            aria-controls="studio-demo-scene"
            onClick={() => setScene(index)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </fieldset>
    </figure>
  );
}

export function ClientPreview({
  release,
}: {
  release: WebsiteReleases["studio"];
}) {
  return (
    <section id="client" className="module">
      <SectionLabel number="04">DESKTOP</SectionLabel>
      <div className="split">
        <div className={styles.introduction}>
          <h2>
            IntLoom <em>Studio.</em>
          </h2>
          <p>
            Install Looms, follow runs and export deliveries on macOS, Windows
            or Linux.
          </p>
          <SiteLink href={latestReleaseUrl}>
            {release
              ? `Studio v${release.version} on GitHub`
              : "Latest Studio release on GitHub"}
          </SiteLink>
          <ul className={styles.downloads}>
            {studioTargets.map(({ label, id }) => {
              const url = release?.downloads?.[id];
              if (url === null) return null;
              return (
                <li key={id}>
                  <SiteLink href={url ?? `/download/studio/${id}`}>
                    {label}
                  </SiteLink>
                </li>
              );
            })}
          </ul>
        </div>
        <StudioDemo />
      </div>
    </section>
  );
}
