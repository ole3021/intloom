import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { publications } from "./publication.ts";
import {
  pendingPublications,
  retryPublishedInstall,
  verifyPublishedEntries,
} from "./registry.ts";
import type { PublicationVersions, ReleaseEntry } from "./release.ts";

const entry: ReleaseEntry = {
  name: "@intloom/cli",
  version: "0.0.2",
  tag: "latest",
  file: "intloom-cli-0.0.2.tgz",
  integrity: `sha512-${Buffer.alloc(64, 1).toString("base64")}`,
  dependencies: {},
};
const metadata = {
  version: entry.version,
  dist: { integrity: entry.integrity },
};

function mockRegistry(
  t: TestContext,
  respond: (source: "version" | "install") => Response,
) {
  t.mock.method(console, "log", () => {});
  return t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const base = `https://registry.npmjs.org/${encodeURIComponent(entry.name)}`;
      if (String(input) === base) {
        assert.equal(
          new Headers(init?.headers).get("accept"),
          "application/vnd.npm.install-v1+json",
        );
        return respond("install");
      }
      assert.equal(String(input), `${base}/${entry.version}`);
      return respond("version");
    },
  );
}

function ready(source: "version" | "install"): Response {
  return Response.json(
    source === "version"
      ? metadata
      : { versions: { [entry.version]: metadata } },
  );
}

test("published archives require matching exact version metadata and npm's install index", async (t) => {
  const fetch = mockRegistry(t, ready);
  await verifyPublishedEntries([entry], async () =>
    assert.fail("Must not wait"),
  );
  assert.equal(fetch.mock.callCount(), 2);
});

test("a just-published version's 404 is retried instead of reported as an integrity mismatch", async (t) => {
  let versionChecks = 0;
  mockRegistry(t, (source) => {
    if (source === "version" && ++versionChecks === 1)
      return new Response(null, { status: 404 });
    return ready(source);
  });
  const waits: number[] = [];
  await verifyPublishedEntries([entry], async (milliseconds) => {
    waits.push(milliseconds);
  });
  assert.equal(versionChecks, 2);
  assert.deepEqual(waits, [10_000]);
});

for (const absent of ["package", "version"] as const) {
  test(`install index lag (${absent} absent) must resolve before consumer installation`, async (t) => {
    let indexChecks = 0;
    mockRegistry(t, (source) => {
      if (source === "install" && ++indexChecks === 1)
        return absent === "package"
          ? new Response(null, { status: 404 })
          : Response.json({
              "dist-tags": { latest: "0.0.1" },
              versions: { "0.0.1": { ...metadata, version: "0.0.1" } },
            });
      return ready(source);
    });
    let waits = 0;
    await verifyPublishedEntries([entry], async () => {
      waits++;
    });
    assert.equal(indexChecks, 2);
    assert.equal(waits, 1);
  });
}

for (const source of ["version", "install"] as const) {
  test(`a real ${source} integrity mismatch fails immediately and includes both hashes`, async (t) => {
    const different = `sha512-${Buffer.alloc(64, 2).toString("base64")}`;
    mockRegistry(t, (requested) => {
      if (requested !== source) return ready(requested);
      const invalid = { ...metadata, dist: { integrity: different } };
      return Response.json(
        source === "version"
          ? invalid
          : { versions: { [entry.version]: invalid } },
      );
    });
    await assert.rejects(
      verifyPublishedEntries([entry], async () =>
        assert.fail("Must not retry"),
      ),
      (error: Error) => {
        assert.match(
          error.message,
          /Registry integrity mismatch: @intloom\/cli@0\.0\.2/,
        );
        assert.ok(error.message.includes(entry.integrity));
        assert.ok(error.message.includes(different));
        return true;
      },
    );
  });
}

test("persistent invisibility stops after the retry limit with a distinct recovery message", async (t) => {
  let checks = 0;
  mockRegistry(t, (source) => {
    if (source === "version") checks++;
    return new Response(null, { status: 404 });
  });
  let waits = 0;
  await assert.rejects(
    verifyPublishedEntries([entry], async () => {
      waits++;
    }),
    /not yet available.*31 checks.*@intloom\/cli@0\.0\.2.*original CI artifacts/,
  );
  assert.equal(checks, 31);
  assert.equal(waits, 30);
});

test("a wrong returned version fails instead of accepting its integrity", async (t) => {
  mockRegistry(t, (source) =>
    source === "version"
      ? Response.json({ ...metadata, version: "0.0.1" })
      : ready(source),
  );
  await assert.rejects(
    verifyPublishedEntries([entry], async () => assert.fail("Must not retry")),
    /Registry version mismatch.*received 0\.0\.1/,
  );
});

for (const status of [401, 403, 500]) {
  test(`HTTP ${status} is not treated as propagation or silently ignored`, async (t) => {
    mockRegistry(t, () => new Response(null, { status }));
    await assert.rejects(
      verifyPublishedEntries([entry], async () =>
        assert.fail("Must not retry"),
      ),
      new RegExp(`HTTP ${status}`),
    );
  });
}

test("missing registry integrity is a validation failure", async (t) => {
  mockRegistry(t, (source) =>
    source === "version"
      ? Response.json({ version: entry.version })
      : ready(source),
  );
  await assert.rejects(
    verifyPublishedEntries([entry], async () => assert.fail("Must not retry")),
    /Missing registry integrity/,
  );
});

test("malformed install metadata is not treated as an unpublished version", async (t) => {
  mockRegistry(t, (source) =>
    source === "install" ? Response.json({}) : ready(source),
  );
  await assert.rejects(
    verifyPublishedEntries([entry], async () => assert.fail("Must not retry")),
    /Missing registry install index/,
  );
});

test("a registry transport failure stops verification", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Transport unavailable");
  });
  await assert.rejects(
    verifyPublishedEntries([entry], async () => assert.fail("Must not retry")),
    /Transport unavailable/,
  );
});

function installFailure(stderr: string): Error {
  return Object.assign(new Error("npm install failed"), { code: 1, stderr });
}

test("a successful npm installation runs once without waiting", async () => {
  let installs = 0;
  await retryPublishedInstall(
    [entry],
    async () => {
      installs++;
    },
    async () => assert.fail("Must not wait"),
  );
  assert.equal(installs, 1);
});

for (const prefix of ["npm error", "npm ERR!"]) {
  test(`${prefix} ETARGET after successful metadata checks retries the actual installation`, async (t) => {
    const fetch = mockRegistry(t, ready);
    await verifyPublishedEntries([entry], async () =>
      assert.fail("Metadata is already visible"),
    );
    const failure = installFailure(
      `${prefix} code ETARGET\r\n${prefix} notarget No matching version found for ${entry.name}@${entry.version}.\r\n`,
    );
    let installs = 0;
    const waits: number[] = [];
    await retryPublishedInstall(
      [entry],
      async () => {
        if (++installs === 1) throw failure;
      },
      async (milliseconds) => {
        waits.push(milliseconds);
      },
    );
    assert.equal(fetch.mock.callCount(), 2);
    assert.equal(installs, 2);
    assert.deepEqual(waits, [10_000]);
  });
}

test("persistent npm ETARGET stops at the retry limit and preserves the original error", async (t) => {
  const log = t.mock.method(console, "log", () => {});
  const failure = installFailure(
    `npm error code ETARGET\nnpm error notarget No matching version found for ${entry.name}@${entry.version}.\n`,
  );
  let installs = 0;
  let waits = 0;
  await assert.rejects(
    retryPublishedInstall(
      [entry],
      async () => {
        installs++;
        throw failure;
      },
      async (milliseconds) => {
        assert.equal(milliseconds, 10_000);
        waits++;
      },
    ),
    (error: Error) => {
      assert.match(
        error.message,
        /not yet installable.*31 attempts.*@intloom\/cli@0\.0\.2.*original CI artifacts/,
      );
      assert.equal(error.cause, failure);
      return true;
    },
  );
  assert.equal(installs, 31);
  assert.equal(waits, 30);
  assert.equal(log.mock.callCount(), 30);
  assert.match(
    log.mock.calls[0].arguments[0],
    /Waiting for npm installation \(1\/31\): @intloom\/cli@0\.0\.2 \(ETARGET\)/,
  );
});

for (const target of [
  "@intloom/cli@0.0.1",
  "@intloom/utils@0.0.1",
  "third-party@1.0.0",
]) {
  test(`ETARGET for ${target} outside the published entries fails immediately`, async () => {
    const failure = installFailure(
      `npm error code ETARGET\nnpm error notarget No matching version found for ${target}.\n`,
    );
    let installs = 0;
    await assert.rejects(
      retryPublishedInstall(
        [entry],
        async () => {
          installs++;
          throw failure;
        },
        async () => assert.fail("Must not retry"),
      ),
      (error: Error) => error === failure,
    );
    assert.equal(installs, 1);
  });
}

for (const code of [
  "EBADENGINE",
  "EINTEGRITY",
  "E401",
  "E403",
  "E404",
  "ECONNRESET",
  "1",
]) {
  test(`npm ${code} is not treated as version propagation`, async () => {
    const failure = installFailure(
      `npm error code ${code}\nnpm error notarget No matching version found for ${entry.name}@${entry.version}.\n`,
    );
    await assert.rejects(
      retryPublishedInstall(
        [entry],
        async () => {
          throw failure;
        },
        async () => assert.fail("Must not retry"),
      ),
      (error: Error) => error === failure,
    );
  });
}

for (const [name, failure] of [
  ["missing stderr", new Error("Transport unavailable")],
  ["missing target", installFailure("npm error code ETARGET\n")],
  [
    "missing npm error code",
    installFailure("No matching version found for @intloom/cli@0.0.2.\n"),
  ],
  [
    "timed-out npm process",
    Object.assign(
      installFailure(
        `npm error code ETARGET\nnpm error notarget No matching version found for ${entry.name}@${entry.version}.\n`,
      ),
      { code: null, killed: true, signal: "SIGTERM" },
    ),
  ],
  [
    "non-npm exit code",
    Object.assign(
      installFailure(
        `npm error code ETARGET\nnpm error notarget No matching version found for ${entry.name}@${entry.version}.\n`,
      ),
      { code: "ENOENT" },
    ),
  ],
]) {
  test(`unrecognized installation failure is preserved: ${name}`, async () => {
    await assert.rejects(
      retryPublishedInstall(
        [entry],
        async () => {
          throw failure;
        },
        async () => assert.fail("Must not retry"),
      ),
      (error: Error) => error === failure,
    );
  });
}

const release = {
  commit: "local",
  versions: Object.fromEntries(
    publications.map(({ name }) => [
      name,
      ["@intloom/cli", "intloom"].includes(name) ? "0.0.2" : "0.0.1",
    ]),
  ) as PublicationVersions,
  selected: ["@intloom/cli", "intloom"] as const,
  entries: [
    entry,
    { ...entry, name: "intloom", file: "intloom-0.0.2.tgz" } as ReleaseEntry,
  ],
};

test("publication retry skips only byte-identical versions already present", async () => {
  const pending = await pendingPublications(
    { ...release, selected: [...release.selected] },
    async () => ({ version: entry.version, integrity: entry.integrity }),
  );
  assert.deepEqual(pending, []);
});

test("an existing version with different bytes still blocks publication", async () => {
  await assert.rejects(
    pendingPublications(
      { ...release, selected: [...release.selected] },
      async () => ({ version: entry.version, integrity: "different" }),
    ),
    /Version already exists with different content/,
  );
});
