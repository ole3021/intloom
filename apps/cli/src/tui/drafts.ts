import { createSignal } from "solid-js";
import type { ReadonlyJsonValue } from "@intloom/loom-sdk";
export interface AnswerDraft {
  index: number;
  answers: ReadonlyJsonValue[];
  texts: Record<number, string>;
  custom: boolean;
  decision?: boolean | undefined;
  feedback: string;
}
export const emptyAnswerDraft = (): AnswerDraft => ({
  index: 0,
  answers: [],
  texts: {},
  custom: false,
  feedback: "",
});
export function createDrafts() {
  const [loom, setLoom] = createSignal("");
  const [draft, setDraft] = createSignal("");
  const drafts = new Map<string, AnswerDraft>();
  const getDraft = (key: string) => {
    let draft = drafts.get(key);
    if (!draft) {
      draft = emptyAnswerDraft();
      drafts.set(key, draft);
    }
    return draft;
  };
  return { loom, setLoom, draft, setDraft, drafts, getDraft };
}
