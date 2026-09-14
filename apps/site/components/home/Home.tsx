import common from "./common.module.css";
import styles from "./home.module.css";
import { Navigation } from "./navigation/Navigation";
import { Hero } from "./hero/Hero";
import { Principles } from "./principles/Principles";
import { Development } from "./development/Development";
import { Progress } from "./progress/Progress";
import { siteLinks } from "./links";

export function Home() {
  return (
    <div className={`${common.theme} ${styles.page}`}>
      <a className={styles.skipLink} href="#home-main">
        跳到主要内容
      </a>
      <Navigation />
      <main id="home-main">
        <Hero />
        <Principles />
        <Development />
        <Progress />
      </main>
      <footer className={styles.footer}>
        <a className={common.brand} href="/">
          intloom
        </a>
        <span>从意图出发，逐步构建。</span>
        <a href={siteLinks.github} target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      </footer>
    </div>
  );
}
