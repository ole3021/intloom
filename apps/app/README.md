# IntLoom Studio

Studio is a desktop client for the local Intloom service. Its installer includes Node.js, npm and Kernel. Studio can start the service itself or connect to the service that the CLI already started. Closing Studio leaves the service and its runs available to other clients.

## Run a Loom

1. Open **Loom 库 → 安装 Loom**. Paste an npm package name (optionally with a version or tag), an npm package page URL, or a public GitHub repository URL. You can also choose a built local `.tgz`. Review the name, version and source, then select **安装**. Studio uses npm to install every source into the global directory shown in **服务管理**.
2. For a first run, install the built `file-report` archive, open its package card, select `write` and choose **填写启动参数**. Enter a message and start the run. The optional project directory applies to that run.
3. The detail page opens with the Run ID. On completion, select **打开文件** to open an editable copy of `report.txt` in the system application, or **导出到…** to save it elsewhere. Export preserves existing files at the destination.
4. Open the same Run ID in the CLI or return to it after restarting Studio. Pending questions from child runs appear on the parent's detail page. **服务管理** previews unfinished runs before shutting down the shared service.

For the official [meeting-notes example](../../examples/meeting-notes/README.md), install its archive and open `summarize`. Choose **粘贴文本** for a transcript or **本地文件 → 选择文件…** for a UTF-8 text or Markdown file. Switching tabs keeps both drafts, and starting the run submits the active source. On completion, export `meeting-notes.md`. If the Loom rejects unrelated material, the detail page shows `NOT_MEETING_CONTENT` and lets you start again with new input.

A repository URL opens its latest stable GitHub Release. You can paste a specific Release page or its `.tgz` asset URL. If a release contains several built Loom packages, choose one in the preview. The author must provide a built npm archive. An npm version page selects that version. Studio verifies that the archive still matches the preview before npm installs it and prepares its declared child Looms.

An identical installed package offers **打开 Loom**. A different version shows both versions before replacement. To remove a global package, open its detail page and select **更多 → 卸载 Loom**.

A new installation starts with an empty library. Agent Looms use the service's global and project model configuration. Settings can display effective model references and the selected execution harness. [Configuration reference](../../docs/reference/configuration.md)

## Install a published release

Open [Studio releases on GitHub](https://github.com/ole3021/intloom/releases?q=app-v) and choose the `IntLoom-Studio-` installer for your system. macOS has separate DMGs for Apple silicon (`macos-arm64`) and Intel (`macos-x64`). Windows x64 uses a ZIP containing the installer, and Linux x64 uses a `.tar.gz` installer archive. Each installer has a matching `.sha256` file. The initial macOS release is distributed without Developer ID signing or Apple notarization. Gatekeeper may block it on first launch.

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
