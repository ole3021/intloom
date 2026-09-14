import styles from "./convergence.module.css";
import { useEffect, useRef } from "react";
import { createConvergence } from "./convergence-renderer";

export function Convergence({
  paused,
  squeeze,
}: {
  paused: boolean;
  squeeze: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createConvergence>>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createConvergence(canvas);
    rendererRef.current = renderer;
    return () => {
      renderer?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.update({ paused, squeeze });
  }, [paused, squeeze]);

  return (
    <canvas
      className={styles.root}
      ref={canvasRef}
      role="img"
      aria-label="分散的线条经由澄清聚合成明确方向"
    />
  );
}
