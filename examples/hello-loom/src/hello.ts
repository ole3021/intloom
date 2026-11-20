import { type CodeContext, type LoomInput, workflow } from "@intloom/loom-sdk";
import { z } from "zod";
import { type Language, messages, selectLanguage } from "./messages.ts";
import { localWeather } from "./weather.ts";

// biome-ignore lint/suspicious/noControlCharactersInRegex: A name must fit on one line.
const namePattern = /^(?=.*\S)[^\x00-\x1f\x7f-\x9f\u2028\u2029]+$/;
const nameSchema = z
  .string()
  .regex(namePattern)
  .transform((value) => value.trim());

type Person = { name: string; language: Language };
type Greeting = Person & {
  place: string;
  celsius: number | null;
  condition: string;
  timeZone: string;
};

async function askName(
  input: LoomInput,
  context: CodeContext,
): Promise<Person> {
  const language = selectLanguage(
    input.prompt?.trim() || Intl.DateTimeFormat().resolvedOptions().locale,
  );
  const answer = await context.user.ask({
    question: messages[language].question,
    mode: "text",
    schema: nameSchema,
  });
  return { name: answer.value, language };
}

async function checkWeather(
  person: Person,
  context: CodeContext,
): Promise<Greeting> {
  const { place, celsius, sky } = await localWeather(context.signal);
  return {
    ...person,
    place,
    celsius,
    condition: sky ? messages[person.language].weather[sky] : "",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
  };
}

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
}: Greeting) {
  const copy = messages[language];
  const hasWeather = celsius !== null || Boolean(condition);
  const degrees =
    celsius === null
      ? ""
      : `${new Intl.NumberFormat(language).format(celsius)} °C`;
  const weatherLine = [place && markdownText(place), condition, degrees]
    .filter(Boolean)
    .join(" · ");
  return `${[
    `# ${copy.greeting.replace("{name}", () => markdownText(name))}`,
    [
      weatherLine,
      (place || hasWeather) && copy.source,
      !place && timeZone && `${copy.timeZone} · ${timeZone}`,
    ]
      .filter(Boolean)
      .join("  \n"),
    hasWeather ? copy.madeCard : copy.offlineCard,
    `## ${copy.next}`,
    copy.tryMeeting,
    `> ${copy.sample}`,
    "`@intloom-example/meeting-notes` · `prompt`",
  ]
    .filter(Boolean)
    .join("\n\n")}\n`;
}

async function writeGreeting(
  input: Greeting,
  context: CodeContext,
): Promise<void> {
  if (context.mode === "chat")
    throw new Error("A greeting requires a Run or PATCH.");
  await context.fs.write({
    path: `${context.workDir}/hello.md`,
    content: greetingCard(input),
  });
}

export default workflow<LoomInput>()
  .step("ask-name", { exec: askName, input: ({ input }) => input })
  .step("local-weather", {
    exec: checkWeather,
    input: ({ steps }) => steps["ask-name"],
  })
  .step("write-greeting", {
    exec: writeGreeting,
    input: ({ steps }) => steps["local-weather"],
  })
  .build();
