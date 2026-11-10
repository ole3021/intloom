import { useContext, useEffect, useRef, type ReactNode } from "react";
import { MotionPaused } from "../../motion/motion-provider.tsx";
import styles from "./animated-list.module.css";

export function AnimatedList({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const seen = useRef(new WeakSet<Element>());
  const paused = useContext(MotionPaused);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Filtering replaces DOM rows that must be observed again.
  useEffect(() => {
    const element = root.current;
    const list = element?.querySelector("ul");
    const highlight = element?.querySelector<HTMLElement>(
      "[data-list-highlight]",
    );
    if (!element || !list || !highlight) return;
    const rows = Array.from(list.children) as HTMLElement[];
    const animations: Animation[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, index) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          if (paused || seen.current.has(entry.target)) return;
          seen.current.add(entry.target);
          animations.push(
            entry.target.animate(
              [
                { opacity: 0, transform: "translateY(18px) scale(0.985)" },
                {
                  opacity: 1,
                  transform: "translateY(-2px) scale(1)",
                  offset: 0.8,
                },
                { opacity: 1, transform: "translateY(0) scale(1)" },
              ],
              {
                duration: 480,
                delay: Math.min(index, 5) * 65,
                easing: "cubic-bezier(.22,1,.36,1)",
                fill: "backwards",
              },
            ),
          );
        });
      },
      { threshold: 0.12 },
    );
    rows.forEach((row) => {
      observer.observe(row);
    });
    const show = (target: EventTarget | null) => {
      const row = target instanceof Element ? target.closest("li") : null;
      if (!row || !list.contains(row)) {
        highlight.style.opacity = "0";
        return;
      }
      highlight.style.height = `${row.clientHeight}px`;
      highlight.style.transform = `translateY(${row.offsetTop}px)`;
      highlight.style.opacity = "1";
    };
    const enter = (event: Event) => show(event.target);
    const leave = () =>
      show(
        element.contains(document.activeElement)
          ? document.activeElement
          : null,
      );
    const blur = (event: FocusEvent) => show(event.relatedTarget);
    const keydown = (event: KeyboardEvent) => {
      const buttons = Array.from(
        list.querySelectorAll<HTMLButtonElement>("li > button"),
      );
      const current = buttons.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      if (current < 0) return;
      if (event.key === "Enter" || event.key === " ") {
        event.stopPropagation();
        return;
      }
      let next = current;
      if (event.key === "ArrowDown")
        next = Math.min(buttons.length - 1, current + 1);
      else if (event.key === "ArrowUp") next = Math.max(0, current - 1);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = buttons.length - 1;
      else return;
      event.preventDefault();
      event.stopPropagation();
      buttons[next]?.focus({ preventScroll: true });
      buttons[next]?.scrollIntoView({
        block: "nearest",
        behavior: paused ? "instant" : "smooth",
      });
    };
    const resize = new ResizeObserver(leave);
    resize.observe(list);
    element.addEventListener("pointerover", enter);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("focusin", enter);
    element.addEventListener("focusout", blur);
    element.addEventListener("keydown", keydown);
    return () => {
      observer.disconnect();
      resize.disconnect();
      animations.forEach((animation) => {
        animation.cancel();
      });
      element.removeEventListener("pointerover", enter);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("focusin", enter);
      element.removeEventListener("focusout", blur);
      element.removeEventListener("keydown", keydown);
    };
  }, [children, paused]);
  return (
    <div ref={root} className={styles.root}>
      <div
        className={styles.highlight}
        data-list-highlight
        aria-hidden="true"
      />
      <ul className={`${styles.list} ${className}`}>{children}</ul>
    </div>
  );
}
