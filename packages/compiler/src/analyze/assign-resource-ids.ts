import { generateId } from "@intloom/utils";
import type { WorkflowModel, LinkedWorkflow } from "./model.ts";

export function assignResourceIds(model: WorkflowModel): LinkedWorkflow {
  const used = new Set<string>();
  function ids(
    keys: string[],
    prefix: string,
  ): Readonly<Record<string, string>> {
    return Object.fromEntries(
      keys.map((key) => {
        let id: string;
        do {
          id = generateId(prefix);
        } while (used.has(id));
        used.add(id);
        return [key, id];
      }),
    );
  }
  return {
    model,
    codeIds: ids(Object.keys(model.codes), "CODE"),
    agentIds: ids(Object.keys(model.agents), "AGENT"),
  };
}
