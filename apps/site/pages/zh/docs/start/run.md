# 安装一个 Loom，拿到第一份文件

这个包把你给的文字写入 `report.txt`。准备好 [0.4.0 CLI](./setup)、npm 和 macOS 或 Linux 终端。无需模型账号或密钥。

<a href="/downloads/0.4.0/file-report-0.4.0.tgz" download>下载 file-report-0.4.0.tgz</a>，然后在终端进入下载文件所在的目录。

```sh
intloom install ./file-report-0.4.0.tgz
intloom run file-report
intloom run file-report --input '{"message":"First delivery"}'
```

只输入包名会显示可用命令 `write`。传入文字后，就会创建一次运行并显示运行编号。把下面的 `RUN_ID` 换成这个编号。第一行列出文件，找到 `report.txt` 对应的文件编号，替换第二行的 `ARTIFACT_ID`。

```sh
intloom artifact list --run RUN_ID
intloom artifact export ARTIFACT_ID --out ./report.txt
cat ./report.txt
```

打开文件应看到 `First delivery`。关掉终端后，用 `intloom status` 可以重新找到这次运行。[使用者 CLI](../use/runs) · [确认一份交付](../use/review)
