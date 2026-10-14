---
title: 理解 Intent 结果
---

# 理解 Intent 结果

结合 Run 的真实提交引用阅读保存对象。

| 对象 | 应查看的内容 |
| --- | --- |
| Specification Artifact | 已确认需求、目标和验收条件 |
| Specification Record | 变更、反馈及真实问题和确认历史 |
| Solution Artifact | 已确认设计、决策、风险和场景 |
| Solution Record | 设计变更、反馈和约定检查 |
| Implementation Record | 实际变更文件、来源、哈希和命令证据 |
| Validation Artifact | 目标评估、发现、证据及计算统计 |

```sh
intloom artifacts --flow intent
intloom records --flow intent
intloom artifact --flow intent --stage validation
```

使用实际 ID 查看 Record 详情。它们是独立业务 ID，不应根据 Run ID 推测。

## 理解完成

`completed` 表示 Validation 报告已经提交，Workflow 到达终点。阅读哪些目标被检查、哪些通过、由什么证据支持，以及哪些检查不可用或未完成。

构建成功不能证明运行行为、模型质量、部署或发布。Agent 声明需要证据支持；Validation 统计由 Code 计算，不直接接受提案中的总数。

后续 Run 可能替换当前 Artifacts。评估原 Run 时使用其 revision 识别结果。后续失败会保留之前成功提交的阶段结果和项目修改。

参见[结果查询与导出](../usage/results.md)。

接口、场景步骤等嵌套对象的变更归入所属模块或场景验收；引用嵌套对象不会绕过必查范围。

Validation 报告记录本轮验收范围及选取原因。范围外的历史对象未在本轮重新验证；历史通过结果属于原 Run 和原版本，不能作为当前代码已通过的证据。
