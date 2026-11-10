import { useContext, useEffect, useRef } from "react";
import { MotionPaused } from "../../motion/motion-provider.tsx";
import styles from "./text-effect.module.css";

export function ScrambledText({
  text,
  radius = 55,
  duration = 300,
}: {
  text: string;
  radius?: number;
  duration?: number;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const paused = useContext(MotionPaused);
  useEffect(() => {
    const element = root.current;
    if (!element || paused) return;
    const target = element.closest("a") ?? element;
    const glyphs = Array.from(
      element.querySelectorAll<HTMLElement>("[data-glyph]"),
    );
    const characters = Array.from(text);
    const until = glyphs.map(() => 0);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let frame = 0;
    let last = 0;
    function tick(now: number) {
      frame = 0;
      const active = until.some((end) => end > now);
      if (now - last > 45 || !active) {
        glyphs.forEach((glyph, i) => {
          glyph.textContent =
            (until[i] ?? 0) > now
              ? (alphabet[Math.floor(Math.random() * alphabet.length)] ?? "")
              : (characters[i] ?? "");
        });
        last = now;
      }
      if (active) frame = requestAnimationFrame(tick);
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const now = performance.now();
      glyphs.forEach((glyph, i) => {
        const box = glyph.getBoundingClientRect();
        const distance = Math.abs(event.clientX - box.left - box.width / 2);
        if (distance < radius && /[a-z0-9]/i.test(characters[i] ?? ""))
          until[i] = now + duration * (1 - distance / radius);
      });
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const leave = () => {
      const end = performance.now() + 90;
      until.forEach((value, i) => {
        until[i] = Math.min(value, end);
      });
    };
    target.addEventListener("pointerenter", move, { passive: true });
    target.addEventListener("pointermove", move, { passive: true });
    target.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      target.removeEventListener("pointerenter", move);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerleave", leave);
      glyphs.forEach((glyph, i) => {
        glyph.textContent = characters[i] ?? "";
      });
    };
  }, [text, radius, duration, paused]);
  return (
    <span className={styles.text} ref={root}>
      <span className={styles.accessible}>{text}</span>
      <span aria-hidden="true">
        {Array.from(text.matchAll(/\S+\s*|\s+/g), (match) => (
          <span className={styles.word} key={`${text}-${match.index}`}>
            {Array.from(match[0], (character, index) => (
              <span
                className={styles.character}
                // biome-ignore lint/suspicious/noArrayIndexKey: Character slots keep their original width while the glyph changes.
                key={`${match.index}-${index}`}
              >
                <span className={styles.measure}>{character}</span>
                <span className={styles.glyph} data-glyph>
                  {character}
                </span>
              </span>
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}
