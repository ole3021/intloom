---
title: 从意图到验证交付
---

# 从意图到验证交付

本示例开发本地 Todo 应用。先准备 Intent 和所选执行环境。

```text
Build a Todo app with local persistence.
Users can create, complete, rename, and delete tasks.
Keep the UI usable on narrow screens.
Propose the technical design and verification commands before changing files.
```

通过所选入口把这些内容作为一个完整意图提交。CMD 示例：

```sh
intloom flow intent --intent-file ./request.txt
```

## 1. 确认需求

Specification 整理目标、功能、场景、验收条件和未解决问题。回答持久化、平台和预期行为等实际问题。审核累计需求，缺失时提供具体反馈，只确认你确实认可的版本。

## 2. 确认方案

Solution 读取已确认 Specification 和项目上下文。审核应用结构、技术决策、风险、影响范围和构建测试命令，确认命令可以在项目环境运行。反馈返回设计，确认后保存 Solution。

## 3. 检查实施

Implementation 读取固定的上游依据，通过声明 Tools 修改实际文件并提交变更。宿主 Code 执行约定检查，必要时返回修复反馈。生成的 Record 保存文件来源、哈希和真实命令结果。

## 4. 阅读验证

Validation 独立评估已确认目标和实际交付。阅读证据、命令输出、发现及尚未验证的内容。流程完成不代表所有目标均通过。

全程保留同一个 Run ID。观察断开后查看原 Run；失败后先检查已有文件和提交，再开始新工作。[结果说明](./results.md)介绍应读取的对象。
