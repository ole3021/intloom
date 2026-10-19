# Host

Host creates one independent project environment: canonical project root, validated `intloom.yaml`, built Loom registrations, Execution, Storage, Runtime, logging and checkpoint files. It owns their startup and shutdown order. Importing this module never starts a process; `entry.ts` explicitly invokes the side-effect-free process launcher.

`create-project-execution.ts` builds and freezes registry tables. `prepare-execution.ts` resolves the trusted source's executor policy and prepares only the required Agent model roles. Runtime receives that fixed policy and a narrow recovery validator. Credentials stay project-local; they are not copied into Run views or other projects' environment variables.

`project-host.ts` composes the resource owner and protocol adapters. `operations.ts` supplies borrowed ports; `prepare-run.ts` rechecks admission after asynchronous resource preparation. `restore-mirror.ts` owns offline target preparation and invokes Runtime recovery validation without constructing an executor or fake Storage. Shutdown stops admission, suspends Runtime, drains accepted storage work and releases the storage/service locks. A logical Run cancellation is separate from process shutdown. `checkpoints/store.ts` owns atomic file replacement and durability; Runtime owns checkpoint meaning and decides when to save.

The public private-package entry is `@intloom/kernel/host`. SDK capabilities come directly from `@intloom/loom-sdk`. See the [Kernel ownership contract](../../README.md).
