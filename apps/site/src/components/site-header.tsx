import { LogoGithub } from "@carbon/icons-react";
import { useI18n, useLang, useLocation, usePage } from "@rspress/core/runtime";
import navigation from "../../../../docs/_nav.json";
import { Arrow, Mark } from "./brand.tsx";
import { github } from "../site.ts";
import styles from "./site-header.module.css";
import { SiteSearch } from "./site-search.tsx";

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
          <SiteSearch />
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
          <LogoGithub size={20} aria-hidden="true" />
          <span>GitHub</span>
          <Arrow />
        </a>
      </nav>
    </header>
  );
}
