import common from "../common.module.css";
import { ActionLink } from "../ActionLink";
import { useEffect, useRef, useState } from "react";
import { Weave } from "../../key-visuals/weave/Weave";
import { progressReviewedAt, projectProgress } from "../content";
import { siteLinks } from "../links";
import styles from "./progress.module.css";

export function Progress() {
  const weaveRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = weaveRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const inView = entry?.isIntersecting ?? false;
        setVisible(inView);
        if (inView) setStarted(true);
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <section
      id="progress"
      className={styles.root}
      aria-labelledby="home-progress-title"
    >
      <div className={`${common.section} ${styles.content}`}>
        <div className={styles.heading}>
          <div>
            <p className={common.eyebrow}>A WORK IN PROGRESS</p>
            <h2 id="home-progress-title">
              intloom，
              <br />
              <span>也在逐渐成形。</span>
            </h2>
          </div>
          <div>
            <p>
              从基础工程开始，逐步连接完整的开发流程。
              <br />
              项目仍处于初始化阶段，尚未发布正式可安装版本。
            </p>
            <span className={styles.date}>
              状态更新{" "}
              <time dateTime={progressReviewedAt}>{progressReviewedAt}</time>
            </span>
          </div>
        </div>
        <div className={styles.roadmap}>
          {projectProgress.map((item, index) => (
            <article key={item.id}>
              <div className={styles.roadmapMarker}>
                <span>0{index + 1}</span>
                <span className={styles.status} data-status={item.id}>
                  {item.status}
                </span>
              </div>
              <div className={styles.roadmapCopy}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <ul>
                {item.items.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className={styles.links}>
          <ActionLink variant="primary" href={siteLinks.github} external>
            查看开发进展
          </ActionLink>
          <ActionLink variant="text" href={siteLinks.documentation}>
            阅读项目文档
          </ActionLink>
        </div>
      </div>
      <div ref={weaveRef} className={styles.weave}>
        <div className={styles.visual}>
          <Weave started={started} paused={!visible} />
        </div>
        <p>
          让每一个明确的方向，
          <br />
          <span>逐步编织成真实的构建。</span>
        </p>
      </div>
    </section>
  );
}
