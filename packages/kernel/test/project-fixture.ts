import type { TestContext } from "node:test";
import { initializationProject } from "./initialization-fixture.ts";

export const configText = `intent:
  apps: []
llms:
  default:
    provider: openai-compatible
    model: test-model
    secret: ENV.INTLOOM_WORKFLOW_TEST_KEY
    baseURL: https://model.invalid/v1
`;

export async function projectFixture(t: TestContext) {
  return initializationProject(t);
}

export function askingCode(codeId: string) {
  return `export const codes = { [${JSON.stringify(codeId)}]: async (_input, access) => {
    await access.storage.getArtifact("fixture", "first");
    const answer = await access.interaction.confirm("Continue?");
    await access.state.update({ value: answer.isConfirmed ? "accepted" : "rejected" });
    return { outcome: "complete" };
  } };`;
}
