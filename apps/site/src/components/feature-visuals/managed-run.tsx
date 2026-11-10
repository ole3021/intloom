import s from "./visuals.module.css";

const events = [
  "Draft saved",
  "Awaiting review",
  "Answer recorded",
  "Report delivered",
];

export function ManagedRunVisual() {
  return (
    <>
      <rect className={s.plate} x="34" y="37" width="172" height="167" rx="3" />
      <text className={s.small} x="47" y="55">
        RUN / REPORT
      </text>
      <path className={s.guide} d="M34 65h172m-149 16v75M34 173h172" />
      <g className={s.runCursor}>
        <rect
          className={s.rowHighlight}
          x="47"
          y="72"
          width="146"
          height="19"
        />
      </g>
      {events.map((event, i) => (
        <g key={event} transform={`translate(0 ${i * 25})`}>
          <circle className={s.node} cx="57" cy="81.5" r="3.5" />
          <text className={s.label} x="70" y="85">
            {event}
          </text>
        </g>
      ))}
      <circle
        className={`${s.runCursor} ${s.contact}`}
        cx="57"
        cy="81.5"
        r="3"
      />
      <path className={s.guide} d="M48 183h7l4 4v9H48z" />
      <text className={s.small} x="66" y="193">
        report.md
      </text>
    </>
  );
}
