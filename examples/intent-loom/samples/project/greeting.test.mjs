import assert from "node:assert/strict";
import { greet } from "./greet.mjs";

assert.equal(greet("Ada"), "Hello, Ada!");
assert.equal(greet("陈🌍"), "Hello, 陈🌍!");
