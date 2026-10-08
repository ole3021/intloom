import { useI18n, useLang, useLocation, usePage } from "@rspress/core/runtime";
import { Search } from "@rspress/core/theme-original";
import navigation from "../../../../docs/_nav.json";
import { Arrow, Mark } from "./brand.tsx";
import { github } from "../site.ts";
import styles from "./site-header.module.css";

const navigationLabels: Record<string, keyof typeof import("../../i18n.json")> =
  {
    Docs: "navDocs",
    Workflows: "navWorkflows",
    Examples: "navExamples",
  };

export function SiteHeader() {
  const { pathname, search } = useLocation();
  const { page } = usePage();
  const t = useI18n<typeof import("../../i18n.json")>();
  const chinese = useLang() === "zh";
  const document = page.pageType === "doc" || page.pageType === "doc-wide";
  const basePath = chinese ? pathname.replace(/^\/zh(?=\/)/, "") : pathname;
  const alternate = `${chinese ? basePath : `/zh${basePath}`}${search}`;
  return (
    <header className={styles.header} data-document={document}>
      <a href="/" className={styles.brand} aria-label={t("siteHome")}>
        <Mark className={styles.logo} />
      </a>
      <nav aria-label={t("siteNavigation")}>
        {navigation.map((item) => {
          const label = navigationLabels[item.text];
          return (
            <a
              key={item.link}
              href={
                chinese && item.link.startsWith("/guide/")
                  ? `/zh${item.link}`
                  : item.link
              }
              className={
                item.link.startsWith("/guide/") ? undefined : styles.secondary
              }
              aria-current={
                new RegExp(item.activeMatch).test(basePath) ? "page" : undefined
              }
            >
              {label ? t(label) : item.text}
            </a>
          );
        })}
        <div className={styles.search}>
          <Search />
        </div>
        {document && (
          <a
            className={styles.language}
            href={alternate}
            hrefLang={chinese ? "en" : "zh"}
            lang={chinese ? "en" : "zh"}
            aria-label={chinese ? "Switch to English" : "切换到简体中文"}
            data-language-switch
          >
            {chinese ? "EN" : "中文"}
          </a>
        )}
        <a
          className={styles.github}
          href={github}
          target="_blank"
          rel="noreferrer"
          aria-label={t("siteGithub")}
        >
          <svg
            viewBox="0 0 24 24"
            width="17"
            height="17"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.06c-3.1.67-3.76-1.31-3.76-1.31-.51-1.28-1.24-1.62-1.24-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.7 1.15 1.7 1.15 1 1.7 2.61 1.21 3.25.93.1-.72.39-1.21.71-1.49-2.48-.28-5.08-1.24-5.08-5.52 0-1.22.44-2.21 1.15-2.99-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.14a10.6 10.6 0 0 1 5.56 0c2.12-1.44 3.05-1.14 3.05-1.14.61 1.54.23 2.68.11 2.96.72.78 1.15 1.77 1.15 2.99 0 4.29-2.61 5.23-5.1 5.51.4.35.76 1.02.76 2.06V22c0 .3.2.64.77.53A11.1 11.1 0 0 0 12 .9Z" />
          </svg>
          <span>GitHub</span>
          <Arrow />
        </a>
      </nav>
    </header>
  );
}
