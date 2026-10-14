---
title: Implementation Developer：实施开发
---

# Implementation Developer：实施开发

`implementation-developer` 是 Implementation 阶段的 Agent，使用 `coding` 角色或外部任务执行环境。

## 输入与职责

使用固定的已确认需求与设计、命令计划、项目快照和修复反馈。修改实际项目文件，并提交变更声明。

## Tools 与输出

业务 Tools 为 `readImplementationContext` 和 `submitImplementation`。工程 Tools 支持列出、读取、写入、删除文件，并以参数数组运行命令。最终 outcome 为 `ready`。

Code 对照提案与实际变更、运行约定检查、提供修复反馈，并在提交 Implementation Record 前重查最终快照。Agent 提交的声明不能替代宿主证据。

## 如何评估工作

阅读实际 diff、文件来源和检查结果。检查失败可在同一 Run 内返回实施。取消或失败后保留已修改文件，新工作之前先检查它们。参见[阶段详解](../stages.md)和[结果](../results.md)。
