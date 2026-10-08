export const stages = [
  {
    id: "specification",
    mark: "S",
    title: "Specification",
    verb: "Make the intent explicit.",
    description:
      "Turn an initial idea into goals, constraints, and a shared understanding. Clarify what matters before choosing how to build it.",
    artifact: "Goals · Constraints · Acceptance criteria",
    state: "Implemented with controlled-model verification",
    code: "intent → clarify → confirm → specification",
  },
  {
    id: "solution",
    mark: "O",
    title: "Solution",
    verb: "Give the idea a structure.",
    description:
      "Connect architecture and technical decisions to confirmed requirements. Keep the reason for each choice close to the choice itself.",
    artifact: "Architecture · Interfaces · Implementation plan",
    state: "Workflow direction · planned",
    code: "specification → explore → decide → solution",
  },
  {
    id: "implementation",
    mark: "L",
    title: "Implementation",
    verb: "Bring the structure to life.",
    description:
      "Translate the agreed solution into focused changes. Carry the original intent through the details of the code.",
    artifact: "Changes · Context · Working software",
    state: "Workflow direction · planned",
    code: "solution → build → inspect → implementation",
  },
  {
    id: "validation",
    mark: "V",
    title: "Validation",
    verb: "Close the loop with evidence.",
    description:
      "Check the result against its requirements and decisions. Preserve evidence of what works, and expose what still needs attention.",
    artifact: "Checks · Evidence · Feedback",
    state: "Workflow direction · planned",
    code: "implementation → verify → evidence → validation",
  },
  {
    id: "evolution",
    mark: "E",
    title: "Evolution",
    verb: "Let every cycle move you forward.",
    description:
      "Turn evidence and feedback into the next useful change. Revisit assumptions, refine the intent, and carry what you learned into the next cycle.",
    artifact: "Feedback · Learning · Refined intent",
    state: "Workflow direction · planned",
    code: "validation → learn → refine → next intent",
  },
] as const;

export type StageId = (typeof stages)[number]["id"];
