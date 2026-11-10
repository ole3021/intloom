#!/usr/bin/env node
import { resolve } from "node:path";
import { buildPackage } from "./build-package.ts";
const directory = resolve(process.argv[2] ?? ".");
console.log(
  await buildPackage(directory, process.argv[3] ?? resolve(directory, "dist")),
);
