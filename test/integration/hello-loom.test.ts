import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import workflow, { greetingCard } from "../../examples/hello-loom/hello.ts";
import {
  languageSchema,
  messages,
  selectLanguage,
} from "../../examples/hello-loom/messages.ts";
import {
  localWeather,
  readWeather,
} from "../../examples/hello-loom/weather.ts";

test("hello questions and cards use the same supported language and fixed guide", () => {
  assert.equal(selectLanguage("zh-HK"), "zh-Hant");
  assert.equal(selectLanguage("zh-Hans-TW"), "zh-Hans");
  assert.equal(selectLanguage("zh"), "zh-Hans");
  assert.equal(selectLanguage("pt-BR"), "pt");
  assert.equal(selectLanguage("sv-SE"), "en");
  assert.equal(languageSchema.options.length, 10);
  for (const language of languageSchema.options) {
    const copy = messages[language];
    const input = {
      language,
      name: "نور",
      place: "Test City",
      celsius: -1.5,
      condition: copy.weather.cloudy,
      timeZone: "Asia/Shanghai",
    };
    const card = greetingCard(input);
    assert.ok(copy.question.trim());
    assert.ok(card.includes(copy.greeting.replace("{name}", input.name)));
    assert.ok(card.includes(copy.weather.cloudy));
    assert.ok(
      card.includes(new Intl.NumberFormat(language).format(-1.5) + " °C"),
    );
    assert.ok(card.includes(copy.madeCard));
    assert.ok(card.includes(copy.how));
    assert.ok(card.includes("intloom install @intloom/meeting-notes\n"));
    assert.ok(
      card.includes(
        `intloom run @intloom/meeting-notes summarize --prompt "${copy.sample}"\n`,
      ),
    );
    assert.doesNotMatch(copy.sample, /["$`\\\r\n]/);
    assert.ok(
      card.includes(
        `[${copy.tutorial}](https://intloom.ai/docs/use/meeting-notes)`,
      ),
    );
    const offline = greetingCard({
      ...input,
      place: "",
      celsius: null,
      condition: "",
    });
    assert.ok(offline.includes(copy.offlineCard));
    assert.ok(offline.includes("Asia/Shanghai"));
    assert.ok(!offline.includes(copy.madeCard));
    assert.ok(!offline.includes("°C"));
  }
});

test("the published name question accepts a printable line including Markdown punctuation", () => {
  const first = workflow.nodes[0];
  assert.ok(first?.kind === "then" && "resumeSchema" in first.step);
  const schema = first.step.resumeSchema as z.ZodString;
  const publicSchema = z.fromJSONSchema(z.toJSONSchema(schema));
  for (const candidate of [schema, publicSchema]) {
    for (const invalid of ["", "  ", "Ada\nLovelace", "\u001b[31mAda"])
      assert.equal(candidate.safeParse(invalid).success, false);
    for (const valid of ["Patricia", "小陈", "مريم", "  Lee [JP]  "])
      assert.equal(candidate.safeParse(valid).success, true);
  }
  const card = greetingCard({
    language: "en",
    name: "$& [A]",
    place: "",
    condition: "",
    celsius: 0,
    timeZone: "",
  });
  assert.ok(card.startsWith("# Hello, $\\& \\[A\\]!"));
  assert.ok(card.includes("0 °C"));
});

test("partial weather preserves valid fields and never infers a city from the time zone", () => {
  assert.deepEqual(
    readWeather({
      nearest_area: [
        {
          areaName: [{ value: "Paris" }],
          region: [{ value: "Paris" }],
          country: [{ value: "France" }],
        },
      ],
      current_condition: [{ weatherCode: "119", temp_C: "0" }],
    }),
    { place: "Paris, France", celsius: 0, sky: "cloudy" },
  );
  assert.deepEqual(
    readWeather({
      nearest_area: "invalid",
      current_condition: [{ weatherCode: "999", temp_C: "-4" }],
    }),
    { place: "", celsius: -4, sky: null },
  );
  assert.deepEqual(
    readWeather({ current_condition: [{ weatherCode: "113", temp_C: " " }] }),
    { place: "", celsius: null, sky: "clear" },
  );
  assert.deepEqual(readWeather(null), { place: "", celsius: null, sky: null });
});

test("weather sends only its fixed URL, degrades on failure and respects cancellation", async (t) => {
  const request = t.mock.method(
    globalThis,
    "fetch",
    async (url: string, init: RequestInit) => {
      assert.equal(url, "https://wttr.in/?format=j1");
      assert.ok(init.signal);
      return new Response(
        '{"current_condition":[{"temp_C":"12","weatherCode":"116"}]}',
      );
    },
  );
  const controller = new AbortController();
  assert.equal((await localWeather(controller.signal)).sky, "partlyCloudy");
  request.mock.mockImplementation(
    async () => new Response(null, { status: 429 }),
  );
  assert.equal((await localWeather(controller.signal)).celsius, null);
  request.mock.mockImplementation(async () => {
    throw new Error("offline");
  });
  assert.deepEqual(await localWeather(controller.signal), {
    place: "",
    celsius: null,
    sky: null,
  });
  controller.abort();
  await assert.rejects(localWeather(controller.signal), { name: "AbortError" });
});
