---
title: 本地执行镜像
---

# 本地执行镜像

镜像捕获受支持的安全执行边界，用于本地检查和受控重放。在来源项目配置中明确启用：

```yaml
mirror:
  enabled: true
  files:
    include: []
    exclude: []
```

根据项目声明业务文件规则，自动排除项保护宿主拥有的路径。已发布镜像包含 Stage State、正式 Storage 和声明的文件范围，存放于 `.intloom/mirrors/`。

## 恢复到其他项目

准备独立、已初始化的目标，安装当前兼容 Workflow 和配置，停止 Service，并保持业务数据为空。从 list/inspect 获取实际 ID：

```sh
intloom mirror list --json
intloom mirror inspect MIRROR-ID --json
intloom mirror restore MIRROR-ID --to ../experiment --scope workflow --dry-run
intloom mirror restore MIRROR-ID --to ../experiment --scope workflow
intloom start --project ../experiment
intloom run resume RUN-example --project ../experiment
intloom mirror export TRACE-ID --to ../mirror-export
```

恢复和启动后 Run 仍暂停。范围执行结束后，通过 `run resume --scope workflow` 明确选择下一范围。

| 范围 | 停止边界 |
| --- | --- |
| `step` | 一个 Step，要求真实 `step_before` 镜像 |
| `stage` | 当前 Stage 访问结束、下一初始化之前 |
| `workflow` | 继续剩余受支持执行 |

`step_after` 只根据已保存结果推进路由，不重复调用。终态镜像只能检查和导出。当前位置、路由、Schema 和执行策略必须兼容。

捕获失败会暂停 Run，resume 重试捕获。持续失败时可以明确使用 `run resume RUN-example --scope workflow --abandon-mirror` 放弃该 Run 的后续捕获，不会自动降级。

镜像不包含外部服务，也不能撤销消息或远程写入；其中包含原始业务数据。限制为单文件 64 MiB、单镜像 1 GiB、10,000 项。未完成恢复的标记应保留到检查并清理本次创建内容之后。
