---
title: 管理 Workflow 包
---

# 管理 Workflow 包

Workflow 安装属于已初始化项目。修改包时保持 Service 停止。

```sh
intloom stop
intloom loom list
intloom loom add @intloom/intent
intloom loom remove @intloom/intent
```

上面的 add 与 remove 是独立示例。add 接受注册表包名或本地 `.tgz` 归档。裸包名选择注册表当前版本，并保存精确安装身份。安装禁用包脚本。

## 已安装包与已加载 Workflow

包有 npm 名称和版本，生成的 Blueprint 有 `intent` 等 `loomName`。`loom list` 查看安装包；Service 启动后，`looms` 查看已加载的执行定义。

加载检查包元数据、产物协议、命名 ESM 导出、资源引用和附件。一个包不可用时可以单独报告错误，其他包仍可使用。重新安装前先查看诊断阶段。

## 保留恢复输入

保持本地来源归档可访问。IntLoom 保存归档身份并核验安装；删除原归档可能导致无法恢复安装。

移除 Workflow 包会保留正式 Artifacts 和 Records，但可能让未完成 Run 的检查点无法继续。恢复这些执行前先安装兼容的包。

参见 [Workflow 兼容性](../reference/compatibility.md)和[构建自己的包](../development/build.md)。
