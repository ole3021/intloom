import { animate } from "motion/mini";
import { useEffect, useRef } from "react";
import {
  brandColors,
  brandShapes,
  getBrandAnimation,
  getBrandColor,
  type BrandState,
  type BrandVariant,
} from "./brand-motion.ts";

export type BrandMarkProps = {
  variant?: BrandVariant;
  state?: BrandState;
  paused?: boolean;
  speed?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
  label?: string;
};

// Reusable brand animation for future React web, desktop WebView, and mobile web
// consumers. This renders an inline icon; it does not animate browser tab favicons.
// Consumers supply application state, shared pause controls, and an accessible
// label when needed. No current page uses this component.
export function BrandMark({
  variant = "logo",
  state = "idle",
  paused = false,
  speed = 1,
  width,
  height,
  className,
  label,
}: BrandMarkProps) {
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new RangeError("BrandMark speed must be a finite positive number.");
  }

  const ref = useRef<SVGSVGElement>(null);
  const shape = brandShapes[variant];
  const animation = getBrandAnimation(variant, state);
  const color = getBrandColor(variant, state);
  const paths =
    animation === null || animation.tracks.length === 1
      ? shape.paths.slice(0, 1)
      : shape.paths;

  useEffect(() => {
    const svg = ref.current;
    if (!svg || !animation) return;

    const layers = Array.from(
      svg.querySelectorAll<SVGPathElement>("[data-brand-overlay]"),
    );
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let controls: ReturnType<typeof animate>[] = [];
    const stop = () => {
      for (const control of controls) control.cancel();
      controls = [];
      for (const layer of layers) layer.style.removeProperty("opacity");
    };
    const update = () => {
      stop();
      if (paused || media.matches) return;

      layers.forEach((layer, index) => {
        const track = animation.tracks[index];
        if (!track) {
          throw new Error(
            "BrandMark geometry does not match animation tracks.",
          );
        }
        controls.push(
          animate(
            layer,
            { opacity: [...track] },
            {
              duration: animation.duration / speed,
              times: [...animation.times],
              ease: animation.ease,
              repeat: Number.POSITIVE_INFINITY,
            },
          ),
        );
      });
    };

    update();
    media.addEventListener("change", update);
    return () => {
      media.removeEventListener("change", update);
      stop();
    };
  }, [animation, paused, speed]);

  return (
    <svg
      ref={ref}
      className={className}
      width={width ?? shape.width}
      height={height ?? shape.height}
      viewBox={shape.viewBox}
      fill="none"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {shape.paths.map((d) => (
        <path key={d} d={d} fill={brandColors.base} />
      ))}
      {paths.map((d, index) => (
        <path
          key={d}
          d={d}
          fill={color}
          opacity={animation?.tracks.length === 3 && index !== 0 ? 0.2 : 1}
          data-brand-overlay=""
        />
      ))}
    </svg>
  );
}
