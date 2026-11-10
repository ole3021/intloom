# Build a Loom someone else can run

Build a greeting Loom that accepts `{"name":"Ada"}` and delivers a UTF-8 file containing `Hello, Ada!`. This Code example needs Node, npm and the [CLI](../use/first-loom.md).

## Create the author project

Start in a new working folder. Run:

```sh
intloom dev init ./hello --id hello
cd hello
```

Open `loom.yaml` to see the public command and its input. Open `loom.ts` to see the Code entry that writes the greeting. The generated `package.json` pins the author dependencies and sets its build script to `intloom-build`.

If your registry serves the pinned dependencies, run `npm install` here. For a local candidate, start the tutorial inside the [installed candidate directory](../maintainers/candidate.md) and create `hello` there. Its enclosing `node_modules` supplies the matching author dependencies and executable. Then build:

```sh
npm run build
```

The output is `dist/hello-*.tgz`. The Loom has its own version, independent of the CLI.

## Try the archive as a recipient

Create a separate folder outside the author project. From `hello`:

```sh
mkdir ../recipient
cd ../recipient
npm init -y
intloom install ../hello/dist/hello-*.tgz --project .
intloom run hello
intloom run hello hello --input '{"name":"Ada"}'
```

Copy the run ID into `intloom artifact list --run RUN_ID`. Replace `ARTIFACT_ID` with the ID for `greeting.txt`:

```sh
intloom artifact export ARTIFACT_ID --out ./greeting.txt
cat ./greeting.txt
```

Expected text: `Hello, Ada!`. Try `{"name":42}` as the input and check that it is rejected. You can now send the archive, sample input and expected output to another user. Next, [choose an entry for your real task](choose-an-entry.md) and [inspect the package structure](package-structure.md).
