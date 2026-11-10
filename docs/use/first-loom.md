# Get your first file

The file-report Loom writes a message you supply to a text file. It runs locally without a model or an API key. Use a macOS or Linux terminal with npm and a supported Node version (`^22.22.0 || ^24.0.0 || ^26.0.0`).

## Get the CLI and the example

Use the 0.4.0 CLI supplied by your team. If your registry carries this version, install it with `npm install --global intloom@0.4.0`. If you have a local candidate bundle, follow its [installation instructions](../maintainers/candidate.md) up to the PATH export. Run `intloom --version` in the same terminal and check that it prints `0.4.0`.

Save the [file-report archive](../../apps/site/pages/public/downloads/0.4.0/file-report-0.4.0.tgz) to a folder and open your terminal there. On GitHub use **Download raw file**. The archive was built from this [three-file author project](../../test/integration/fixtures/file-report).

```sh
intloom install ./file-report-0.4.0.tgz
intloom run file-report
intloom run file-report --input '{"message":"First delivery"}'
```

The name alone shows the available command, `write`, and its input. The last line runs it and prints a run ID. If you close the terminal, `intloom status` lists recent work.

## Save the result

Replace `RUN_ID` below with that run ID. In the list of files, find `report.txt` and copy its artifact ID into the second command in place of `ARTIFACT_ID`.

```sh
intloom artifact list --run RUN_ID
intloom artifact export ARTIFACT_ID --out ./report.txt
cat ./report.txt
```

The file contains `First delivery` followed by a newline. Choose another destination if `report.txt` already exists. Next, [follow a run](cli.md) or [review a file before accepting it](questions-and-review.md).
