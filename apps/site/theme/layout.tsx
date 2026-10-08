import { usePage } from "@rspress/core/runtime";
import { Layout as OriginalLayout } from "@rspress/core/theme-original";
import { MotionProvider } from "../src/motion/motion-provider.tsx";
import { SiteFrame } from "../src/components/site-frame.tsx";
import { SiteFooter } from "../src/components/site-footer.tsx";

export function Layout() {
  const { page } = usePage();
  const document = page.pageType === "doc" || page.pageType === "doc-wide";
  return (
    <MotionProvider>
      <SiteFrame document={document}>
        <OriginalLayout
          beforeDocContent={<div id="main" tabIndex={-1} />}
          bottom={<SiteFooter />}
        />
      </SiteFrame>
    </MotionProvider>
  );
}
