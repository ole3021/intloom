import assert from "node:assert/strict";
import test from "node:test";
import { createConvergence } from "../components/key-visuals/convergence/convergence-renderer.ts";

// A deterministic clock and Canvas command recorder exercise lifecycle behavior
// without pixel snapshots or a browser-specific drawing implementation.
function setup(t) {
  const frames = new Map();
  let nextId = 0;
  let drawing = [];
  const targets = [];
  function target(extra = {}) {
    const listeners = new Map();
    const result = {
      ...extra,
      addEventListener(name, callback) {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(callback);
      },
      removeEventListener(name, callback) {
        listeners.get(name)?.delete(callback);
      },
      emit(name, event) {
        for (const callback of listeners.get(name) ?? []) callback(event);
      },
      listenerCount: () =>
        [...listeners.values()].reduce((n, set) => n + set.size, 0),
    };
    targets.push(result);
    return result;
  }
  const context = {
    clearRect() {
      drawing = [];
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    fillRect() {},
    beginPath() {},
    moveTo(x, y) {
      drawing.push([x, y]);
    },
    lineTo(x, y) {
      drawing.push([x, y]);
    },
    stroke() {},
    ellipse() {},
    arc() {},
    fill() {},
    setTransform() {},
  };
  const canvas = target({
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 160, height: 100, left: 0, top: 0 }),
  });
  const reduced = target({ matches: false });
  const page = target({ hidden: false });
  const observers = [];
  class Observer {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observers.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  }
  const replacements = {
    window: { matchMedia: () => reduced, devicePixelRatio: 3 },
    document: page,
    ResizeObserver: Observer,
    IntersectionObserver: Observer,
    requestAnimationFrame(callback) {
      frames.set(++nextId, callback);
      return nextId;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  };
  const restorers = [];
  for (const [key, value] of Object.entries(replacements)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    restorers.push(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    });
  }
  const renderer = createConvergence(canvas);
  t.after(() => {
    renderer.dispose();
    for (const restore of restorers) restore();
  });
  return {
    renderer,
    canvas,
    reduced,
    page,
    observers,
    targets,
    pending: () => frames.size,
    picture: () => structuredClone(drawing),
    tick(now) {
      assert.equal(frames.size, 1, "only one frame loop may be pending");
      const [id, callback] = frames.entries().next().value;
      frames.delete(id);
      callback(now);
    },
  };
}

test("pause, phase changes and resume preserve the current animation clock", (t) => {
  const f = setup(t);
  const update = (paused, squeeze = 0.17) =>
    f.renderer.update({ paused, squeeze });
  update(false);
  f.canvas.emit("pointermove", {
    pointerType: "mouse",
    clientX: 120,
    clientY: 80,
  });
  f.tick(984);
  const initial = f.picture();
  f.tick(1000);
  f.tick(1016);
  const advanced = f.picture();
  assert.notDeepEqual(advanced, initial);
  update(true);
  assert.equal(f.pending(), 0);
  assert.deepEqual(f.picture(), advanced, "pause must not reset the drawing");
  f.canvas.emit("pointerleave");
  update(true, 0.035);
  assert.notDeepEqual(f.picture(), advanced);
  update(true);
  assert.deepEqual(f.picture(), advanced, "phase changes must not reset time");
  update(false);
  f.tick(20000);
  assert.deepEqual(
    f.picture(),
    advanced,
    "resume must exclude paused wall time",
  );
  f.tick(20016);
  assert.notDeepEqual(f.picture(), advanced);
  assert.equal(f.observers.length, 2, "updates must reuse observers");
  assert.equal(f.canvas.width, 320, "pixel ratio remains capped at two");
});

test("visibility and reduced motion stop drawing; disposal releases resources", (t) => {
  const f = setup(t);
  f.renderer.update({ paused: false, squeeze: 0.17 });
  const intersection = f.observers[1];
  intersection.callback([{ isIntersecting: false }]);
  assert.equal(f.pending(), 0);
  intersection.callback([{ isIntersecting: true }]);
  assert.equal(f.pending(), 1);
  f.page.hidden = true;
  f.page.emit("visibilitychange");
  assert.equal(f.pending(), 0);
  f.page.hidden = false;
  f.page.emit("visibilitychange");
  assert.equal(f.pending(), 1);
  f.reduced.matches = true;
  f.reduced.emit("change");
  assert.equal(f.pending(), 0);
  f.reduced.matches = false;
  f.reduced.emit("change");
  assert.equal(f.pending(), 1);
  f.renderer.update({ paused: true, squeeze: 0.17 });
  intersection.callback([{ isIntersecting: false }]);
  intersection.callback([{ isIntersecting: true }]);
  assert.equal(f.pending(), 0, "visibility must not override manual pause");
  f.renderer.update({ paused: false, squeeze: 0.17 });
  f.renderer.dispose();
  assert.equal(f.pending(), 0);
  assert.ok(f.observers.every((observer) => observer.disconnected));
  assert.ok(f.targets.every((target) => target.listenerCount() === 0));
});
