# Distribute a Loom

Build on the author's machine. `npm run build` invokes `intloom-build` in the scaffold and produces an installable npm archive in `dist/`. The archive contains compiled command modules, the manifest and declared resources. npm resolves ordinary runtime dependencies on the recipient's machine. Declare separately installed Looms by package name and version range under `looms`.

Give the recipient the archive or a versioned package name available in their registry, one sample invocation, the expected result, and any model, tool or system requirements. Include template files your example requires, or explain how to supply them. Recipients of the built package need the CLI and its runtime prerequisites.

Before sharing, follow [the recipient check](first-package.md) with a fresh npm project. For an Agent package, configure a compatible Harness and inspect the actual tool result. For a Workflow, exercise each required wait or review. When a file is promised, export and inspect its contents. Record any live model, approval or platform paths that still need verification.
