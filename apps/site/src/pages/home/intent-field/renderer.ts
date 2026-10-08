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
  let width = 1;
  let height = 1;
  let frame = 0;
  let visible = true;
  let time = 0;
  let previous = 0;
  let stopped = false;
  let hovering = false;
  let strength = 0;
  let releaseStrength = 0;
  let releaseElapsed = 0;
  let rotation = 0;
  let idleDelay = 1.2;
  let idleRipple: { x: number; y: number; age: number } | undefined;
  const idleDuration = 5.8;
  const rotationLimit = (17 * Math.PI) / 180;
  const pointer = { x: 0.5, y: 0.62, targetX: 0.5, targetY: 0.62 };
  const isPaused = () =>
    shell?.getAttribute("data-paused") === "true" || media.matches;

  function draw() {
    if (!context) return;
    context.clearRect(0, 0, width, height);
    const cx = width * 0.5;
    const cy = height * 0.56;
    const depthScale = height * 0.48;
    const perspectiveStrength = 0.3;
    const tilt = -0.085;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    // Keep overscan rows in front of the perspective horizon on wide screens.
    const perspectiveAt = (y: number) =>
      Math.max(0.25, 1 - ((cy - y) * perspectiveStrength) / depthScale);
    function sourceOnPlane(source: { x: number; y: number }) {
      const dx = source.x * width - cx;
      const dy = source.y * height - cy;
      const x = dx * cosine + dy * sine;
      const y = cy - dx * sine + dy * cosine - x * tilt;
      // Invert rotation and perspective to keep each ripple anchored on screen.
      const scale = perspectiveAt(y);
      const depth = (1 / scale - 1) / perspectiveStrength;
      return { x: x / scale - depth * 45, depth };
    }
    const source = sourceOnPlane(pointer);
    const idleSource = idleRipple && sourceOnPlane(idleRipple);
    const idleAge = idleRipple?.age ?? 0;
    const idleStrength = Math.sin((Math.PI * idleAge) / idleDuration) ** 2;
    const amplitude = 54 + intensity * 32;
    const reach = Math.max(600, width * 0.48);

    context.save();
    context.translate(cx, cy);
    context.rotate(rotation);
    context.translate(-cx, -cy);
    const overscan =
      (Math.abs(tilt) + Math.sin(rotationLimit)) * width * 0.5 + amplitude * 2;
    const sideOverscan = (height + overscan) * Math.sin(rotationLimit) + 32;
    let baseY = -overscan;
    while (baseY < height + overscan) {
      const perspective = perspectiveAt(baseY);
      const depth = (1 / perspective - 1) / perspectiveStrength;
      const spacing = 32 * perspective;
      // Size each row to the viewport, with extra columns beyond both edges.
      const first =
        Math.floor(((-cx - sideOverscan) / perspective - depth * 45) / 32) - 2;
      const last =
        Math.ceil(
          ((width - cx + sideOverscan) / perspective - depth * 45) / 32,
        ) + 2;
      for (let col = first; col <= last; col++) {
        const x = col * 32;
        const radius = Math.hypot(x - source.x, (depth - source.depth) * 280);
        const ripple = Math.sin(radius * 0.014 - time * 2.4);
        const envelope = Math.exp(-radius / reach);
        let ambientWave = 0;
        let ambientGlow = 0;
        if (idleSource) {
          const distance = Math.hypot(
            x - idleSource.x,
            (depth - idleSource.depth) * 280,
          );
          const front = distance - idleAge * 150;
          const pulse = Math.exp(-((front / 160) ** 2)) * idleStrength;
          ambientWave = Math.cos(front * 0.018) * amplitude * 0.12 * pulse;
          ambientGlow = pulse * 0.045;
        }
        const wave = ripple * amplitude * envelope * strength + ambientWave;
        const px = cx + col * spacing + depth * 45 * perspective;
        const py = baseY + (px - cx) * tilt - wave * perspective;
        const alpha =
          0.2 + (ripple + 1) * 0.24 * envelope * strength + ambientGlow;
        context.fillStyle = accent;
        context.globalAlpha = alpha;
        const size = Math.min(8, Math.max(1.8, 4.6 * perspective));
        context.fillRect(px - size / 2, py - size / 2, size, size);
      }
      baseY += 22 * perspective;
    }
    context.restore();
  }
  function tick(now: number) {
    if (stopped) return;
    frame = 0;
    if (!visible || document.hidden || isPaused()) {
      previous = 0;
      return;
    }
    const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
    time += delta;
    previous = now;
    const targetRotation = hovering
      ? (pointer.targetX - 0.5) * rotationLimit * 2
      : 0;
    rotation += (targetRotation - rotation) * (1 - Math.exp(-delta * 3.5));
    if (hovering) {
      strength = Math.min(1, strength + delta * 2.5);
      const dx = (pointer.targetX - pointer.x) * width;
      const dy = (pointer.targetY - pointer.y) * height;
      const distance = Math.hypot(dx, dy);
      // Travel at 280 CSS pixels per second, independent of pointer distance and frame rate.
      const travel = distance > 0 ? Math.min(1, (280 * delta) / distance) : 0;
      pointer.x += (dx * travel) / width;
      pointer.y += (dy * travel) / height;
    } else {
      releaseElapsed += delta;
      const progress = Math.min(1, releaseElapsed / 2.6);
      strength =
        releaseStrength * (1 - progress * progress * (3 - 2 * progress));
    }
    if (idleRipple) {
      idleRipple.age += delta;
      if (idleRipple.age >= idleDuration) {
        idleRipple = undefined;
        idleDelay = 1.5 + Math.random() * 2;
      }
    } else if (!hovering && strength === 0) {
      idleDelay -= delta;
      if (idleDelay <= 0) {
        idleRipple = {
          x: 0.12 + Math.random() * 0.76,
          y: 0.3 + Math.random() * 0.58,
          age: 0,
        };
      }
    }
    draw();
    frame = requestAnimationFrame(tick);
  }
  function start() {
    if (!frame && visible && !document.hidden && !isPaused())
      frame = requestAnimationFrame(tick);
  }
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
    start();
  });
  const motion = new MutationObserver(() => {
    draw();
    start();
  });
  const move = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    pointer.targetX = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width),
    );
    pointer.targetY = Math.max(
      0,
      Math.min(1, (event.clientY - bounds.top) / bounds.height),
    );
    if (strength === 0) {
      pointer.x = pointer.targetX;
      pointer.y = pointer.targetY;
    }
    hovering = true;
    start();
  };
  const leave = () => {
    if (!hovering) return;
    hovering = false;
    pointer.targetX = pointer.x;
    pointer.targetY = pointer.y;
    releaseStrength = strength;
    releaseElapsed = 0;
    idleDelay = 1.2;
    start();
  };
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
  window.addEventListener("blur", leave);
  document.addEventListener("visibilitychange", start);
  media.addEventListener("change", start);
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
    window.removeEventListener("blur", leave);
    document.removeEventListener("visibilitychange", start);
    media.removeEventListener("change", start);
  };
}
