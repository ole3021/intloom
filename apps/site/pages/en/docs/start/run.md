# Install a Loom and get your first file

This package writes your message to `report.txt`. You need the [0.4.0 CLI](./setup), npm and a macOS or Linux terminal. No model credentials are required.

<a href="/downloads/0.4.0/file-report-0.4.0.tgz" download>Download file-report-0.4.0.tgz</a> and open the folder containing the download in your terminal.

```sh
intloom install ./file-report-0.4.0.tgz
intloom run file-report
intloom run file-report --input '{"message":"First delivery"}'
```

The name alone shows the available command, `write`. Supplying the message starts a run and prints its ID. To retrieve the file, replace `RUN_ID` with that ID. In the list, copy the ID for `report.txt` and use it for `ARTIFACT_ID`.

```sh
intloom artifact list --run RUN_ID
intloom artifact export ARTIFACT_ID --out ./report.txt
cat ./report.txt
```

You should see `First delivery`. `intloom status` helps you find the run after closing the terminal. [Everyday CLI](../use/runs) · [Review a delivery](../use/review)
