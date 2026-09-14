import common from "../common.module.css";
import { useRef } from "react";
import { siteLinks, navigationLinks } from "../links";
import styles from "./navigation.module.css";

export function Navigation() {
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  return (
    <header className={styles.root}>
      <div className={styles.navInner}>
        <a className={common.brand} href="/" aria-label="intloom 首页">
          <img src="/icon.svg" width="26" height="26" alt="" />
          intloom
        </a>
        <nav className={styles.desktopNav} aria-label="首页导航">
          {navigationLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.text}
            </a>
          ))}
        </nav>
        <a
          className={styles.github}
          href={siteLinks.github}
          target="_blank"
          rel="noreferrer"
        >
          GitHub <span aria-hidden="true">↗</span>
        </a>
        <details className={styles.mobileMenu} ref={mobileMenu}>
          <summary>菜单</summary>
          <nav aria-label="移动端导航">
            {navigationLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => {
                  if (mobileMenu.current) mobileMenu.current.open = false;
                }}
              >
                {link.text}
              </a>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
