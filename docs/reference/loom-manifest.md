# npm Loom manifest

`loom.yaml` is the public description compiled and installed with a 0.4.0 npm Loom. The npm package name and version come from `package.json`. The [author schema](../../packages/loom-sdk/src/package-format/author.ts) validates the fields.

```yaml
name: File report
description: Save the supplied message as a text file.
commands:
  write:
    description: Write a UTF-8 report.
    entry: report.ts
    input:
      type: object
      properties:
        message: {type: string, minLength: 1}
      required: [message]
      additionalProperties: false
    output: UTF-8 report.txt
```

| Field | Meaning |
| --- | --- |
| `name`, `description` | Required display name and summary. |
| `commands` | At least one named command. Each requires a description, package-relative entry path, input JSON Schema object and human-readable output description. The default export of the entry carries its own SDK input/output schemas. |
| `defaultCommand` | Required when declaring multiple commands. Must name one of them. |
| `models` | Map slot names to `strength` and a `capabilities` array. Supported capability names are `tool_use` and `structured_output`. Requirements are checked package-wide. |
| `looms` | Map child npm package names to compatible version ranges. |
| `permissions` | Declared permission strings. Include required host tool binding names. These declarations do not isolate native code. |
| `check` | Package-relative module whose default export checks runtime prerequisites before a new execution. Fail the check with a useful error if a required executable or resource is missing. |
| `confirmations` | Named descriptions of business confirmation points. Implement the actual wait and response policy in the command. |
| `examples` | JSON examples available in command usage. |

See [package structure](../author/package-structure.md) for resources and TypeScript modules.
