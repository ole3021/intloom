import { useContext, useEffect, useRef, useState } from "react";
import { MotionPaused } from "../../motion/motion-provider.tsx";
import styles from "./scroll-velocity.module.css";

export function ScrollVelocity({
  texts,
  velocity = 28,
}: {
  texts: readonly string[];
  velocity?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const [copies, setCopies] = useState(3);
  const paused = useContext(MotionPaused);
  useEffect(() => {
    const element = root.current;
    const strip = track.current;
    const group = strip?.firstElementChild;
    if (!element || !strip || !group) return;
    let groupWidth = 1;
    let frame = 0;
    let previous = 0;
    let lastY = window.scrollY;
    let speed = 0;
    let visible = false;
    const resize = new ResizeObserver(() => {
      groupWidth = group.getBoundingClientRect().width;
      if (groupWidth > 0)
        setCopies(Math.max(2, Math.ceil(element.clientWidth / groupWidth) + 2));
    });
    const tick = (now: number) => {
      frame = 0;
      if (!visible || document.hidden || paused) {
        previous = 0;
        return;
      }
      const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      const travel = window.scrollY - lastY;
      lastY = window.scrollY;
      const target = delta > 0 ? Math.min(1400, Math.abs(travel) / delta) : 0;
      speed += (target - speed) * (1 - Math.exp(-delta * 6));
      offset.current -= velocity * (1 + (speed / 1400) * 0.6) * delta;
      offset.current =
        ((offset.current % groupWidth) + groupWidth) % groupWidth;
      strip.style.transform = `translate3d(${offset.current - groupWidth}px, 0, 0)`;
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      lastY = window.scrollY;
      previous = 0;
      if (!frame && visible && !document.hidden && !paused)
        frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      start();
    });
    resize.observe(group);
    resize.observe(element);
    observer.observe(element);
    document.addEventListener("visibilitychange", start);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", start);
    };
  }, [paused, velocity]);
  return (
    <div className={styles.viewport} ref={root}>
      <span className="sr-only">{texts.join(". ")}</span>
      <div className={styles.track} ref={track} aria-hidden="true">
        {Array.from({ length: copies }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Identical marquee copies are stable positional slots.
          <div className={styles.group} key={`copy-${index}`}>
            {texts.map((text) => (
              <span className={styles.item} key={text}>
                {text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
