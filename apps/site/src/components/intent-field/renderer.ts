export function mountIntentField(canvas: HTMLCanvasElement, intensity = 0.6) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const accent = getComputedStyle(canvas)
    .getPropertyValue("--site-color-accent")
    .trim();
  const shell = canvas.closest("[data-site-frame]");
  const surface =
    canvas.closest<HTMLElement>("[data-intent-surface]") ?? canvas;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const threshold = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const pointer = {
    x: 0.5,
    y: 0.65,
    targetX: 0.5,
    targetY: 0.65,
  };
  let ripples: { x: number; y: number; age: number; power: number }[] = [];
  let lastRipple = 0;
  let lastSource = { x: 0.5, y: 0.65 };
  let width = 1;
  let height = 1;
  let frame = 0;
  let visible = true;
  let time = 0;
  let previous = 0;
  let stopped = false;
  let hovering = false;
  let strength = 0;
  const isPaused = () =>
    shell?.getAttribute("data-paused") === "true" || media.matches;

  function draw() {
    if (!context) return;
    context.clearRect(0, 0, width, height);
    context.fillStyle = accent;
    const active = isPaused() ? 0 : strength;
    const step = Math.max(7, Math.sqrt((width * height) / 15000));
    const radius = Math.min(310, Math.max(180, height * 0.4));
    const radiusSquared = radius * radius;
    const px = pointer.x * width;
    const py = pointer.y * height;
    const brightness = 0.3 + active * 0.13;

    for (let col = 0, x = step / 2; x < width; col++, x += step) {
      const u = x / width;
      const first =
        0.68 +
        Math.sin(u * 7 + time * 0.28) * 0.13 +
        Math.cos(u * 12 - time * 0.12) * 0.06;
      const second = 0.66 + Math.sin(u * 5 - time * 0.21 + 2.4) * 0.16;
      for (let row = 0, y = step / 2; y < height; row++, y += step) {
        const v = y / height;
        const distance = Math.min(Math.abs(v - first), Math.abs(v - second));
        const ribbon = Math.exp(-(distance * distance) / 0.0033);
        const folds = (Math.sin(u * 19 + v * 26 + time * 0.5) + 1) / 2;
        const dx = x - px;
        const dy = y - py;
        const near = Math.exp(-(dx * dx + dy * dy) / radiusSquared) * active;
        let waveX = 0;
        let waveY = 0;
        let pulse = 0;
        for (const ripple of ripples) {
          const rx = x - ripple.x * width;
          const ry = y - ripple.y * height;
          const distance = Math.hypot(rx, ry);
          const front = distance - ripple.age * 440;
          // Waves keep travelling from their origin, even after the pointer leaves.
          const envelope =
            Math.exp(-ripple.age * 1.1) *
            ripple.power *
            Math.min(1, ripple.age * 8);
          const crest = Math.exp(-((front / 72) ** 2));
          const echo = Math.exp(-(((front + 100) / 55) ** 2)) * 0.35;
          pulse += (crest + echo) * envelope;
          const displacement =
            Math.sin(front * 0.023) * (crest + echo) * envelope * 35;
          waveX += (rx / Math.max(distance, 1)) * displacement;
          waveY += (ry / Math.max(distance, 1)) * displacement;
        }
        const light =
          ribbon * (0.25 + folds * 0.6) + near * 0.07 + pulse * 0.48;
        const cutoff = (threshold[(row % 4) * 4 + (col % 4)] ?? 0) / 16;
        if (light < cutoff * 0.9 + 0.08) continue;
        const size = step * (0.43 + Math.min(pulse, 1) * 0.08);
        context.globalAlpha = Math.min(
          0.85,
          (brightness * light + near * ribbon * 0.1 + pulse * 0.38) *
            (intensity / 0.6),
        );
        context.fillRect(
          x + waveX - size / 2,
          y + waveY - size / 2,
          size,
          size,
        );
      }
    }
    context.globalAlpha = 1;
  }

  function tick(now: number) {
    frame = 0;
    if (stopped || !visible || document.hidden || isPaused()) {
      previous = 0;
      return;
    }
    const delta = previous
      ? Math.max(0, Math.min((now - previous) / 1000, 0.05))
      : 0;
    previous = now;
    strength +=
      ((hovering ? 1 : 0) - strength) *
      (1 - Math.exp(-delta * (hovering ? 6.5 : 2.8)));
    time += delta * (0.32 + strength * 0.28);
    const dx = (pointer.targetX - pointer.x) * (1 - Math.exp(-delta * 28));
    const dy = (pointer.targetY - pointer.y) * (1 - Math.exp(-delta * 28));
    pointer.x += dx;
    pointer.y += dy;
    ripples = ripples.filter((ripple) => {
      ripple.age += delta;
      return ripple.age < 2.8;
    });
    draw();
    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (!stopped && !frame && visible && !document.hidden && !isPaused())
      frame = requestAnimationFrame(tick);
  }
  const leave = () => {
    hovering = false;
    pointer.targetX = pointer.x;
    pointer.targetY = pointer.y;
    start();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType === "touch" || isPaused()) return;
    const bounds = canvas.getBoundingClientRect();
    pointer.targetX = (event.clientX - bounds.left) / bounds.width;
    pointer.targetY = (event.clientY - bounds.top) / bounds.height;
    if (!hovering) {
      pointer.x = pointer.targetX;
      pointer.y = pointer.targetY;
      lastSource = { x: pointer.x, y: pointer.y };
    }
    const now = performance.now();
    const distance = Math.hypot(
      (pointer.targetX - lastSource.x) * width,
      (pointer.targetY - lastSource.y) * height,
    );
    if (distance > 45 && now - lastRipple > 100) {
      ripples.push({
        x: pointer.targetX,
        y: pointer.targetY,
        age: 0,
        power: 0.32,
      });
      if (ripples.length > 8) ripples.shift();
      lastRipple = now;
      lastSource = { x: pointer.targetX, y: pointer.targetY };
    }
    hovering = true;
    start();
  };
  const click = (event: MouseEvent) => {
    if (
      isPaused() ||
      (event.target instanceof Element &&
        event.target.closest("a, button, input, select, textarea, summary"))
    )
      return;
    const bounds = canvas.getBoundingClientRect();
    // Touch taps get a brief pulse without leaving a persistent hover state.
    strength = Math.max(strength, 0.8);
    ripples.push({
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
      age: 0,
      power: 1,
    });
    if (ripples.length > 8) ripples.shift();
    start();
  };
  const updateMotion = () => {
    if (isPaused()) {
      hovering = false;
      strength = 0;
      ripples.length = 0;
    }
    draw();
    start();
  };
  const updateVisibility = () => {
    if (document.hidden) leave();
    else start();
  };
  const resize = new ResizeObserver(([entry]) => {
    if (!entry) return;
    width = entry.contentRect.width;
    height = entry.contentRect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
    start();
  });
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    if (!visible) leave();
    else start();
  });
  const motion = new MutationObserver(updateMotion);
  resize.observe(canvas);
  visibility.observe(canvas);
  if (shell)
    motion.observe(shell, {
      attributes: true,
      attributeFilter: ["data-paused"],
    });
  surface.addEventListener("pointerenter", move, { passive: true });
  surface.addEventListener("pointermove", move, { passive: true });
  surface.addEventListener("pointerleave", leave);
  surface.addEventListener("pointercancel", leave);
  surface.addEventListener("click", click);
  window.addEventListener("blur", leave);
  document.addEventListener("visibilitychange", updateVisibility);
  media.addEventListener("change", updateMotion);
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    resize.disconnect();
    visibility.disconnect();
    motion.disconnect();
    surface.removeEventListener("pointerenter", move);
    surface.removeEventListener("pointermove", move);
    surface.removeEventListener("pointerleave", leave);
    surface.removeEventListener("pointercancel", leave);
    surface.removeEventListener("click", click);
    window.removeEventListener("blur", leave);
    document.removeEventListener("visibilitychange", updateVisibility);
    media.removeEventListener("change", updateMotion);
  };
}
