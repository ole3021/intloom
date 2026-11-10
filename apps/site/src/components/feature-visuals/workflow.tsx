import s from "./visuals.module.css";

export function WorkflowVisual() {
  return (
    <>
      <rect
        className={s.boundary}
        x="32"
        y="39"
        width="176"
        height="73"
        rx="3"
      />
      <text className={s.small} x="41" y="54">
        AGENT
      </text>
      <rect className={s.tile} x="43" y="65" width="55" height="29" rx="2" />
      <rect className={s.tile} x="142" y="65" width="55" height="29" rx="2" />
      <text className={s.label} x="70" y="83" textAnchor="middle">
        Read
      </text>
      <text className={s.label} x="169" y="83" textAnchor="middle">
        Draft
      </text>
      <path
        className={s.guide}
        d="M99 74h40m-5-4 5 4-5 4m7 8h-40m5-4-5 4 5 4"
      />
      <path className={s.explore} d="M99 74h40m1 12h-39" />
      <path className={s.guide} d="M120 112v19m0 31v26" />
      <rect className={s.gate} x="57" y="131" width="126" height="31" rx="2" />
      <path className={s.accent} d="m67 147 3 3 6-7" />
      <text className={s.label} x="124" y="150" textAnchor="middle">
        Approve outline
      </text>
      <path className={s.afterGate} pathLength="1" d="M120 162v25" />
      <g className={s.exportDeck}>
        <rect className={s.tile} x="73" y="186" width="94" height="23" rx="2" />
        <text className={s.label} x="120" y="201" textAnchor="middle">
          Export deck
        </text>
      </g>
    </>
  );
}
