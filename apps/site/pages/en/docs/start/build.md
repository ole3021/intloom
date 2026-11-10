# Build your first Loom

The command accepts a name and delivers a text file. Use the [CLI](./setup). Start in a fresh working folder, or inside the installed local candidate when using candidate dependencies.

```sh
intloom dev init ./hello --id hello
cd hello
```

Read `loom.yaml` for the command's input and delivery promise, `loom.ts` for the Code entry and `package.json` for the package identity and build script. If the pinned dependencies are available from your registry, run `npm install` in `hello`. If you started inside the installed candidate, the enclosing directory supplies them. Build and try the archive from a different npm project:

```sh
npm run build
mkdir ../recipient
cd ../recipient
npm init -y
intloom install ../hello/dist/hello-*.tgz --project .
intloom run hello
intloom run hello hello --input '{"name":"Ada"}'
```

Copy the returned run ID, then copy the artifact ID for `greeting.txt` from the file list.

```sh
intloom artifact list --run RUN_ID
intloom artifact export ARTIFACT_ID --out ./greeting.txt
cat ./greeting.txt
```

The file should contain `Hello, Ada!`. Input `{"name":42}` should be rejected. [Author CLI](../develop/cli) · [Choose an entry](../develop/choose-an-entry)
