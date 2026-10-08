import type { PendingUserAction } from "@intloom/kernel";
import type { ActionForm } from "../interaction/forms.ts";

/** IDE adapters handle configuration and presentation without owning execution environments or determining Workflow routing. */
export interface IdeAdapter {
  readonly id: string;
  createForm(action: PendingUserAction): ActionForm;
}
