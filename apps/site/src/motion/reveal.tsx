import { inView, stagger } from "motion";
import { animate } from "motion/mini";
import {
  useContext,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
} from "react";
import { MotionPaused } from "./motion-provider.tsx";

const enterEase = [0.22, 1, 0.36, 1] as const;

function enterContent(element: HTMLElement, compact = false) {
  const children = Array.from(element.children) as (HTMLElement | SVGElement)[];
  const styles = children.map((child) => ({
    opacity: child.style.opacity,
    transform: child.style.transform,
  }));
  const restore = () => {
    children.forEach((child, index) => {
      const style = styles[index];
      if (style) Object.assign(child.style, style);
    });
  };
  const animation = animate(
    children,
    {
      opacity: [0.25, 1],
      transform: [`translateY(${compact ? 10 : 20}px)`, "translateY(0px)"],
    },
    {
      duration: compact ? 0.4 : 0.7,
      delay: stagger(compact ? 0.035 : 0.07),
      ease: enterEase,
    },
  );
  void animation.then(restore);
  return () => {
    animation.cancel();
    restore();
  };
}

export function usePageMotion(paused: boolean, pathname: string) {
  const ref = useRef<HTMLDivElement>(null);
  const revealed = useRef(new WeakSet<Element>());

  // Observe the new page elements after client-side navigation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: The route changes the observed subtree without replacing the frame.
  useEffect(() => {
    const page = ref.current;
    if (
      !page ||
      paused ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;

    const cleanups: (() => void)[] = [];
    const stop = inView(
      Array.from(page.querySelectorAll<HTMLElement>("[data-reveal]")),
      (element) => {
        if (revealed.current.has(element)) return;
        revealed.current.add(element);
        cleanups.push(enterContent(element as HTMLElement));
      },
      { margin: "0px 0px -8% 0px" },
    );

    return () => {
      stop();
      // Restore normal styles so pausing never freezes partially hidden content.
      for (const cleanup of cleanups) cleanup();
    };
  }, [paused, pathname]);

  return ref;
}

export function MotionContent({
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  const paused = useContext(MotionPaused);

  useEffect(() => {
    if (
      !ref.current ||
      paused ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    return enterContent(ref.current, true);
  }, [paused]);

  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}
