import { Application, Bot, Terminal } from "@carbon/icons-react";
import type { CSSProperties } from "react";
import s from "./visuals.module.css";

const callers = [
  { label: "CLI", Icon: Terminal, x: 53 },
  { label: "App", Icon: Application, x: 120 },
  { label: "Agent", Icon: Bot, x: 187 },
] as const;

export function ReuseVisual() {
  return (
    <>
      <text className={s.small} x="120" y="42" textAnchor="middle">
        order-total@1.0.0
      </text>
      <path className={s.tile} d="m120 53 33 13v35l-33 14-33-14V66z" />
      <path
        className={s.accent}
        d="m87 66 33 14 33-14m-33 14v35m-16-56 32 14v10"
      />
      {callers.map(({ label, Icon, x }, i) => {
        const route = `M120 115v17H${x}v24`;
        return (
          <g key={label} style={{ "--delay": `${i * 0.28}s` } as CSSProperties}>
            <path className={s.guide} d={route} />
            <path className={s.dispatch} pathLength="1" d={route} />
            <rect
              className={s.tile}
              x={x - 23}
              y="156"
              width="46"
              height="33"
              rx="2"
            />
            <Icon className={s.glyph} x={x - 9} y="163" size={19} />
            <text className={s.label} x={x} y="205" textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}
    </>
  );
}
