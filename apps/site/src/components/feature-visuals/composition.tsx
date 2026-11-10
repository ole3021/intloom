import { Bot, Code, Notebook, ToolKit } from "@carbon/icons-react";
import type { CSSProperties } from "react";
import s from "./visuals.module.css";

const parts = [
  { label: "Agent", Icon: Bot, x: 52, y: 57, dx: -16, dy: -12 },
  { label: "Skill", Icon: Notebook, x: 123, y: 57, dx: 16, dy: -12 },
  { label: "Tool", Icon: ToolKit, x: 52, y: 108, dx: -16, dy: 12 },
  { label: "Code", Icon: Code, x: 123, y: 108, dx: 16, dy: 12 },
] as const;

export function CompositionVisual() {
  return (
    <>
      <rect className={s.plate} x="42" y="45" width="156" height="147" rx="3" />
      <path className={s.guide} d="M42 161h156M31 100h11m156 0h11" />
      <circle className={s.contact} cx="30" cy="100" r="2.5" />
      <circle className={s.contact} cx="210" cy="100" r="2.5" />
      {parts.map(({ label, Icon, x, y, dx, dy }) => (
        <g key={label} transform={`translate(${x} ${y})`}>
          <g
            className={s.assemble}
            style={{ "--dx": `${dx}px`, "--dy": `${dy}px` } as CSSProperties}
          >
            <rect className={s.tile} width="65" height="45" rx="2" />
            <Icon className={s.glyph} x="23" y="4" size={19} />
            <text className={s.label} x="32.5" y="37" textAnchor="middle">
              {label}
            </text>
          </g>
        </g>
      ))}
      <text className={s.small} x="55" y="180">
        REPORT LOOM
      </text>
      <g className={s.seal}>
        <path className={s.accent} d="m167 175 4 4 8-9" />
        <circle className={s.contact} cx="186" cy="176" r="2" />
      </g>
    </>
  );
}
