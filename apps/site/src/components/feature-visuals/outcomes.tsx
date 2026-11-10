import s from "./visuals.module.css";

export function OutcomeVisual() {
  return (
    <>
      <path className={s.plate} d="M48 36h117l27 27v139H48z" />
      <path className={s.guide} d="M165 36v27h27M59 81h122M59 156h122" />
      <text className={s.small} x="61" y="53">
        DELIVERABLE
      </text>
      <text className={s.name} x="61" y="72">
        report.md
      </text>
      {["File format", "Sections"].map((criterion, i) => (
        <g key={criterion} transform={`translate(0 ${i * 31})`}>
          <rect
            className={s.tile}
            x="62"
            y="93"
            width="15"
            height="15"
            rx="1"
          />
          <path
            className={i === 0 ? s.checkFormat : s.checkSections}
            pathLength="1"
            d="m65 100 3 4 7-8"
          />
          <text className={s.label} x="88" y="105">
            {criterion}
          </text>
        </g>
      ))}
      <g className={s.verified}>
        <rect
          className={s.tile}
          x="62"
          y="168"
          width="117"
          height="23"
          rx="2"
        />
        <circle className={s.contact} cx="72" cy="179" r="2.5" />
        <text className={s.small} x="81" y="183">
          V1 VERIFIED
        </text>
      </g>
    </>
  );
}
