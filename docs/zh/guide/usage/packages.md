---
title: 管理 Workflow 包
description: 安装、检查、替换和恢复项目的 Workflow 依赖。
---

# 管理 Workflow 包

Workflow 包独立于 CLI。包名标识一次安装，编译后的 `flowName` 标识 `flow` 执行的工作流。

## 安装与检查

修改包之前先停止项目服务：

```sh
intloom stop
intloom workflow add /absolute/path/to/workflow.tgz
intloom workflow list
intloom start
intloom flows
```

也可以传入注册源中的包名、版本或标签。裸包名只在选择时解析一次注册源的 `latest`。IntLoom 将实际版本和分发归档的校验和记录到 `intloom.yaml`。

| 命令 | 检查内容 |
| --- | --- |
| `workflow list` | 已声明的包和安装完整性，可离线使用 |
| `flows` | 服务加载的 Workflows、加载诊断和 CLI 入口就绪状态 |
| `doctor --execution agent_ide` | 外部 MCP 执行入口就绪状态 |

安装状态 `ready` 不能证明可执行导出有效、模型兼容或业务行为成功。

## 替换或移除

当前没有更新命令或热重载。重复包名会被拒绝，包括尝试添加同一包的新版本。替换已安装包时：

```sh
intloom stop
intloom workflow remove @your-scope/workflow
intloom workflow add @your-scope/workflow@1.2.3
intloom start
```

这些名称和版本是占位符。移除和添加是两个操作，不是一次原子升级。保留旧包来源，以便新安装失败时使用。移除包不会删除已提交的 Artifacts 和 Records。

修改 Workflow 资源前，先完成或取消未结束的 Run。恢复要求相同的包身份和编译资源内容；即使 npm 版本未变，重新构建的包也可能不兼容。

## 安装与恢复

项目安装到 `.intloom/workflows/`。CLI 只管理 `workflows` 声明，其他 YAML 字段和注释由用户维护。添加、移除和启动共用操作锁。准备失败会保留原有安装；如果 YAML 被并发编辑，发布配置会停止，不会覆盖用户修改。

启动时将安装内容与已保存的声明比较，并恢复缺失或损坏的内容。本地归档声明包含绝对 `source` 路径，请保留该文件，移动后更新路径。原始校验和仍必须匹配。

npm 安装脚本会被禁用。需要安装阶段脚本的包不在此安装器支持范围内。即使 Workflow 来自本地归档，运行时依赖仍须能够解析。

归档校验和固定的是该 Workflow 分发包，不会在删除缓存后固定完整的传递依赖图；缓存中的 npm 锁文件不构成持久的项目依赖锁保证。

启动失败或出现过期锁时，使用[诊断](./diagnostics.md)。不要删除活跃所有者的锁来强行修改包。
