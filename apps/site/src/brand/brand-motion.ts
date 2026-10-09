// Shared brand motion definitions for future logo and icon consumers.
// Intentionally not connected to any current page or application state.
export type BrandState = "idle" | "loading" | "waiting" | "warning";
export type BrandVariant = "logo" | "icon";

// Inline SVG geometry mirrors assets/logo.svg and assets/favicon.svg.
export const brandShapes = {
  logo: {
    width: 340,
    height: 130,
    viewBox: "0 0 340 130",
    green: "#0EC614",
    paths: [
      "M0 70L70.6023 0H120V60L50.0726 130H0V70Z",
      "M110 70L180.602 0H230V60L160.073 130H110V70Z",
      "M220 70L290.602 0H340V60L270.073 130H220V70Z",
    ],
  },
  icon: {
    width: 180,
    height: 180,
    viewBox: "0 0 180 180",
    green: "#0BAF29",
    paths: ["M40 94.1538L98.8353 36H140V85.8462L81.7271 144H40V94.1538Z"],
  },
} as const;

export const brandColors = {
  base: "#F7F7FB",
  waiting: "#FACC15",
  warning: "#FF4D4F",
} as const;

export const brandAnimations = {
  scan: {
    duration: 1.92,
    ease: "linear",
    times: [0, 0.04, 0.08, 0.12, 0.16, 0.34, 0.56, 0.66, 0.88, 1],
    // Start with the left fade-in; matching endpoints avoid a jump on repeat.
    tracks: [
      [0.2, 0.317157, 0.6, 0.882843, 1, 1, 0.65, 0.2, 0.2, 0.2],
      [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 1, 1, 0.65, 0.2],
      [1, 0.882843, 0.6, 0.317157, 0.2, 0.2, 0.2, 0.2, 1, 1],
    ],
  },
  pulse: {
    duration: 0.8,
    ease: "easeInOut",
    times: [0, 0.5, 1],
    tracks: [[1, 0.3, 1]],
  },
} as const;

export function getBrandAnimation(variant: BrandVariant, state: BrandState) {
  if (state === "idle") return null;
  return variant === "logo" && state === "loading"
    ? brandAnimations.scan
    : brandAnimations.pulse;
}

export function getBrandColor(variant: BrandVariant, state: BrandState) {
  if (state === "waiting") return brandColors.waiting;
  if (state === "warning") return brandColors.warning;
  return brandShapes[variant].green;
}
