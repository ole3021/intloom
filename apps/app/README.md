# IntLoom Studio

Studio is a desktop client for the local Intloom service. Its installer includes Node.js, npm and Kernel. Studio starts its bundled Kernel on launch and reuses a running service with the same Kernel version. On upgrade it interrupts the older service. The new Kernel reconciles unfinished Runs, continues saved answers and completed child results, and displays a recovery issue for an incompatible or unavailable checkpoint. A Run without a saved execution boundary is marked interrupted. Pending human questions stay open. A newer running Kernel requires a matching Studio update. Closing Studio leaves the service and its runs available to other clients.

Open **运行配置** to see the active model and credential reference. The [host configuration guide](../../docs/reference/configuration.md) covers setting global API keys for Studio on macOS.

## Run a Loom

1. Open **Loom 库 → 安装 Loom**. Paste an npm package name (optionally with a version or tag), an npm package page URL, or a public GitHub repository URL. You can also choose a built local `.tgz`. Review the name, version and source, then select **安装**. Studio uses npm to install every source into the global directory shown in **服务管理**.
2. For a first run, install `@intloom/meeting-notes` by name. [Configure a model with structured output](../../docs/reference/configuration.md), open the package card and select `summarize`. Choose **粘贴文本** to paste meeting notes or **本地文件 → 选择文件…** to select a UTF-8 text or Markdown file. Start the run with your chosen source.
3. The detail page opens with the Run ID. On completion, select **打开文件** to open an editable copy of `meeting-notes.md` in the system application, or **导出到…** to save it elsewhere. Export preserves existing files at the destination.
4. Open the same Run ID in the CLI or return to it after restarting Studio. Pending questions from child runs appear on the parent's detail page. **服务管理** previews unfinished runs before shutting down the shared service.

The [meeting-notes guide](../../examples/meeting-notes/README.md) includes sample transcripts and minutes. If the Loom rejects unrelated material, the detail page shows `NOT_MEETING_CONTENT` and lets you start again with new input.

A repository URL opens its latest stable GitHub Release. You can paste a specific Release page or its `.tgz` asset URL. If a release contains several built Loom packages, choose one in the preview. The author must provide a built npm archive. An npm version page selects that version. Studio verifies that the archive still matches the preview before npm installs it and prepares its declared child Looms.

An identical installed package offers **打开 Loom**. A different version shows both versions before replacement. To remove a global package, open its detail page and select **更多 → 卸载 Loom**.

A new installation starts with an empty library. Agent Looms use the service's global and project model configuration. Settings can display effective model references and the selected execution harness. [Configuration reference](../../docs/reference/configuration.md)

## Install a published release

Open [Studio releases on GitHub](https://github.com/ole3021/intloom/releases/latest) and choose the `IntLoom-Studio-` installer for your system. macOS has separate DMGs for Apple silicon (`macos-arm64`) and Intel (`macos-x64`). Windows x64 uses a ZIP containing the installer, and Linux x64 uses a `.tar.gz` installer archive. Each installer has a matching `.sha256` file. The initial macOS release is distributed without Developer ID signing or Apple notarization. Gatekeeper may block it on first launch.

## Update an installed Studio

Stable builds check for a newer Studio version at startup. When one is available, select **Studio 更新** above service management in the sidebar to read the release notes and download the update for your system. You can close the panel and continue working. Select the Studio name at the top of the sidebar, or **关于 Studio** in the application menu, to see the installed version and check manually.

After Studio verifies the download, select **重启并更新** to install it and reopen the current page. Studio lists local runs that a restart would interrupt and asks you to finish unsaved input first. Saved review requests remain available after restarting. The About screen includes a link to the release installers if an update fails.

## Develop and debug the UI

From the repository root, use the pinned Node.js and Bun versions. Desktop packaging uses the native C compiler for the launcher.

```sh
bun install --frozen-lockfile
bun run --cwd apps/app dev
```

For a native UI rehearsal, run `bun run --cwd apps/app dev:mock`. On macOS, start an installed copy in that mode with `open -n -a "IntLoom Studio" --args --mock`. On Linux and Windows, pass `--mock` to the installed native launcher. The mock has its own persisted sample runs, simulated interactions and files. Set `INTLOOM_STUDIO_MOCK_DIR` for a fresh rehearsal. For a browser-only, in-memory preview, run `bun run --cwd apps/app dev:web`.

The first native build downloads platform tools. Produce an installer with `bun run --cwd apps/app desktop:release`. The installer check starts both native modes and exercises the bundled service with a built Code Loom.

[Desktop release notes](../../releases/app) · [Component licenses](src/view/components/ui/LICENSE)
