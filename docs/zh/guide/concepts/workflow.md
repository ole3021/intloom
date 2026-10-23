---
title: Workflow、Stage、Step 与 Run
---

# Workflow、Stage、Step 与 Run

| 概念 | 含义 |
| --- | --- |
| Project | 配置、已安装 Workflow 声明、源文件与数据 |
| Workflow | 可复用的具名阶段与路由定义 |
| Stage | 有 Schema、初始化器和 Step 拓扑的业务阶段 |
| Step | 一次 Code 或 Agent 执行及其声明 outcome 路由 |
| Run | 针对原始意图执行一次 Workflow |

Workflow 包编译为 `blueprint`、`codes`、`agentSpecs`。Service 加载资源、注册 `loomName`，在执行被接收后创建 Run。

## 路由

Workflow 声明入口 Stage，每个 Stage 声明入口 Step。Code/Agent 返回 outcome。Step 路由选择下一个 Step 或结束 Stage，再由 Stage outcome 选择下一 Stage 或结束 Workflow。

循环通过明确路由表达。一次 Stage 访问内 State 持续存在，再次进入 Stage 会初始化新绑定。在 Step 循环中清空 State 不会自动再次初始化。

## 定义与执行

安装包不创建 Run，启动 Service 加载定义，`run` 创建执行，`answer` 继续执行。Run ID 和 action ID 标识不同对象。

`exclusive: true` 阻止同宿主中的其他竞争活跃 Run，包括等待。其他定义可以允许并发。Intent 四阶段是具体 Workflow，不是框架的统一要求。

参见[路由开发](../development/stages.md)和[生命周期](./lifecycle.md)。
