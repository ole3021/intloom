---
title: 按症状排查
---

# 按症状排查

| 症状 | 检查与下一步 |
| --- | --- |
| 命令版本不符 | 可执行解析、Node 版本、开发启动器与发布版区别 |
| init 拒绝目录 | 使用新/空目标，重试前查看部分成功 |
| Service 不可用 | status、服务日志、进程身份；过期资源先预览 recover |
| 安装包却没有 flows | 加载阶段与错误、协议、生成导出及附件 |
| CMD/TUI 无法执行 | doctor cli、llms.default、启动环境；配置改变后重启 |
| MCP 无连接 | 已有 Service、生成路径、同一个可信项目、客户端诊断 |
| MCP 停在 Agent 等待 | 客户端认领/Tool/完成协议、当前 pendingAgentCall |
| 回答被拒绝 | 当前 action ID、精确 question ID、完整数组、允许跳过 |
| 模型或 Tool 失败 | Run lastError、执行日志、提供方及输入输出 Schema |
| Artifact 与旧 Run 不同 | 真实提交 revision；当前值不是历史值 |
| 镜像恢复失败 | 准备的已停止目标、兼容拓扑/Schema、镜像种类与范围 |
| 捕获失败暂停 Run | 修复原因、明确继续捕获；选择放弃时只支持 workflow 范围 |

## 重复副作用前先诊断

先确定项目、安装版本、Service 实例和原 Run。阅读 status、doctor、flows、attach、logs，判断失败来自本地设置、传输、接收、运行、业务验证还是输出导出。

命令结果未知时，工作可能仍在运行。查询原 operation/Run，不新建另一 flow。保留已提交文件和数据，检查后再决定如何重试。

参见[错误参考](../reference/errors.md)、[诊断](../usage/diagnostics.md)和[报告问题](./reporting.md)。
