import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  defineStep,
  defineWorkflow,
  ResultFileSchema,
  resultFile,
  workDirectory,
} from "@intloom/loom-sdk";
import { z } from "zod";
import { languageSchema, messages, selectLanguage } from "./messages.ts";
import { localWeather } from "./weather.ts";

const input = z.strictObject({});
const person = z.strictObject({ name: z.string(), language: languageSchema });
const greeting = person.extend({
  place: z.string(),
  celsius: z.number().nullable(),
  condition: z.string(),
  timeZone: z.string(),
});
const tutorial = "https://intloom.ai/docs/use/meeting-notes";
// biome-ignore lint/suspicious/noControlCharactersInRegex: A name appears on one terminal line; use a pattern portable to JSON Schema.
const namePattern = /^(?=.*\S)[^\x00-\x1f\x7f-\x9f\u2028\u2029]+$/;

const askName = defineStep({
  id: "ask-name",
  inputSchema: input,
  outputSchema: person,
  suspendSchema: languageSchema,
  resumeSchema: z.string().regex(namePattern),
  interaction: { message: ({ suspendData }) => messages[suspendData].question },
  execute({ suspend, suspendData, resumeData }) {
    if (resumeData === undefined || suspendData === undefined)
      return suspend(
        selectLanguage(Intl.DateTimeFormat().resolvedOptions().locale),
      );
    return { name: resumeData.trim(), language: suspendData };
  },
});

const checkWeather = defineStep({
  id: "local-weather",
  inputSchema: person,
  outputSchema: greeting,
  async execute({ inputData, context }) {
    const { place, celsius, sky } = await localWeather(context.signal);
    return {
      ...inputData,
      place,
      celsius,
      condition: sky ? messages[inputData.language].weather[sky] : "",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    };
  },
});

function markdownText(value: string) {
  return value.replace(/[\\`*_[\]<>|~!#&]/g, "\\$&");
}

export function greetingCard({
  name,
  language,
  place,
  celsius,
  condition,
  timeZone,
}: z.infer<typeof greeting>) {
  const copy = messages[language];
  const hasWeather = celsius !== null || Boolean(condition);
  const degrees =
    celsius === null
      ? ""
      : `${new Intl.NumberFormat(language).format(celsius)} °C`;
  const location = place ? markdownText(place) : "";
  const weatherLine = [location, condition, degrees]
    .filter(Boolean)
    .join(" · ");
  return (
    [
      `# ${copy.greeting.replace("{name}", () => markdownText(name))}`,
      [
        weatherLine,
        (place || hasWeather) && copy.source,
        !place && timeZone && `${copy.timeZone} · ${timeZone}`,
      ]
        .filter(Boolean)
        .join("  \n"),
      [hasWeather ? copy.madeCard : copy.offlineCard, copy.how].join(" "),
      `## ${copy.next}`,
      copy.tryMeeting,
      copy.install,
      "```sh\nintloom install @intloom/meeting-notes\n```",
      copy.run,
      [
        "```sh",
        `intloom run @intloom/meeting-notes summarize --prompt "${copy.sample}"`,
        "```",
      ].join("\n"),
      `[${copy.tutorial}](${tutorial})`,
    ]
      .filter(Boolean)
      .join("\n\n") + "\n"
  );
}

const writeGreeting = defineStep({
  id: "write-greeting",
  inputSchema: greeting,
  outputSchema: ResultFileSchema,
  async execute({ inputData, context }) {
    const card = greetingCard(inputData);
    await writeFile(join(workDirectory(context.run), "hello.md"), card);
    context.logger.info(card.trimEnd());
    return resultFile("hello.md", "text/markdown");
  },
});

export default defineWorkflow({
  id: "hello",
  inputSchema: input,
  outputSchema: ResultFileSchema,
})
  .then(askName)
  .then(checkWeather)
  .then(writeGreeting)
  .commit();
