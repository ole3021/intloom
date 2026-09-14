import common from "../common.module.css";
import { ActionLink } from "../ActionLink";
import { useState } from "react";
import { Convergence } from "../../key-visuals/convergence/Convergence";
import { heroPhases } from "../content";
import { siteLinks } from "../links";
import styles from "./hero.module.css";

export function Hero() {
  const [phase, setPhase] = useState<(typeof heroPhases)[number]>(
    heroPhases[1],
  );
  const [paused, setPaused] = useState(false);
  return (
    <section className={styles.root} aria-labelledby="home-title">
      <div className={styles.copy}>
        <p className={common.eyebrow}>FROM POSSIBILITY TO PURPOSE</p>
        <h1 id="home-title">
          让想法，
          <br />
          <span>逐渐有形。</span>
        </h1>
        <p className={styles.description}>
          开放的想法，清晰的目标。
          <br />
          经由澄清与确认，逐步走向具体实现。
        </p>
        <div className={styles.actions}>
          <ActionLink variant="primary" href="#development">
            探索成形的过程
          </ActionLink>
          <ActionLink variant="text" href={siteLinks.documentation}>
            阅读文档
          </ActionLink>
        </div>
      </div>
      <div className={styles.convergence}>
        <Convergence paused={paused} squeeze={phase.squeeze} />
        <div className={styles.fieldLabels} aria-hidden="true">
          <span>想法 / POSSIBILITY</span>
          <span>方向 / PURPOSE</span>
        </div>
      </div>
      <div className={styles.fieldControls}>
        <fieldset aria-label="聚合阶段">
          {heroPhases.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={phase.id === item.id}
              onClick={() => setPhase(item)}
            >
              <span>0{index + 1}</span>
              {item.label}
            </button>
          ))}
        </fieldset>
        <button
          className={styles.motionButton}
          type="button"
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
        >
          {paused ? "继续动态" : "暂停动态"}
        </button>
      </div>
      <p className={styles.phaseCaption} aria-live="polite">
        {phase.caption}
      </p>
    </section>
  );
}
