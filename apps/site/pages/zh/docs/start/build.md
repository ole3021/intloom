# 制作第一个 Loom 包

这个命令接收姓名，交付一份文本文件。使用 [CLI](./setup)，在新的工作目录开始。使用本地候选依赖时，请从已经安装好依赖的候选目录开始。

```sh
intloom dev init ./hello --id hello
cd hello
```

打开 `loom.yaml` 看公开输入和交付承诺，打开 `loom.ts` 看 Code 实现，打开 `package.json` 看包名、版本和构建脚本。如果软件源提供所需版本，在 `hello` 中执行 `npm install`。使用本地候选包时，上级候选目录已提供这些依赖。构建后，换一个 npm 项目安装刚生成的归档：

```sh
npm run build
mkdir ../recipient
cd ../recipient
npm init -y
intloom install ../hello/dist/hello-*.tgz --project .
intloom run hello
intloom run hello hello --input '{"name":"Ada"}'
```

复制运行编号，再从文件列表里复制 `greeting.txt` 对应的文件编号。

```sh
intloom artifact list --run RUN_ID
intloom artifact export ARTIFACT_ID --out ./greeting.txt
cat ./greeting.txt
```

文件正文应为 `Hello, Ada!`。再用 `{"name":42}` 试一次，应收到输入校验错误。[开发者 CLI](../develop/cli) · [选择开发范式](../develop/choose-an-entry)
