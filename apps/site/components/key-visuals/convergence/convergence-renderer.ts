// Homepage-only Canvas renderer. Updates preserve the clock and pointer position.
export function createConvergence(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let paused = true;
  let squeeze = 0.17;
  let width = 1;
  let height = 1;
  let frame = 0;
  let visible = true;
  let pointerX = 0;
  let pointerY = 0;
  let time = 0;
  let previousTime = 0;
  function draw() {
    if (!context) return;
    context.clearRect(0, 0, width, height);
    const centerX = width * 0.5 + pointerX * 0.035;
    const centerY = height * 0.5 + pointerY * 0.035;
    const radius = Math.min(width * 0.17, height * 0.4);
    const glow = context.createRadialGradient(
      centerX,
      centerY,
      1,
      centerX,
      centerY,
      radius * 1.6,
    );
    glow.addColorStop(0, "rgba(119,159,255,0.14)");
    glow.addColorStop(0.5, "rgba(107,119,222,0.05)");
    glow.addColorStop(1, "rgba(70,99,160,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    for (let line = 0; line < 66; line++) {
      const offset = (line - 32.5) / 32.5;
      context.beginPath();
      for (let x = -8; x <= width + 8; x += 8) {
        const progress = x / width;
        const distance = (progress - 0.5) * 5;
        const pull = Math.exp(-distance * distance);
        const wave = Math.sin(progress * 9 + offset * 3 + time * 0.22) * 12;
        const spread = height * 0.45 * (1 - pull * (1 - squeeze));
        const y =
          centerY +
          offset * spread +
          wave * (1 - pull) +
          Math.sin(offset * 5 + time * 0.12) * pull * 6;
        if (x === -8) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle =
        line % 9 === 0
          ? "rgba(185,209,255,0.64)"
          : `rgba(${130 + line},${149 + line},255,0.24)`;
      context.lineWidth = line % 9 === 0 ? 1.2 : 0.65;
      context.stroke();
    }
    context.beginPath();
    context.ellipse(centerX, centerY, radius * 0.46, radius, 0, 0, Math.PI * 2);
    context.strokeStyle = "rgba(170,187,255,0.26)";
    context.lineWidth = 1;
    context.stroke();
    context.beginPath();
    context.arc(centerX, centerY, 3, 0, Math.PI * 2);
    context.fillStyle = "#d8e4ff";
    context.fill();
  }
  function tick(now: number) {
    if (previousTime) time += Math.min((now - previousTime) / 1000, 0.05);
    previousTime = now;
    draw();
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    previousTime = 0;
    draw();
    if (!paused && !reduced.matches && visible && !document.hidden)
      frame = requestAnimationFrame(tick);
  }
  function resize() {
    if (!context) return;
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(bounds.width, 1);
    height = Math.max(bounds.height, 1);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    sync();
  }
  function pointer(event: PointerEvent) {
    if (paused || reduced.matches || event.pointerType === "touch") return;
    const bounds = canvas.getBoundingClientRect();
    pointerX = event.clientX - bounds.left - width / 2;
    pointerY = event.clientY - bounds.top - height / 2;
  }
  function resetPointer() {
    if (paused || reduced.matches) return;
    pointerX = 0;
    pointerY = 0;
  }
  const resizeObserver = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    sync();
  });
  resizeObserver.observe(canvas);
  intersection.observe(canvas);
  reduced.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  canvas.addEventListener("pointermove", pointer);
  canvas.addEventListener("pointerleave", resetPointer);
  resize();
  return {
    update(options: { paused: boolean; squeeze: number }) {
      paused = options.paused;
      squeeze = options.squeeze;
      sync();
    },
    dispose() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      canvas.removeEventListener("pointermove", pointer);
      canvas.removeEventListener("pointerleave", resetPointer);
    },
  };
}
