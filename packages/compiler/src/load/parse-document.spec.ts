import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, test } from "node:test";
import { LoomError } from "@intloom/utils";
import { parseYaml } from "./parse-document.ts";

describe("parseYaml", () => {
  for (const [label, yaml] of [
    ["duplicate keys", "name: first\nname: second\n"],
    ["aliases", "first: &ref value\nsecond: *ref\n"],
    ["unsupported tags", "name: !custom value\n"],
    ["non-string keys", "1: value\n"],
    ["reserved keys", "__proto__: value\n"],
    ["malformed syntax", "items: ["],
  ] as const) {
    test(`rejects YAML ${label} with source location`, () => {
      const file = resolve(tmpdir(), "workflow.yaml");
      assert.throws(
        () => parseYaml({ file, text: yaml }),
        (error) => {
          assert.ok(LoomError.is(error));
          assert.equal(error.code, "SOURCE_PARSE_FAILED");
          assert.equal(
            (error.cause as { location: { file: string } }).location.file,
            file,
          );
          return true;
        },
      );
    });
  }
});
