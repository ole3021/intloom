import { Mark } from "./brand.tsx";
import { useMotionControl } from "../motion/motion-provider.tsx";
import styles from "./site-footer.module.css";
import { useI18n } from "@rspress/core/runtime";

export function SiteFooter() {
  const { paused, toggle } = useMotionControl();
  const t = useI18n<typeof import("../../i18n.json")>();
  return (
    <footer className={styles.footer}>
      <a href="/" aria-label={t("siteHome")}>
        <Mark className={styles.logo} />
      </a>
      <span className={styles.credit}>
        Build with love by ole3021 &amp; CodeX
      </span>
      <button
        className={styles.toggle}
        type="button"
        aria-label={t("sitePauseMotion")}
        aria-pressed={paused}
        onClick={toggle}
      >
        {paused ? "▶" : "Ⅱ"} {t("siteMotion")}
      </button>
    </footer>
  );
}
