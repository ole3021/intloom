import { useContext, useEffect, useRef } from "react";
import { MotionPaused } from "../../motion/motion-provider.tsx";
import styles from "./text-effect.module.css";

export function DecryptedText({
  text,
  duration = 650,
}: {
  text: string;
  duration?: number;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const played = useRef<string | null>(null);
  const paused = useContext(MotionPaused);
  useEffect(() => {
    const element = root.current;
    if (!element || paused || played.current === text) return;
    const glyphs = element.querySelectorAll<HTMLElement>("[data-glyph]");
    const characters = Array.from(text);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let frame = 0;
    let start = 0;
    let last = 0;
    function tick(now: number) {
      start ||= now;
      const progress = Math.min(1, (now - start) / duration);
      if (now - last > 40 || progress === 1) {
        glyphs.forEach((glyph, i) => {
          const original = characters[i] ?? "";
          glyph.textContent =
            i < progress * characters.length || /\s/.test(original)
              ? original
              : (alphabet[Math.floor(Math.random() * alphabet.length)] ??
                original);
        });
        last = now;
      }
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        played.current = text;
        frame = requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      glyphs.forEach((glyph, i) => {
        glyph.textContent = characters[i] ?? "";
      });
    };
  }, [text, duration, paused]);
  return (
    <span className={styles.text} ref={root}>
      <span className={styles.accessible}>{text}</span>
      <span aria-hidden="true">
        {Array.from(text, (character, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Each fixed character slot is identified by the text and its position.
          <span className={styles.character} key={`${text}-${index}`}>
            <span className={styles.measure}>{character}</span>
            <span className={styles.glyph} data-glyph>
              {character}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
