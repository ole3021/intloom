import type { SpecificationArtifact } from "../schemas/specification-artifact.ts";

export function confirmationArtifact(): SpecificationArtifact {
  return {
    domains: [
      { id: "SDOM-todo", responsibility: "Task management", status: "active" },
    ],
    features: [
      {
        id: "SFEA-todo",
        responsibility: "Browser task operations",
        status: "active",
        domain_ref: "SDOM-todo",
      },
    ],
    requirements: [
      {
        id: "SREQ-add",
        status: "active",
        description: "Enter adds a task and clears the input.",
        feature_ref: "SFEA-todo",
        acceptances: [
          {
            id: "SACC-add-blank",
            requirement_ref: "SREQ-add",
            description: "Blank titles are not added.",
          },
          {
            id: "SACC-add-duplicate",
            requirement_ref: "SREQ-add",
            description: "Duplicate titles retain separate identities.",
          },
        ],
        record_refs: ["RUN-history"],
      },
      {
        id: "SREQ-restore",
        status: "active",
        description: "Reload restores tasks.",
        feature_ref: "SFEA-todo",
        acceptances: [],
        record_refs: ["RUN-history"],
      },
    ],
    constraints: [
      {
        id: "SCON-local",
        status: "active",
        description: "Use only localStorage without a server connection.",
        record_refs: ["RUN-history"],
      },
      {
        id: "SCON-account",
        status: "retired",
        description: "Account login is required.",
        record_refs: ["RUN-history"],
      },
    ],
    relations: [
      {
        id: "SREL-restore",
        status: "active",
        source_req_ref: "SREQ-restore",
        target_req_ref: "SREQ-add",
        type: "depends_on",
        description: "Restore previously added tasks.",
        record_refs: ["RUN-history"],
      },
    ],
    deferreds: [
      {
        id: "SDEF-theme",
        status: "active",
        question: "Which theme should be used?",
        description: "The theme remains undecided for the first release.",
        impact: "Affects visual design without blocking task operations.",
        impact_refs: ["SFEA-todo", "SREQ-add", "SCON-local"],
        record_refs: ["RUN-history"],
      },
    ],
  };
}
