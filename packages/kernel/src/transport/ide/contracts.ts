import type { PendingUserAction } from "../../runtime/run-view.ts";
import type { ActionForm } from "../interaction/forms.ts";

/** IDE adapters handle configuration and presentation without owning execution environments or determining Loom routing. */
export interface IdeAdapter {
  readonly id: string;
  createForm(action: PendingUserAction): ActionForm;
}
