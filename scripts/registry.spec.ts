import assert from "node:assert/strict";
import { test } from "node:test";
import { publications } from "./publication.ts";
import {
  pendingPublications,
  registryVersion,
  retryPublishedInstall,
  verifyPublishedEntries,
} from "./registry.ts";
import {
  archiveName,
  type PublicationVersions,
  type ReleaseEntry,
  type ReleaseManifest,
} from "./release.ts";

const integrity = `sha512-${"A".repeat(86)}==`;
const entry: ReleaseEntry = {
  name: "@intloom/utils",
  version: "1.0.0",
  tag: "latest",
  file: archiveName("@intloom/utils", "1.0.0"),
  integrity,
  dependencies: {},
};
const metadata = { version: entry.version, dist: { integrity } };
const manifest: ReleaseManifest = {
  commit: "local",
  selected: [entry.name],
  entries: [entry],
  versions: Object.fromEntries(
    publications.map(({ name }) => [name, "1.0.0"]),
  ) as PublicationVersions,
};

test("visibility waits for both npm views and stops polling entries already visible", async (t) => {
  t.mock.method(console, "log", () => {});
  let round = 0;
  const calls: string[] = [];
  const second = { ...entry, name: "@intloom/compiler" as const };
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      calls.push(url);
      const index = Boolean(options.headers);
      const delayed = url.includes(encodeURIComponent(entry.name));
      if (delayed && round === 0 && !index)
        return new Response(null, { status: 404 });
      if (delayed && round < 2 && index) return Response.json({ versions: {} });
      return Response.json(
        index ? { versions: { [entry.version]: metadata } } : metadata,
      );
    },
  );
  await verifyPublishedEntries([entry, second], async (ms) => {
    assert.equal(ms, 10_000);
    round++;
  });
  assert.equal(round, 2);
  assert.equal(
    calls.filter((url) => url.includes(encodeURIComponent(second.name))).length,
    2,
  );
});

for (const source of ["version", "index"] as const) {
  for (const [name, response, message] of [
    [
      "integrity conflict",
      () => Response.json({ ...metadata, dist: { integrity: "different" } }),
      /integrity mismatch/,
    ],
    [
      "version mismatch",
      () => Response.json({ ...metadata, version: "2.0.0" }),
      /version mismatch/,
    ],
    [
      "malformed metadata",
      () => Response.json({}),
      /Missing registry integrity/,
    ],
    ["HTTP failure", () => new Response(null, { status: 503 }), /HTTP 503/],
  ] as const) {
    test(`${source} ${name} fails without visibility retries`, async (t) => {
      let waits = 0;
      t.mock.method(
        globalThis,
        "fetch",
        async (_url: string, options: RequestInit) => {
          const index = Boolean(options.headers);
          if (index !== (source === "index"))
            return Response.json(
              index ? { versions: { [entry.version]: metadata } } : metadata,
            );
          const result = response();
          return index && result.ok
            ? Response.json({
                versions: { [entry.version]: await result.json() },
              })
            : result;
        },
      );
      await assert.rejects(
        verifyPublishedEntries([entry], async () => {
          waits++;
        }),
        message,
      );
      assert.equal(waits, 0);
    });
  }
}

test("malformed install indexes and transport failures are not treated as absent versions", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) =>
      Response.json(options.headers ? { versions: [] } : metadata),
  );
  await assert.rejects(
    verifyPublishedEntries([entry]),
    /Missing registry install index/,
  );
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("network unavailable");
  });
  await assert.rejects(
    registryVersion(entry.name, entry.version),
    /network unavailable/,
  );
});

test("absent versions time out after the bounded number of checks", async (t) => {
  t.mock.method(console, "log", () => {});
  let waits = 0;
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 404 }),
  );
  await assert.rejects(
    verifyPublishedEntries([entry], async () => {
      waits++;
    }),
    /after 31 checks/,
  );
  assert.equal(waits, 30);
  assert.equal(fetch.mock.callCount(), 62);
});

function installFailure(target: string, code = "ETARGET") {
  return Object.assign(new Error("npm install failed"), {
    code: 1,
    stderr: `npm error code ${code}\nnpm error notarget No matching version found for ${target}.\n`,
  });
}

test("installation retries only exact published ETARGET versions and preserves exhaustion evidence", async (t) => {
  t.mock.method(console, "log", () => {});
  const failure = installFailure(`${entry.name}@${entry.version}`);
  let attempts = 0,
    waits = 0;
  const wait = async (ms: number) => {
    assert.equal(ms, 10_000);
    waits++;
  };
  await retryPublishedInstall(
    [entry],
    async () => {
      if (++attempts < 3) throw failure;
    },
    wait,
  );
  assert.equal(attempts, 3);
  assert.equal(waits, 2);
  for (const error of [
    installFailure("other@1.0.0"),
    installFailure(`${entry.name}@2.0.0`),
    installFailure(`${entry.name}@${entry.version}`, "EINTEGRITY"),
    new Error("lifecycle failed"),
  ]) {
    await assert.rejects(
      retryPublishedInstall(
        [entry],
        async () => {
          throw error;
        },
        wait,
      ),
      (cause) => cause === error,
    );
  }
  assert.equal(waits, 2);
  attempts = 0;
  await assert.rejects(
    retryPublishedInstall(
      [entry],
      async () => {
        attempts++;
        throw failure;
      },
      wait,
    ),
    (error: Error) => {
      assert.match(error.message, /after 31 attempts/);
      assert.equal(error.cause, failure);
      return true;
    },
  );
  assert.equal(attempts, 31);
});

test("publication preflight allows identical archives but rejects conflicts, backward tags and missing dependencies", async () => {
  assert.deepEqual(
    await pendingPublications(manifest, async () => ({
      version: entry.version,
      integrity,
    })),
    [],
  );
  assert.deepEqual(await pendingPublications(manifest, async () => undefined), [
    entry,
  ]);
  await assert.rejects(
    pendingPublications(manifest, async () => ({
      version: entry.version,
      integrity: "different",
    })),
    /different content/,
  );
  await assert.rejects(
    pendingPublications(manifest, async (_name, version) =>
      version === "latest" ? { version: "2.0.0", integrity } : undefined,
    ),
    /backwards/,
  );
  await assert.rejects(
    pendingPublications(
      {
        ...manifest,
        entries: [{ ...entry, dependencies: { "@intloom/loom-sdk": "1.0.0" } }],
      },
      async () => undefined,
    ),
    /Publish dependency first/,
  );
});
