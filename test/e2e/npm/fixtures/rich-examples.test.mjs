// biome-ignore-all lint/suspicious/noUndeclaredEnvVars: Optional local evidence retention outside Turbo.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { ExecutionRejectedError } from "@intloom/loom-sdk";
import hello from "@intloom-example/hello-loom";
import {
  languageSchema,
  messages,
  selectLanguage,
} from "@intloom-example/hello-loom/src/messages.js";
import { readWeather } from "@intloom-example/hello-loom/src/weather.js";
import meeting, { minutes } from "@intloom-example/meeting-notes";
import intent from "@intloom-example/intent-loom";
import * as roles from "@intloom-example/intent-loom/src/agents.js";
import {
  applyEdits,
  assess,
  capture,
  digest,
  materialize,
  verify,
} from "@intloom-example/intent-loom/src/project.js";
import { cases, makeInput } from "./intent/cases.mjs";
import { solutions } from "./intent/solutions.mjs";
import { testContext } from "./definition-driver.mjs";

const require = createRequire(import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const weather = {
  nearest_area: [
    {
      areaName: [{ value: "Oslo" }],
      region: [{ value: "Oslo" }],
      country: [{ value: "Norway" }],
    },
  ],
  current_condition: [{ temp_C: "12", weatherCode: "113" }],
};

async function assertOutputs(name, context) {
  const manifest = await readJson(
    require.resolve(`@intloom-example/${name}/loom.json`),
  );
  for (const output of Object.values(manifest.output)) {
    for (const path of output.paths ?? [output.path]) {
      const info = await stat(join(context.workDir, path));
      assert.equal(
        output.type === "folder" ? info.isDirectory() : info.isFile(),
        true,
        path,
      );
    }
  }
}

test("Hello: all ten locales execute the three compiled steps", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://wttr.in/?format=j1");
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify(weather));
  });
  for (const language of languageSchema.options) {
    const { context } = await testContext(t, { answers: [" 陈🌍 *Ada* "] });
    assert.equal(await context.exec(hello, { prompt: language }), undefined);
    const card = await readFile(join(context.workDir, "hello.md"), "utf8");
    assert.ok(card.includes(messages[language].weather.clear));
    assert.match(card, /Oslo, Norway/);
    assert.ok(card.includes("陈🌍 \\*Ada\\*"));
    assert.doesNotMatch(card, /intloom (install|run)/);
    await assertOutputs("hello-loom", context);
  }
  assert.equal(selectLanguage("zh-TW"), "zh-Hant");
  assert.equal(selectLanguage("zh-CN"), "zh-Hans");
  assert.equal(selectLanguage("it-IT"), "en");
});

test("Hello: offline and malformed weather degrade to a usable card", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  const { context } = await testContext(t, { answers: ["Ada"] });
  await context.exec(hello, { prompt: "en" });
  assert.match(
    await readFile(join(context.workDir, "hello.md"), "utf8"),
    /weather is unavailable/,
  );
  assert.deepEqual(readWeather({}), { place: "", celsius: null, sky: null });
  assert.equal(
    readWeather({ current_condition: [{ temp_C: "bad", weatherCode: "125" }] })
      .sky,
    "haze",
  );
  assert.equal(
    readWeather({ current_condition: [{ temp_C: "0", weatherCode: "999" }] })
      .celsius,
    0,
  );
});

test("Hello: invalid names retry the same interaction before weather or output", async (t) => {
  let fetches = 0;
  t.mock.method(globalThis, "fetch", async () => {
    fetches++;
    return new Response(JSON.stringify(weather));
  });
  for (const name of ["   ", "Ada\nLin", "Ada\u0000"]) {
    const { context, questions } = await testContext(t, {
      answers: [name, "Ada"],
    });
    await context.exec(hello, { prompt: "en" });
    assert.equal(questions.length, 2);
    assert.equal(questions[0].id, questions[1].id);
    assert.equal(questions[1].draft, name);
    assert.ok(questions[1].issues.length);
    await assertOutputs("hello-loom", context);
  }
  assert.equal(fetches, 3);
});

const source =
  "Lin: We agreed to roll out to 10% of users.\nLin: I will share the test results on Thursday.\nThe launch date is still open.";
function notes(kind = "action") {
  return {
    kind,
    title: "Release meeting",
    fullHeading: "Conclusions and actions",
    sections: [
      {
        heading: "Scope and follow-up",
        points: [
          {
            statement:
              "Roll out to 10% of users; the launch date remains open.",
            highlight: true,
            evidence: [
              { line: 1, quote: "We agreed to roll out to 10% of users." },
              { line: 3, quote: "The launch date is still open." },
            ],
          },
          {
            statement: "Lin will share the test results on Thursday.",
            highlight: true,
            evidence: [
              {
                line: 2,
                quote: "Lin: I will share the test results on Thursday.",
              },
            ],
          },
        ],
      },
    ],
  };
}

test("Meeting Notes: prompt/file inputs, four formats and verbatim highlights", async (t) => {
  for (const kind of ["review", "sync", "exploration", "action"]) {
    const { context, directory } = await testContext(t, {
      agent: (target, prompt) => {
        assert.equal(target, minutes);
        assert.deepEqual(
          JSON.parse(prompt),
          source.split("\n").map((text, index) => ({ line: index + 1, text })),
        );
        return notes(kind);
      },
    });
    const file = join(directory, "source.md");
    await writeFile(file, source.replaceAll("\n", "\r\n"));
    await context.exec(
      meeting,
      kind === "action" ? { files: [file] } : { prompt: source },
    );
    const document = await readFile(
      join(context.workDir, "meeting-notes.md"),
      "utf8",
    );
    assert.equal(
      document.split(notes().sections[0].points[0].statement).length - 1,
      2,
    );
    assert.match(
      document,
      /L2 · Lin: I will share the test results on Thursday\./,
    );
    await assertOutputs("meeting-notes", context);
  }
});

test("Meeting Notes: invalid inputs fail before Agent calls", async (t) => {
  const { context, directory } = await testContext(t);
  const invalid = join(directory, "invalid.txt");
  await writeFile(invalid, new Uint8Array([0xc3, 0x28]));
  for (const input of [
    {},
    { prompt: " " },
    { prompt: source, files: [invalid] },
    { files: [invalid, invalid] },
    { prompt: source, folders: [directory] },
    { files: [join(directory, "source.pdf")] },
    { files: [invalid] },
    { files: [join(directory, "missing.txt")] },
  ]) {
    await assert.rejects(context.exec(meeting, input));
  }
  assert.deepEqual(await readdir(context.workDir), []);
});

test("Meeting Notes: source rejection, invalid citations and malformed Agent output", async (t) => {
  for (const [kind, error] of [
    ["agenda-only", /AGENDA_WITHOUT_DISCUSSION/],
    ["unrelated", /NOT_MEETING_CONTENT/],
    ["insufficient", /INSUFFICIENT_MEETING_CONTENT/],
  ]) {
    const { context } = await testContext(t, {
      agent: () => ({ kind, title: "", fullHeading: "", sections: [] }),
    });
    await assert.rejects(context.exec(meeting, { prompt: source }), error);
  }
  for (const evidence of [
    [{ line: 8, quote: "invented" }],
    [{ line: 2, quote: "share on Friday" }],
    [{ line: 0, quote: "Lin" }],
  ]) {
    const result = notes();
    result.sections[0].points[0].evidence = evidence;
    const { context } = await testContext(t, { agent: () => result });
    await assert.rejects(context.exec(meeting, { prompt: source }));
    assert.deepEqual(await readdir(context.workDir), []);
  }
});

test("Meeting Notes: fallback highlights and Markdown escaping share validated statements", async (t) => {
  const result = notes();
  result.title = "<meeting> [link]";
  result.sections[0].points.forEach((point) => {
    point.highlight = false;
  });
  const { context } = await testContext(t, { agent: () => result });
  await context.exec(meeting, { prompt: source });
  const document = await readFile(
    join(context.workDir, "meeting-notes.md"),
    "utf8",
  );
  assert.ok(document.startsWith("# &lt;meeting\\> \\[link\\]"));
  assert.equal(
    document.split(result.sections[0].points[0].statement).length - 1,
    2,
  );
});

async function intentFixture(t, size = "small", options = {}) {
  const fixture = await testContext(t, {
    choices: options.choices ?? ["approve", "approve"],
    answers: options.answers ?? [],
    agent(target, prompt) {
      const data = JSON.parse(prompt);
      if (target === roles.analyze)
        return {
          goal: data.request,
          criteria: Object.entries(cases[size].tests).map(
            ([id, [description]]) => ({
              statement: description,
              checks: options.checks ?? [id],
            }),
          ),
        };
      if (target === roles.design)
        return {
          approach: "Minimal implementation",
          steps: ["Update editable modules and verify their contracts."],
        };
      if (target === roles.implement)
        return {
          summary: "Scripted candidate for deterministic verification.",
          edits:
            options.edits ??
            Object.entries(solutions[size]).map(([path, content]) => ({
              path,
              content,
            })),
        };
      if (target === roles.audit)
        return {
          verdict: "passed",
          reason: "Scripted positive opinion for testing evidence precedence.",
        };
      assert.fail("Unexpected role");
    },
  });
  const old = await makeInput(size, join(fixture.directory, "project"));
  const config = {
    files: old.files,
    checks: old.checks.map((check) => ({
      ...check,
      command: process.execPath,
    })),
  };
  const configPath = join(fixture.directory, "request.json");
  await writeFile(configPath, JSON.stringify(config));
  return {
    ...fixture,
    config,
    input: {
      prompt: old.prompt,
      files: [configPath],
      folders: [old.projectDir],
    },
  };
}

for (const size of ["small", "medium", "large"]) {
  test(`Intent: ${size} complete Workflow, separate real command suites and exported candidate`, async (t) => {
    const fixture = await intentFixture(
      t,
      size,
      size === "medium"
        ? {
            choices: ["revise", "approve", "revise", "approve"],
            answers: [
              " ",
              "Preserve Unicode and scope",
              "Show module dependencies",
            ],
          }
        : {},
    );
    const { context, input, calls, directory, executions } = fixture;
    assert.equal(await context.exec(intent, input), undefined);
    await assertOutputs("intent-loom", context);
    const candidate = await readJson(
      join(context.workDir, "implementation.json"),
    );
    const validation = await readJson(join(context.workDir, "validation.json"));
    const acceptance = await readJson(join(context.workDir, "acceptance.json"));
    assert.equal(acceptance.status, "passed");
    assert.equal(acceptance.candidate, digest(candidate.files));
    assert.equal(candidate.digest, validation.candidate);
    const count = Object.keys(cases[size].tests).length + 1;
    assert.equal(candidate.checks.length, count);
    assert.equal(validation.checks.length, count);
    const receipts = [...candidate.checks, ...validation.checks];
    assert.equal(
      new Set(receipts.map((receipt) => receipt.attemptId)).size,
      count * 2,
    );
    for (const receipt of receipts) {
      assert.equal(receipt.status, "exited");
      assert.equal(receipt.exitCode, 0, receipt.stderr);
      assert.equal(receipt.candidate, candidate.digest);
      assert.ok(receipt.startedAt);
    }
    const baseline = await readJson(candidate.baselinePath);
    assert.equal(candidate.base, undefined);
    assert.ok(
      executions.some(
        ({ input }) => input === join(context.workDir, "implementation.json"),
      ),
    );
    for (const { input } of executions.filter(
      ({ input }) => input?.baselinePath && "revision" in input,
    )) {
      assert.equal(input.base, undefined);
      assert.equal(input.previous, undefined);
    }
    for (const file of baseline.files) {
      assert.equal(
        await readFile(join(input.folders[0], file.path), "utf8"),
        file.content,
      );
      if (!file.editable)
        assert.equal(
          candidate.files.find((next) => next.path === file.path).content,
          file.content,
        );
    }
    if (size === "medium") {
      const analyses = calls.filter((call) => call.target === roles.analyze);
      const designs = calls.filter((call) => call.target === roles.design);
      assert.equal(analyses.length, 2);
      assert.equal(designs.length, 2);
      assert.equal(
        JSON.parse(analyses[1].input).reviewerFeedback,
        "Preserve Unicode and scope",
      );
      assert.ok(JSON.parse(analyses[1].input).previous);
      assert.equal(
        JSON.parse(designs[1].input).reviewerFeedback,
        "Show module dependencies",
      );
      assert.equal(JSON.parse(designs[0].input).previous, null);
      assert.equal(
        (await readdir(join(context.workDir, "revisions"))).length,
        8,
      );
    }
    assert.deepEqual(await readdir(context.tempDir), []);
    const exported = join(directory, "exported");
    await materialize(exported, candidate.files, context.fs);
    await writeFile(join(exported, "extra.mjs"), cases[size].extra);
    execFileSync(process.execPath, ["extra.mjs"], { cwd: exported });
    if (process.env.INTLOOM_EXAMPLE_EVIDENCE_DIR) {
      const destination = join(process.env.INTLOOM_EXAMPLE_EVIDENCE_DIR, size);
      await cp(context.workDir, destination, { recursive: true });
    }
  });
}

test("Intent: failed real commands override optimistic auditor opinions", async (t) => {
  const { context, input } = await intentFixture(t, "small", { edits: [] });
  await assert.rejects(context.exec(intent, input), ExecutionRejectedError);
  await assertOutputs("intent-loom", context);
  const validation = await readJson(join(context.workDir, "validation.json"));
  const acceptance = await readJson(join(context.workDir, "acceptance.json"));
  assert.equal(validation.assessments[0].modelVerdict, "passed");
  assert.equal(validation.assessments[0].verdict, "failed");
  assert.equal(acceptance.status, "rejected");
  assert.equal(acceptance.regression.status, "rejected");
});

test("Intent: absent evidence prevents acceptance even when all commands pass", async (t) => {
  const { context, input } = await intentFixture(t, "small", { checks: [] });
  await assert.rejects(context.exec(intent, input), ExecutionRejectedError);
  await assertOutputs("intent-loom", context);
  const validation = await readJson(join(context.workDir, "validation.json"));
  const acceptance = await readJson(join(context.workDir, "acceptance.json"));
  assert.equal(validation.assessments[0].verdict, "unverified");
  assert.equal(acceptance.status, "rejected");
  assert.equal(acceptance.regression.status, "passed");
});

test("Intent: review feedback and max rounds stop implementation", async (t) => {
  for (const options of [
    {
      choices: ["reject"],
      error: /User declined/,
    },
    {
      choices: ["revise", "revise", "revise", "revise", "revise"],
      answers: ["revise", "revise", "revise", "revise", "revise"],
      error: /REPEAT_LIMIT: specification/,
    },
    { checks: ["invented-check"], error: /INTENT_UNKNOWN_CHECK/ },
  ]) {
    const { context, input, calls } = await intentFixture(t, "small", options);
    await assert.rejects(context.exec(intent, input), options.error);
    assert.equal(
      calls.some((call) => call.target === roles.implement),
      false,
    );
    assert.equal(
      (await readdir(context.workDir)).includes("implementation.json"),
      false,
    );
  }
});

test("Intent: protected/out-of-scope/duplicate edits are rejected; declared creation/deletion work", async (t) => {
  for (const edits of [
    [{ path: "greeting.test.mjs", content: "" }],
    [{ path: "../outside.mjs", content: "" }],
    [
      { path: "greet.mjs", content: "" },
      { path: "greet.mjs", content: null },
    ],
  ]) {
    const { context, input } = await intentFixture(t, "small", { edits });
    await assert.rejects(
      context.exec(intent, input),
      /INTENT_(EDIT_OUT_OF_SCOPE|DUPLICATE_EDIT)/,
    );
  }
  const files = [
    { path: "old.mjs", editable: true, content: "old" },
    { path: "new.mjs", editable: true, content: null },
  ];
  const applied = applyEdits(
    files,
    ["old.mjs", "new.mjs"],
    [
      { path: "old.mjs", content: null },
      { path: "new.mjs", content: "new" },
    ],
  );
  assert.deepEqual(
    applied.map((file) => file.content),
    [null, "new"],
  );
  assert.deepEqual(
    files.map((file) => file.content),
    ["old", null],
  );
});

test("Intent: configuration rejects duplicate/reserved identities and invalid baseline paths", async (t) => {
  const { config, input, context } = await intentFixture(t);
  for (const invalid of [
    { ...config, files: [...config.files, config.files[0]] },
    { ...config, checks: [...config.checks, config.checks[0]] },
    { ...config, checks: [{ ...config.checks[0], id: "protected-files" }] },
    { ...config, files: [{ path: "../outside.mjs", editable: true }] },
    { ...config, files: [{ path: "missing.mjs", editable: false }] },
  ])
    await assert.rejects(
      capture(input.folders[0], input.prompt, invalid, context.fs),
    );
  for (const invalid of [
    {},
    { ...input, prompt: " " },
    { ...input, files: [] },
    { ...input, folders: [...input.folders, ...input.folders] },
  ]) {
    await assert.rejects(context.exec(intent, invalid), /Provide a prompt/);
  }
});

test("Intent: command directories are independent, launch errors are unverified, protected hashes are checked", async (t) => {
  const { context } = await testContext(t);
  const files = [
    { path: "protected.txt", content: "original", editable: false },
  ];
  const { createHash } = await import("node:crypto");
  const base = {
    prompt: "Test receipts",
    files,
    protectedHashes: [
      {
        path: "protected.txt",
        sha256: createHash("sha256").update("original").digest("hex"),
      },
    ],
    checks: [
      {
        id: "mutate",
        description: "Only this invocation changes its own copy",
        command: process.execPath,
        args: [
          "-e",
          "require('node:fs').writeFileSync('protected.txt','changed')",
        ],
      },
      {
        id: "independent",
        description: "Fresh copy is original",
        command: process.execPath,
        args: [
          "-e",
          "require('node:assert/strict').equal(require('node:fs').readFileSync('protected.txt','utf8'),'original')",
        ],
      },
      {
        id: "missing",
        description: "Cannot launch",
        command: join(context.tempDir, "missing-command"),
        args: [],
      },
    ],
  };
  const receipts = await verify(files, base, context);
  assert.deepEqual(
    receipts.map((receipt) => receipt.exitCode),
    [0, 0, null, 0],
  );
  assert.equal(
    assess({ statement: "Cannot establish", checks: ["missing"] }, receipts, {
      verdict: "passed",
      reason: "Optimistic",
    }).verdict,
    "unverified",
  );
  const changed = [{ ...files[0], content: "modified" }];
  const mismatch = await verify(changed, { ...base, checks: [] }, context);
  assert.equal(mismatch[0].exitCode, 1);
  assert.deepEqual(await readdir(context.tempDir), []);
});

test("Packaged prompts, samples and complete Skill resources are readable", async () => {
  const meetingRoot = dirname(
    require.resolve("@intloom-example/meeting-notes/loom.json"),
  );
  const sources = (await readdir(join(meetingRoot, "samples"))).filter(
    (file) => file !== "action.minutes.md",
  );
  assert.equal(sources.length, 8);
  for (const file of sources)
    assert.ok(
      (await readFile(join(meetingRoot, "samples", file), "utf8")).trim(),
    );
  const root = dirname(
    require.resolve("@intloom-example/intent-loom/loom.json"),
  );
  assert.match(
    await readFile(join(root, "skills/evidence-review/SKILL.md"), "utf8"),
    /references\/evidence.md/,
  );
  assert.match(
    await readFile(
      join(root, "skills/evidence-review/references/evidence.md"),
      "utf8",
    ),
    /missing exit code/,
  );
  for (const role of Object.values(roles))
    assert.ok((await role.instructions()).length > 40);
});
