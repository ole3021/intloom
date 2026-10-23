import { actionForm } from "../../interaction/forms.ts";
import type { IdeAdapter } from "../contracts.ts";

export const codexAdapter: IdeAdapter = Object.freeze({
  id: "codex",
  createForm: (action: Parameters<IdeAdapter["createForm"]>[0]) => {
    const form = actionForm(action);
    return {
      ...form,
      message: `IntLoom · ${action.loomName}\n\n${form.message}`,
    };
  },
});
