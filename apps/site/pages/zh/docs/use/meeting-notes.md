# 从会议原文生成纪要

把会议逐字稿、会后速记或已整理的笔记交给官方示例包 meeting-notes。它会按原文语言交付一个 Markdown 文件。最上方是可以直接转发的几条要点，下方是完整纪要，每条记录都附有原文行号和引文。

## 安装示例包

准备 [0.4.0 CLI](../start/setup)，并[配置支持结构化输出的模型](../reference/configuration)。会议正文会发送给所配置的模型。<a href="/downloads/0.4.0/meeting-notes-1.0.0.tgz" download>下载 meeting-notes-1.0.0.tgz</a>，在下载目录运行以下命令。

```sh
intloom install ./meeting-notes-1.0.0.tgz
intloom run meeting-notes
```

## 粘贴原文或使用文件

```sh
intloom run meeting-notes summarize --prompt '林：我建议周五上线。
陈：支付回归还没过，日期先别定。
林：同意，今天只定首批灰度范围，10%。上线日期继续待定。
陈：我周四下班前把支付回归结果发出来。'
```

核对要点时，应该能找到已确定的 10% 灰度范围、仍待定的上线日期，以及陈承诺周四下班前发出的回归结果。原文没有会议日期，「周四」保留原样。

较长的记录可以保存为 UTF-8 编码的文本或 Markdown 文件。在文件所在目录运行：

```sh
intloom run meeting-notes summarize --files ./notes.md
```

每次提供一种来源即可，原文可以没有发言人姓名。格式按会议的主要产出选择。方案评审保留备选和取舍，项目同步突出变化与阻塞，探索会区分想法、假设与验证计划，其余会议使用结论与行动型。行动没有明确负责人时只记录事项本身。

## 导出完整纪要和要点

将命令返回的运行编号填入 `RUN_ID`，从文件列表中找到 `meeting-notes.md` 的编号并替换 `ARTIFACT_ID`。

```sh
intloom artifact list --run RUN_ID
intloom artifact export ARTIFACT_ID --out ./meeting-notes.md
```

完整纪要中的 `L3` 表示引文出自原文第 3 行。<a href="/downloads/0.4.0/meeting-notes-preview.md" download>查看上述灰度讨论的一份完整交付样例</a>。

如果输入只有会议邀请和待讨论议程，这次运行会以 `AGENDA_WITHOUT_DISCUSSION` 结束。食谱等无关材料会返回 `NOT_MEETING_CONTENT`。两种情况都不会交付文件，补充实际讨论记录后可重新运行。
