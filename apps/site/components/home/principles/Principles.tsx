import common from "../common.module.css";
import styles from "./principles.module.css";

export function Principles() {
  return (
    <section
      id="principles"
      className={`${common.section} ${styles.root}`}
      aria-labelledby="home-principles-title"
    >
      <p className={common.eyebrow}>A SPACE FOR CLARITY</p>
      <h2 id="home-principles-title">
        每一个想法，
        <br />
        都值得被认真理解。
      </h2>
      <div className={styles.principleColumns}>
        <article>
          <span className={common.eyebrow}>01 / OPEN</span>
          <h3>从想法出发</h3>
          <p>
            说出你想解决的问题。
            <br />
            为目标、约束与可能性留下空间。
          </p>
        </article>
        <article>
          <span className={common.eyebrow}>02 / DEFINE</span>
          <h3>在澄清中聚焦</h3>
          <p>
            把模糊之处变成具体问题，
            <br />
            逐步形成共同的理解。
          </p>
        </article>
        <article>
          <span className={common.eyebrow}>03 / BUILD</span>
          <h3>向实现迈进</h3>
          <p>
            让明确的需求连接方案，
            <br />
            让实际验证回应最初的目标。
          </p>
        </article>
      </div>
    </section>
  );
}
