---
title: 收集有效诊断信息
---

# 收集有效诊断信息

有效报告把具体操作、预期行为、实际输出和受影响执行关联起来。

## 包含内容

- IntLoom 和 Node 版本；适用时说明源码或开发启动器。
- 入口：CMD、TUI，或具名 MCP 客户端及版本。
- 最小复现、精确命令或用户操作、预期与实际结果。
- 项目设置及相关非秘密配置。
- 可获得的 Run ID、游标、action ID、Service instance、operation ID。
- 分类错误、有限日志和真实 Artifact/Record 引用。
- 失败前发生的变更、是否重试操作，以及仍在运行的内容。

```sh
intloom --version
node --version
intloom status --json
intloom doctor --execution cli --json
intloom looms --json
intloom attach RUN-example --json
intloom logs RUN-example --debug --json
```

外部 MCP 就绪检查使用 agent_ide。安全配置投影可以帮助诊断，但分享前检查每个导出文件和日志。保护凭据、连接 token 和 Agent ownerToken；业务 Artifacts 和镜像导出可能包含敏感项目内容。

## 保留原始案例

超时或断开后查询原 Run。新建另一 flow 复现可能修改文件或掩盖原原因。修复与重新验证应和最初失败分别记录。

[故障排查](./troubleshooting.md)提供诊断顺序。
