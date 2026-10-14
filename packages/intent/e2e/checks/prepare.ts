import { constants } from "node:fs";
import { copyFile, lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const context = JSON.parse(
  await readFile(process.argv[2] as string, "utf8"),
) as {
  project: string;
  caseDirectory: string;
  storage: string;
};
const baseline = join(context.caseDirectory, "baseline/intloom");
const present = await lstat(baseline).catch((error: NodeJS.ErrnoException) => {
  if (error.code === "ENOENT") return undefined;
  throw error;
});
if (!present)
  console.log(
    JSON.stringify({ status: "skipped", reason: "No prepared baseline." }),
  );
else {
  if (context.storage !== "file")
    throw new Error("This prepared Intent baseline requires file Storage.");
  for (const name of ["artifacts", "records"])
    for (const file of await readdir(join(baseline, name)))
      await copyFile(
        join(baseline, name, file),
        join(context.project, "intloom", name, file),
        constants.COPYFILE_EXCL,
      );
  await copyFile(
    join(baseline, "store.json"),
    join(context.project, "intloom/store.json"),
    constants.COPYFILE_EXCL,
  );
  console.log(
    JSON.stringify({
      status: "copied",
      source: "baseline/intloom",
      historyPreserved: true,
    }),
  );
}
