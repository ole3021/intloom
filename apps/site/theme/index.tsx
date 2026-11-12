import { useLocation, useNavigate, usePage } from "@rspress/core/runtime";
import {
  Layout as BaseLayout,
  Link as BaseLink,
  type LinkProps,
} from "@rspress/core/theme-original";
import { LogoGithub } from "@carbon/icons-react";
import { SiteSearch } from "../src/components/site-search.tsx";
import { LinkArrow, SiteLink } from "../src/components/site-link.tsx";
import { ScrambledText } from "../src/components/motion/scrambled-text.tsx";
import {
  MotionProvider,
  useMotionControl,
} from "../src/motion/motion-provider.tsx";
import { docsUrl, repositoryUrl } from "../src/site.ts";
import "../src/styles/search.css";
import logo from "../assets/logo.svg";
import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/site.css";

export * from "@rspress/core/theme-original";
export {
  ChevronRight as IconArrowRight,
  ChevronUp as IconScrollToTop,
} from "@carbon/icons-react";

export function Link({ href = "/", children, ...props }: LinkProps) {
  const ownIcon =
    props["aria-hidden"] ||
    props.className?.includes("rp-prev-next-page__item");
  return (
    <BaseLink href={href} {...props}>
      {children}
      {!ownIcon && <LinkArrow href={href} />}
    </BaseLink>
  );
}

export function Nav() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { page } = usePage();
  const isDoc = page.pageType === "doc";
  const chinese = page.lang === "zh";
  return (
    <header className="site-header">
      <a className="brand-link" href="/" aria-label="IntLoom home">
        <img src={logo} alt="" />
      </a>
      <nav aria-label="Main navigation" lang="en">
        {isDoc && (
          <button
            type="button"
            className="language-switch"
            lang={chinese ? "en" : "zh"}
            aria-label={chinese ? "Switch to English" : "切换为中文"}
            onClick={() =>
              navigate(
                (chinese
                  ? pathname.replace(/^\/zh\//, "/")
                  : `/zh${pathname}`) + search,
              )
            }
          >
            {chinese ? "EN" : "中文"}
          </button>
        )}
        <a
          href="/looms"
          aria-current={
            pathname.replace(/\/$/, "") === "/looms" ? "page" : undefined
          }
        >
          <ScrambledText text="Looms" />
        </a>
        <a
          href={chinese ? `/zh${docsUrl}` : docsUrl}
          aria-current={isDoc ? "location" : undefined}
        >
          <ScrambledText text="Docs" />
        </a>
        <SiteSearch />
        <a
          href={repositoryUrl}
          className="repo-link"
          aria-label="GitHub repository"
        >
          <LogoGithub size={20} aria-hidden="true" /> <span>GitHub</span>{" "}
          <LinkArrow href={repositoryUrl} />
        </a>
      </nav>
    </header>
  );
}

export function Layout() {
  const { page } = usePage();
  return (
    <MotionProvider>
      {page.pageType === "custom" ? <SiteLayout /> : <BaseLayout />}
    </MotionProvider>
  );
}

function SiteLayout() {
  const { paused, toggle } = useMotionControl();
  return (
    <div id="top" className="site" data-site-frame="" data-paused={paused}>
      <SiteLink href="#main" className="skip">
        Skip to content
      </SiteLink>
      <BaseLayout
        bottom={
          <footer className="site-footer">
            <a className="brand-link" href="/" aria-label="IntLoom home">
              <img src={logo} alt="" />
            </a>
            <span>INTLOOM / 0.3.0</span>
            <SiteLink href="#top">Back to top</SiteLink>
            <button type="button" aria-pressed={paused} onClick={toggle}>
              Pause motion
            </button>
          </footer>
        }
      />
    </div>
  );
}
