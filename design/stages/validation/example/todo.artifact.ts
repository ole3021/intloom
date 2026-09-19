/**
 * 按 27 条上游 Record 顺序验证当前 todo 实现后的最新 Artifact。
 * 完整范围预先声明，逐批将 undone/not_run 更新为有证据的结论。
 * 当前完成 27/27 批；历史快照与真实执行证据见 workflow/。
 * 原 Implementation 历史代码证据已缺失，本文件不代表 27 个历史版本的验证。
 * 路径相对仓库根目录；Validation 只保存 Artifact，没有创建 Record。
 */
import type { ValidationArtifact } from '../artifact.js';

export const todoValidationArtifact = {
  "scope": {
    "specification": {
      "requirement_refs": [
        "SREQ-display",
        "SREQ-create",
        "SREQ-toggle",
        "SREQ-count",
        "SREQ-edit",
        "SREQ-delete",
        "SREQ-toggle-all",
        "SREQ-clear-completed",
        "SREQ-filter",
        "SREQ-navigation",
        "SREQ-persist",
        "SREQ-information"
      ],
      "acceptance_refs": [
        "SACC-display-single-list",
        "SACC-display-order",
        "SACC-display-empty",
        "SACC-display-empty-filter",
        "SACC-display-plain-text",
        "SACC-display-layout",
        "SACC-display-heading-style",
        "SACC-display-row-style",
        "SACC-display-footer-style",
        "SACC-create-entry",
        "SACC-create-submit",
        "SACC-create-draft",
        "SACC-create-trim",
        "SACC-create-blank",
        "SACC-create-duplicate",
        "SACC-create-one-per-submit",
        "SACC-create-in-completed",
        "SACC-create-plain-text",
        "SACC-create-input-style",
        "SACC-toggle-complete",
        "SACC-toggle-reopen",
        "SACC-toggle-isolation",
        "SACC-toggle-state-style",
        "SACC-count-wording",
        "SACC-count-updates",
        "SACC-count-visibility",
        "SACC-count-global",
        "SACC-edit-enter",
        "SACC-edit-hide-controls",
        "SACC-edit-enter-submit",
        "SACC-edit-blur-submit",
        "SACC-edit-enter-then-blur",
        "SACC-edit-escape",
        "SACC-edit-escape-blank",
        "SACC-edit-delete-blank",
        "SACC-edit-delete-updates",
        "SACC-edit-same-item-in-filter",
        "SACC-edit-plain-text",
        "SACC-edit-input-style",
        "SACC-delete-hover",
        "SACC-delete-either-state",
        "SACC-delete-updates",
        "SACC-delete-button-style",
        "SACC-toggle-all-complete",
        "SACC-toggle-all-reopen",
        "SACC-toggle-all-derived",
        "SACC-toggle-all-empty-reset",
        "SACC-toggle-all-global",
        "SACC-clear-completed-visibility",
        "SACC-clear-completed-remove",
        "SACC-clear-completed-after-clear",
        "SACC-clear-completed-global",
        "SACC-filter-views",
        "SACC-filter-selection",
        "SACC-filter-unchanged",
        "SACC-filter-complete-in-active",
        "SACC-filter-reopen-in-completed",
        "SACC-filter-mutation-sync",
        "SACC-filter-selected-style",
        "SACC-navigation-default-direct",
        "SACC-navigation-click",
        "SACC-navigation-route-consistency",
        "SACC-navigation-history",
        "SACC-navigation-refresh",
        "SACC-persist-automatic",
        "SACC-persist-isolation",
        "SACC-persist-create",
        "SACC-persist-edit",
        "SACC-persist-completion",
        "SACC-persist-delete",
        "SACC-persist-full-list",
        "SACC-persist-exclude-drafts",
        "SACC-persist-cancel",
        "SACC-persist-no-restore-no-clear",
        "SACC-persist-plain-text",
        "SACC-information-content",
        "SACC-information-style",
        "SACC-information-empty"
      ],
      "constraint_refs": [
        "SCON-consistent-behavior",
        "SCON-local-storage",
        "SCON-plain-text",
        "SCON-visual-layout"
      ],
      "relation_refs": [
        "SREL-navigation-depends-filter"
      ]
    },
    "solution": [
      {
        "scenario_refs": [
          "OSCN-launch",
          "OSCN-create",
          "OSCN-reject-create",
          "OSCN-complete",
          "OSCN-reopen",
          "OSCN-begin-edit",
          "OSCN-submit-edit",
          "OSCN-cancel-edit",
          "OSCN-delete-by-edit",
          "OSCN-delete",
          "OSCN-complete-all",
          "OSCN-reopen-all",
          "OSCN-clear-completed",
          "OSCN-select-filter",
          "OSCN-complete-in-active",
          "OSCN-reopen-in-completed",
          "OSCN-create-in-completed",
          "OSCN-clear-hidden-completed",
          "OSCN-history-back",
          "OSCN-history-forward",
          "OSCN-show-empty-information"
        ],
        "concept_refs": [
          "OCON-todo-state",
          "OCON-projection",
          "OCON-edit-session",
          "OCON-filter-selection",
          "OCON-commit-boundary",
          "OCON-plain-text",
          "OCON-presentation"
        ],
        "decision_refs": [
          "ODEC-browser-boundary",
          "ODEC-canonical-route",
          "ODEC-navigation-refresh",
          "ODEC-storage-adapter",
          "ODEC-no-startup-write",
          "ODEC-text-rendering",
          "ODEC-presentation-owner"
        ]
      }
    ],
    "implementation": [
      {
        "test_code_refs": [
          {
            "id": "VTCD-c9e581a325f4",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 20,
            "lineEnd": 22
          },
          {
            "id": "VTCD-58fbcd4d8794",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 23,
            "lineEnd": 27
          },
          {
            "id": "VTCD-4481e40836b3",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 28,
            "lineEnd": 31
          },
          {
            "id": "VTCD-37130bf9cfef",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 32,
            "lineEnd": 35
          },
          {
            "id": "VTCD-286b82810649",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 36,
            "lineEnd": 41
          },
          {
            "id": "VTCD-744e67ba52cc",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 42,
            "lineEnd": 47
          },
          {
            "id": "VTCD-a3bd1dd31673",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 48,
            "lineEnd": 53
          },
          {
            "id": "VTCD-56b1444a3e7b",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 54,
            "lineEnd": 60
          },
          {
            "id": "VTCD-49816a37c56d",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 61,
            "lineEnd": 64
          },
          {
            "id": "VTCD-9e5b399de279",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 65,
            "lineEnd": 70
          },
          {
            "id": "VTCD-e213e8b06b86",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 71,
            "lineEnd": 78
          },
          {
            "id": "VTCD-622b38a5c370",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 79,
            "lineEnd": 81
          },
          {
            "id": "VTCD-bbb24c70536b",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 82,
            "lineEnd": 87
          },
          {
            "id": "VTCD-2aec14137289",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 88,
            "lineEnd": 93
          },
          {
            "id": "VTCD-bca269053867",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 94,
            "lineEnd": 99
          },
          {
            "id": "VTCD-104318b4af57",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 100,
            "lineEnd": 106
          },
          {
            "id": "VTCD-b725c65458ab",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 107,
            "lineEnd": 111
          },
          {
            "id": "VTCD-d2ddc1308d68",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 112,
            "lineEnd": 117
          },
          {
            "id": "VTCD-a162783b5622",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 118,
            "lineEnd": 121
          },
          {
            "id": "VTCD-34a3984e6883",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 122,
            "lineEnd": 126
          },
          {
            "id": "VTCD-206582f9b6c0",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 127,
            "lineEnd": 129
          },
          {
            "id": "VTCD-43ee41c30b41",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 130,
            "lineEnd": 135
          },
          {
            "id": "VTCD-a176c4759cdf",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 136,
            "lineEnd": 141
          },
          {
            "id": "VTCD-e7256081bd8c",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 142,
            "lineEnd": 146
          },
          {
            "id": "VTCD-5afe604c64ae",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 147,
            "lineEnd": 152
          },
          {
            "id": "VTCD-1e8e410f236a",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 153,
            "lineEnd": 155
          },
          {
            "id": "VTCD-3fd743bbdb6a",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 156,
            "lineEnd": 158
          },
          {
            "id": "VTCD-34523fe2f0e0",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 159,
            "lineEnd": 162
          },
          {
            "id": "VTCD-df26214ee8d3",
            "path": "design/stages/implementation/example/todo/test/ui.test.ts",
            "lineStart": 163,
            "lineEnd": 167
          },
          {
            "id": "VTCD-fddf1bbdb0ec",
            "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
            "lineStart": 3,
            "lineEnd": 3
          },
          {
            "id": "VTCD-0e7b4ef52bec",
            "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
            "lineStart": 4,
            "lineEnd": 4
          },
          {
            "id": "VTCD-0de3c2fd4371",
            "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
            "lineStart": 5,
            "lineEnd": 5
          },
          {
            "id": "VTCD-a6613dff253c",
            "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
            "lineStart": 6,
            "lineEnd": 6
          },
          {
            "id": "VTCD-4b209dff456b",
            "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
            "lineStart": 7,
            "lineEnd": 7
          },
          {
            "id": "VTCD-4701cd09e318",
            "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
            "lineStart": 8,
            "lineEnd": 8
          },
          {
            "id": "VTCD-2373a34f1d58",
            "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
            "lineStart": 9,
            "lineEnd": 9
          },
          {
            "id": "VTCD-1bf4a02d9fd7",
            "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
            "lineStart": 10,
            "lineEnd": 10
          },
          {
            "id": "VTCD-1120e0ce25f5",
            "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
            "lineStart": 11,
            "lineEnd": 14
          },
          {
            "id": "VTCD-f33d1938a3a2",
            "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
            "lineStart": 15,
            "lineEnd": 15
          },
          {
            "id": "VTCD-bfc75f07444d",
            "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
            "lineStart": 5,
            "lineEnd": 5
          },
          {
            "id": "VTCD-d82136c50476",
            "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
            "lineStart": 6,
            "lineEnd": 6
          },
          {
            "id": "VTCD-a381bd72a6ad",
            "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
            "lineStart": 7,
            "lineEnd": 7
          },
          {
            "id": "VTCD-2220cd185989",
            "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
            "lineStart": 4,
            "lineEnd": 4
          },
          {
            "id": "VTCD-39947b1b9be8",
            "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
            "lineStart": 5,
            "lineEnd": 5
          },
          {
            "id": "VTCD-ad54168612b5",
            "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
            "lineStart": 6,
            "lineEnd": 6
          },
          {
            "id": "VTCD-e543d0912ca1",
            "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
            "lineStart": 7,
            "lineEnd": 7
          },
          {
            "id": "VTCD-6320b89ad2bf",
            "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
            "lineStart": 8,
            "lineEnd": 8
          },
          {
            "id": "VTCD-5ee628e731e0",
            "path": "design/stages/validation/example/workflow/validation.test.ts",
            "lineStart": 27,
            "lineEnd": 33
          },
          {
            "id": "VTCD-522ca19f5002",
            "path": "design/stages/validation/example/workflow/validation.test.ts",
            "lineStart": 35,
            "lineEnd": 51
          },
          {
            "id": "VTCD-65652fda2ff7",
            "path": "design/stages/validation/example/workflow/validation.test.ts",
            "lineStart": 53,
            "lineEnd": 78
          },
          {
            "id": "VTCD-d47ce5032f68",
            "path": "design/stages/validation/example/workflow/validation.test.ts",
            "lineStart": 80,
            "lineEnd": 89
          }
        ]
      }
    ]
  },
  "specification_checks": [
    {
      "target": {
        "type": "domain",
        "ref": "SDOM-todos"
      },
      "evidences": [
        {
          "id": "VEVD-SDOM-todos-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SDOM-todos",
          "result": "partial",
          "note": "阅读当前源码，对照“管理一份待办清单：记录要做的事情，修改内容，标记完成，移除不再需要的事项，按完成状态查看清单，并保存已提交的数据。每条待办具有独立身份、标题和完成状态。”。依据当前最终正文及子项汇总；仍有 SFEA-persistence=partial。 此项为定性结论，不计入量化分母。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SDOM-todos-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SDOM-todos",
          "result": "partial",
          "note": "layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
        }
      ],
      "result": {
        "status": "partial",
        "reason": "依据当前最终正文及子项汇总；仍有 SFEA-persistence=partial。 此项为定性结论，不计入量化分母。"
      }
    },
    {
      "target": {
        "type": "feature",
        "ref": "SFEA-display"
      },
      "evidences": [
        {
          "id": "VEVD-SFEA-display-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SFEA-display",
          "result": "partial",
          "note": "阅读当前源码，对照“展示待办清单、空清单状态、未完成数量和必要的操作提示。”。依据当前最终正文及子项汇总；子项必要条件均有证据。 此项为定性结论，不计入量化分母。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SFEA-display-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                20,
                32,
                36,
                42,
                54,
                61,
                71,
                88,
                107,
                112,
                147,
                153,
                156,
                163
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/01.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/04.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/06.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/08.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/16.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/24.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/25.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/27.execution.json"
            }
          ],
          "target_ref": "SFEA-display",
          "result": "partial",
          "note": "实际执行：01 — browser shell has todos title and one list region [passed; batch 1]；04 — empty main disappears, first add reveals it, stable order [passed; batch 4]；05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]；06 — count wording, bold number, zero on nonempty completed list [passed; batch 6]；08 — Enter then residual blur submits only once, trims and preserves identity/status [passed; batch 8]；08 — blur commits nonempty title [passed; batch 8]；10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]；16 — Completed add stays hidden but increments full count; empty view keeps footer [passed; batch 16]；17 — global controls operate on invisible items [passed; batch 17]；23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]；24 — page retains one card and heading through empty/full transitions [passed; batch 24]；25 — long multiline and spaced titles remain readable content [passed; batch 25]；27 — help/author/attribution remain outside hidden empty-list footer [passed; batch 27]；V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SFEA-display-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SFEA-display",
          "result": "partial",
          "note": "layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 此项为定性结论，不计入量化分母。"
      }
    },
    {
      "target": {
        "type": "feature",
        "ref": "SFEA-create"
      },
      "evidences": [
        {
          "id": "VEVD-SFEA-create-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SFEA-create",
          "result": "partial",
          "note": "阅读当前源码，对照“把用户输入的有效标题加入清单，形成新的未完成待办。”。依据当前最终正文及子项汇总；子项必要条件均有证据。 此项为定性结论，不计入量化分母。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SFEA-create-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                23,
                28,
                36,
                79,
                107,
                147,
                156
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/02.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/03.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/11.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/16.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/25.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SFEA-create",
          "result": "partial",
          "note": "实际执行：02 — focus, unsubmitted draft, Enter, clear and repeated add [passed; batch 2]；03 — trim only edges, reject empty, keep independent duplicate titles [passed; batch 3]；05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]；11 — delete button targets independent identity [passed; batch 11]；16 — Completed add stays hidden but increments full count; empty view keeps footer [passed; batch 16]；23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]；25 — long multiline and spaced titles remain readable content [passed; batch 25]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 此项为定性结论，不计入量化分母。"
      }
    },
    {
      "target": {
        "type": "feature",
        "ref": "SFEA-completion"
      },
      "evidences": [
        {
          "id": "VEVD-SFEA-completion-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SFEA-completion",
          "result": "partial",
          "note": "阅读当前源码，对照“切换单条或整份清单的完成状态，并一致呈现结果。”。依据当前最终正文及子项汇总；子项必要条件均有证据。 此项为定性结论，不计入量化分母。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SFEA-completion-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                36,
                82,
                88,
                112,
                159
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/12.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/26.execution.json"
            }
          ],
          "target_ref": "SFEA-completion",
          "result": "partial",
          "note": "实际执行：05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]；12 — UI toggle-all derives from full list and resets on reopen/add [passed; batch 12]；13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]；17 — global controls operate on invisible items [passed; batch 17]；26 — editing class and controls switch coherently back to completed display [passed; batch 26]；V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 此项为定性结论，不计入量化分母。"
      }
    },
    {
      "target": {
        "type": "feature",
        "ref": "SFEA-edit"
      },
      "evidences": [
        {
          "id": "VEVD-SFEA-edit-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SFEA-edit",
          "result": "partial",
          "note": "阅读当前源码，对照“就地修改待办标题，支持提交、取消，以及通过清空标题删除待办。”。依据当前最终正文及子项汇总；子项必要条件均有证据。 此项为定性结论，不计入量化分母。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SFEA-edit-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                48,
                54,
                61,
                65,
                71,
                100,
                112,
                147,
                159
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/07.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/08.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/09.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/15.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/26.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SFEA-edit",
          "result": "partial",
          "note": "实际执行：07 — completed title starts focused edit without mutating committed content [passed; batch 7]；08 — Enter then residual blur submits only once, trims and preserves identity/status [passed; batch 8]；08 — blur commits nonempty title [passed; batch 8]；09 — Escape with text, empty or whitespace restores original and suppresses blur [passed; batch 9]；10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；15 — mutations recompute current view without changing selected filter [passed; batch 15]；17 — global controls operate on invisible items [passed; batch 17]；23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]；26 — editing class and controls switch coherently back to completed display [passed; batch 26]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 此项为定性结论，不计入量化分母。"
      }
    },
    {
      "target": {
        "type": "feature",
        "ref": "SFEA-remove"
      },
      "evidences": [
        {
          "id": "VEVD-SFEA-remove-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SFEA-remove",
          "result": "partial",
          "note": "阅读当前源码，对照“删除指定待办，或一次清除全部已完成待办。”。依据当前最终正文及子项汇总；子项必要条件均有证据。 此项为定性结论，不计入量化分母。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SFEA-remove-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                71,
                79,
                88,
                112,
                159
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35,
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/11.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/26.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SFEA-remove",
          "result": "partial",
          "note": "实际执行：10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；11 — delete button targets independent identity [passed; batch 11]；13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]；17 — global controls operate on invisible items [passed; batch 17]；26 — editing class and controls switch coherently back to completed display [passed; batch 26]；V06 — every command keeps global counts and item order consistent [passed; batch 13]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 此项为定性结论，不计入量化分母。"
      }
    },
    {
      "target": {
        "type": "feature",
        "ref": "SFEA-filter"
      },
      "evidences": [
        {
          "id": "VEVD-SFEA-filter-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SFEA-filter",
          "result": "partial",
          "note": "阅读当前源码，对照“按待办完成状态查看同一份清单，并通过地址、浏览器前进后退和刷新表达当前筛选。”。依据当前最终正文及子项汇总；子项必要条件均有证据。 此项为定性结论，不计入量化分母。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SFEA-filter-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                94,
                100,
                107,
                112,
                118,
                122
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                5,
                7
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/14.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/15.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/16.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SFEA-filter",
          "result": "partial",
          "note": "实际执行：14 — switching views preserves full list and original relative order [passed; batch 14]；15 — mutations recompute current view without changing selected filter [passed; batch 15]；16 — Completed add stays hidden but increments full count; empty view keeps footer [passed; batch 16]；17 — global controls operate on invisible items [passed; batch 17]；18 — direct URL selects category and click changes address without losing data [passed; batch 18]；19 — external address changes update selection without creating extra navigation [passed; batch 19]；canonical address mapping and unspecified default [passed; batch 18]；external history/address events publish selection without writing it back [passed; batch 19]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 此项为定性结论，不计入量化分母。"
      }
    },
    {
      "target": {
        "type": "feature",
        "ref": "SFEA-persistence"
      },
      "evidences": [
        {
          "id": "VEVD-SFEA-persistence-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SFEA-persistence",
          "result": "partial",
          "note": "阅读当前源码，对照“自动持久化待办的已提交内容、完成状态和删除结果。”。依据当前最终正文及子项汇总；仍有 SREQ-persist=partial。 此项为定性结论，不计入量化分母。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SFEA-persistence-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                127,
                130,
                136,
                142,
                147
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
              "lines": [
                11
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
              "lines": [
                4,
                6
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53,
                80
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/20.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/22.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            }
          ],
          "target_ref": "SFEA-persistence",
          "result": "partial",
          "note": "实际执行：20 — effective UI submission automatically saves in namespaced storage [passed; batch 20]；21 — editing, status and empty-title deletion update the same saved identity [passed; batch 21]；22 — editing draft survives unrelated renders and never leaks into other saves [passed; batch 22]；22 — startup and invalid drafts never write; filtered saves retain hidden identities [passed; batch 22]；23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]；all mutation paths save newest complete snapshot in order [passed; batch 21]；save isolates implementation keys and construction never writes [passed; batch 20]；snapshot contains only identity/title/completed, preserving array order [passed; batch 21]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]；V22 — prior data survives startup and repeated guarded submissions [passed; batch 22]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "partial",
        "reason": "依据当前最终正文及子项汇总；仍有 SREQ-persist=partial。 此项为定性结论，不计入量化分母。"
      }
    },
    {
      "target": {
        "type": "requirement",
        "ref": "SREQ-display"
      },
      "evidences": [
        {
          "id": "VEVD-SREQ-display-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SREQ-display",
          "result": "partial",
          "note": "阅读当前源码，对照“浏览器页面提供一份待办清单，标题为 todos，新增入口始终可用。按加入顺序展示待办，修改标题或完成状态不改变位置。完整清单为空时隐藏清单主体（含全选控件）与操作页脚；加入第一条后显示，删除最后一条后重新隐藏。 当前筛选无匹配项但完整清单非空时，仅待办列表为空，主体、全选和操作页脚仍按非空清单显示，可继续切换筛选。”。依据当前最终正文及子项汇总；子项必要条件均有证据。  代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SREQ-display-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                20,
                32,
                36,
                54,
                61,
                71,
                88,
                107,
                112,
                147,
                153,
                156,
                163
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/01.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/04.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/08.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/16.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/24.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/25.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/27.execution.json"
            }
          ],
          "target_ref": "SREQ-display",
          "result": "partial",
          "note": "实际执行：01 — browser shell has todos title and one list region [passed; batch 1]；04 — empty main disappears, first add reveals it, stable order [passed; batch 4]；05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]；08 — Enter then residual blur submits only once, trims and preserves identity/status [passed; batch 8]；08 — blur commits nonempty title [passed; batch 8]；10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]；16 — Completed add stays hidden but increments full count; empty view keeps footer [passed; batch 16]；17 — global controls operate on invisible items [passed; batch 17]；23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]；24 — page retains one card and heading through empty/full transitions [passed; batch 24]；25 — long multiline and spaced titles remain readable content [passed; batch 25]；27 — help/author/attribution remain outside hidden empty-list footer [passed; batch 27]；V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SREQ-display-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SREQ-display",
          "result": "partial",
          "note": "layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 "
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-display-single-list"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-display-single-list-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-display-single-list",
          "result": "fullfill",
          "note": "阅读当前源码，对照“打开应用时呈现单清单待办页面，标题显示 todos。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-display-single-list-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                20
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/01.execution.json"
            }
          ],
          "target_ref": "SACC-display-single-list",
          "result": "fullfill",
          "note": "实际执行：01 — browser shell has todos title and one list region [passed; batch 1]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-display-order"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-display-order-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-display-order",
          "result": "fullfill",
          "note": "阅读当前源码，对照“按顺序新增 A、B、C，清单依次显示 A、B、C；修改 B 的标题或完成状态后，B 仍位于第二条。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-display-order-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                32,
                36,
                54,
                61
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/04.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/08.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            }
          ],
          "target_ref": "SACC-display-order",
          "result": "fullfill",
          "note": "实际执行：04 — empty main disappears, first add reveals it, stable order [passed; batch 4]；05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]；08 — Enter then residual blur submits only once, trims and preserves identity/status [passed; batch 8]；08 — blur commits nonempty title [passed; batch 8]；V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-display-empty"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-display-empty-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-display-empty",
          "result": "fullfill",
          "note": "阅读当前源码，对照“完整清单为空时，标题和新增框可见，清单主体、全选和操作页脚隐藏；新增第一条后显示，删除最后一条后重新隐藏。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-display-empty-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                32,
                71,
                88
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/04.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            }
          ],
          "target_ref": "SACC-display-empty",
          "result": "fullfill",
          "note": "实际执行：04 — empty main disappears, first add reveals it, stable order [passed; batch 4]；10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-display-empty-filter"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-display-empty-filter-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-display-empty-filter",
          "result": "fullfill",
          "note": "阅读当前源码，对照“完整清单有待办但当前筛选没有匹配项时，列表为空，新增入口、全选、未完成数字及筛选按钮仍可用，可切回有内容的分类。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-display-empty-filter-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                107,
                112
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/16.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            }
          ],
          "target_ref": "SACC-display-empty-filter",
          "result": "fullfill",
          "note": "实际执行：16 — Completed add stays hidden but increments full count; empty view keeps footer [passed; batch 16]；17 — global controls operate on invisible items [passed; batch 17]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-display-plain-text"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-display-plain-text-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-display-plain-text",
          "result": "fullfill",
          "note": "阅读当前源码，对照“标题“<b>买牛奶</b>”在列表中原样显示，不产生加粗效果；标题中的可执行内容不得执行。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-display-plain-text-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                147
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            }
          ],
          "target_ref": "SACC-display-plain-text",
          "result": "fullfill",
          "note": "实际执行：23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-display-layout"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-display-layout-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-display-layout",
          "result": "partial",
          "note": "阅读当前源码，对照“桌面显示浅灰背景上的居中单列白色待办卡片，卡片不铺满屏幕；窄屏下内容随宽度收缩且不出现横向滚动。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-display-layout-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                153
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/24.execution.json"
            }
          ],
          "target_ref": "SACC-display-layout",
          "result": "partial",
          "note": "实际执行：24 — page retains one card and heading through empty/full transitions [passed; batch 24]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-display-layout-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-display-layout",
          "result": "fullfill",
          "note": "桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-display-heading-style"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-display-heading-style-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-display-heading-style",
          "result": "partial",
          "note": "阅读当前源码，对照“todos 位于卡片上方居中，字形细、颜色淡红，字号明显大于输入框和清单文字。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-display-heading-style-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                153
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/24.execution.json"
            }
          ],
          "target_ref": "SACC-display-heading-style",
          "result": "partial",
          "note": "实际执行：24 — page retains one card and heading through empty/full transitions [passed; batch 24]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-display-heading-style-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-display-heading-style",
          "result": "fullfill",
          "note": "桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-display-row-style"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-display-row-style-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-display-row-style",
          "result": "partial",
          "note": "阅读当前源码，对照“每条待办单独占一行，保持舒适一致的间距并用细灰线分隔；长标题可换行，不遮挡左右两侧操作控件。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-display-row-style-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                156
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/25.execution.json"
            }
          ],
          "target_ref": "SACC-display-row-style",
          "result": "partial",
          "note": "实际执行：25 — long multiline and spaced titles remain readable content [passed; batch 25]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-display-row-style-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-display-row-style",
          "result": "fullfill",
          "note": "长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-display-footer-style"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-display-footer-style-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-display-footer-style",
          "result": "partial",
          "note": "阅读当前源码，对照“操作页脚紧凑排列：左侧为剩余数量，中间为 All、Active、Completed，右侧按需显示 Clear completed；切换筛选或按钮显隐时整排不明显跳动。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-display-footer-style-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                163
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/27.execution.json"
            }
          ],
          "target_ref": "SACC-display-footer-style",
          "result": "partial",
          "note": "实际执行：27 — help/author/attribution remain outside hidden empty-list footer [passed; batch 27]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-display-footer-style-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-display-footer-style",
          "result": "fullfill",
          "note": "桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。"
      }
    },
    {
      "target": {
        "type": "requirement",
        "ref": "SREQ-create"
      },
      "evidences": [
        {
          "id": "VEVD-SREQ-create-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SREQ-create",
          "result": "partial",
          "note": "阅读当前源码，对照“页面顶部提供提示为 What needs to be done? 的新增输入框，加载后获得焦点；按 Enter 将去除首尾空白后的非空标题作为一条具有独立身份的未完成待办追加到末尾，成功后清空输入。保留中间空格，允许同名待办；空输入、纯空白或未按 Enter 的输入不创建待办。”。依据当前最终正文及子项汇总；子项必要条件均有证据。  代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SREQ-create-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                23,
                28,
                36,
                79,
                107,
                147,
                156
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/02.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/03.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/11.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/16.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/25.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SREQ-create",
          "result": "partial",
          "note": "实际执行：02 — focus, unsubmitted draft, Enter, clear and repeated add [passed; batch 2]；03 — trim only edges, reject empty, keep independent duplicate titles [passed; batch 3]；05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]；11 — delete button targets independent identity [passed; batch 11]；16 — Completed add stays hidden but increments full count; empty view keeps footer [passed; batch 16]；23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]；25 — long multiline and spaced titles remain readable content [passed; batch 25]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SREQ-create-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SREQ-create",
          "result": "partial",
          "note": "layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 "
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-create-entry"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-create-entry-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-create-entry",
          "result": "fullfill",
          "note": "阅读当前源码，对照“页面顶部新增输入框显示 What needs to be done?，加载页面后可直接输入。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-create-entry-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                23
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/02.execution.json"
            }
          ],
          "target_ref": "SACC-create-entry",
          "result": "fullfill",
          "note": "实际执行：02 — focus, unsubmitted draft, Enter, clear and repeated add [passed; batch 2]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-create-submit"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-create-submit-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-create-submit",
          "result": "fullfill",
          "note": "阅读当前源码，对照“输入“买牛奶”按 Enter，末尾新增标题为“买牛奶”的未完成待办，新增框清空并可继续输入下一条。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-create-submit-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                23,
                28
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/02.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/03.execution.json"
            }
          ],
          "target_ref": "SACC-create-submit",
          "result": "fullfill",
          "note": "实际执行：02 — focus, unsubmitted draft, Enter, clear and repeated add [passed; batch 2]；03 — trim only edges, reject empty, keep independent duplicate titles [passed; batch 3]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-create-draft"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-create-draft-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-create-draft",
          "result": "fullfill",
          "note": "阅读当前源码，对照“只在新增框输入文字而不按 Enter，清单不增加待办。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-create-draft-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                23
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/02.execution.json"
            }
          ],
          "target_ref": "SACC-create-draft",
          "result": "fullfill",
          "note": "实际执行：02 — focus, unsubmitted draft, Enter, clear and repeated add [passed; batch 2]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-create-trim"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-create-trim-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-create-trim",
          "result": "fullfill",
          "note": "阅读当前源码，对照“输入“  买  牛奶  ”按 Enter，仅新增标题为“买  牛奶”的待办，首尾空白去除且中间空格保留。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-create-trim-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                28
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/03.execution.json"
            }
          ],
          "target_ref": "SACC-create-trim",
          "result": "fullfill",
          "note": "实际执行：03 — trim only edges, reject empty, keep independent duplicate titles [passed; batch 3]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-create-blank"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-create-blank-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-create-blank",
          "result": "fullfill",
          "note": "阅读当前源码，对照“空输入或纯空白按 Enter 均不创建待办，清单数量保持不变。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-create-blank-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                28
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/03.execution.json"
            }
          ],
          "target_ref": "SACC-create-blank",
          "result": "fullfill",
          "note": "实际执行：03 — trim only edges, reject empty, keep independent duplicate titles [passed; batch 3]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-create-duplicate"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-create-duplicate-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-create-duplicate",
          "result": "fullfill",
          "note": "阅读当前源码，对照“连续两次提交相同标题，得到两条独立待办；之后修改、完成或删除其中一条时，另一条保持不变。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-create-duplicate-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                28,
                36,
                79
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/03.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/11.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-create-duplicate",
          "result": "fullfill",
          "note": "实际执行：03 — trim only edges, reject empty, keep independent duplicate titles [passed; batch 3]；05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]；11 — delete button targets independent identity [passed; batch 11]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-create-one-per-submit"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-create-one-per-submit-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-create-one-per-submit",
          "result": "fullfill",
          "note": "阅读当前源码，对照“连续提交有效标题时，每次 Enter 只增加一条，并按提交先后追加到清单末尾。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-create-one-per-submit-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                23
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/02.execution.json"
            }
          ],
          "target_ref": "SACC-create-one-per-submit",
          "result": "fullfill",
          "note": "实际执行：02 — focus, unsubmitted draft, Enter, clear and repeated add [passed; batch 2]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-create-in-completed"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-create-in-completed-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-create-in-completed",
          "result": "fullfill",
          "note": "阅读当前源码，对照“在 Completed 提交有效标题，新待办以未完成状态加入完整清单末尾，当前不可见但未完成数量加一，筛选保持 Completed；切换到 Active 或 All 后可见。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-create-in-completed-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                107
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/16.execution.json"
            }
          ],
          "target_ref": "SACC-create-in-completed",
          "result": "fullfill",
          "note": "实际执行：16 — Completed add stays hidden but increments full count; empty view keeps footer [passed; batch 16]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-create-plain-text"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-create-plain-text-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-create-plain-text",
          "result": "fullfill",
          "note": "阅读当前源码，对照“新增标题“<b>买牛奶</b>”后保留该文字本身，只执行规定的首尾空白处理，不解释为页面标记或可执行内容。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-create-plain-text-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                147
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            }
          ],
          "target_ref": "SACC-create-plain-text",
          "result": "fullfill",
          "note": "实际执行：23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-create-input-style"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-create-input-style-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-create-input-style",
          "result": "partial",
          "note": "阅读当前源码，对照“新增框位于白色卡片最上方，与清单等宽，输入文字较大，What needs to be done? 使用浅灰斜体，获得焦点时有可见输入状态。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-create-input-style-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                156
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/25.execution.json"
            }
          ],
          "target_ref": "SACC-create-input-style",
          "result": "partial",
          "note": "实际执行：25 — long multiline and spaced titles remain readable content [passed; batch 25]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-create-input-style-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-create-input-style",
          "result": "fullfill",
          "note": "新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。"
      }
    },
    {
      "target": {
        "type": "requirement",
        "ref": "SREQ-toggle"
      },
      "evidences": [
        {
          "id": "VEVD-SREQ-toggle-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SREQ-toggle",
          "result": "partial",
          "note": "阅读当前源码，对照“每条非编辑状态的待办提供完成控件，可在未完成与已完成之间切换；已完成标题显示删除线。操作立即更新界面，不改变该条的身份、标题、位置或其他待办。”。依据当前最终正文及子项汇总；子项必要条件均有证据。  代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SREQ-toggle-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                36,
                159
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/26.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            }
          ],
          "target_ref": "SREQ-toggle",
          "result": "partial",
          "note": "实际执行：05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]；26 — editing class and controls switch coherently back to completed display [passed; batch 26]；V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SREQ-toggle-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SREQ-toggle",
          "result": "partial",
          "note": "layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 "
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-toggle-complete"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-toggle-complete-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-toggle-complete",
          "result": "partial",
          "note": "阅读当前源码，对照“勾选未完成待办后立即显示选中状态和标题删除线，无需刷新。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-toggle-complete-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                36
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            }
          ],
          "target_ref": "SACC-toggle-complete",
          "result": "partial",
          "note": "实际执行：05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-toggle-complete-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-toggle-complete",
          "result": "fullfill",
          "note": "勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-toggle-reopen"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-toggle-reopen-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-toggle-reopen",
          "result": "partial",
          "note": "阅读当前源码，对照“取消勾选已完成待办后立即恢复未完成状态并去除删除线。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-toggle-reopen-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                36
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            }
          ],
          "target_ref": "SACC-toggle-reopen",
          "result": "partial",
          "note": "实际执行：05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-toggle-reopen-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-toggle-reopen",
          "result": "fullfill",
          "note": "勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-toggle-isolation"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-toggle-isolation-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-toggle-isolation",
          "result": "fullfill",
          "note": "阅读当前源码，对照“切换一条待办完成状态时，其身份、标题和位置不变，其他条目保持不变。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-toggle-isolation-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                36
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            }
          ],
          "target_ref": "SACC-toggle-isolation",
          "result": "fullfill",
          "note": "实际执行：05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]；V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-toggle-state-style"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-toggle-state-style-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-toggle-state-style",
          "result": "partial",
          "note": "阅读当前源码，对照“未完成时左侧为圆形完成控件、标题为清晰深色；完成后控件显示绿色勾，标题变为浅灰色并显示删除线，取消完成后恢复未完成样式。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-toggle-state-style-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                159
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/26.execution.json"
            }
          ],
          "target_ref": "SACC-toggle-state-style",
          "result": "partial",
          "note": "实际执行：26 — editing class and controls switch coherently back to completed display [passed; batch 26]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-toggle-state-style-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-toggle-state-style",
          "result": "fullfill",
          "note": "勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。"
      }
    },
    {
      "target": {
        "type": "requirement",
        "ref": "SREQ-count"
      },
      "evidences": [
        {
          "id": "VEVD-SREQ-count-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SREQ-count",
          "result": "partial",
          "note": "阅读当前源码，对照“操作页脚始终显示完整清单中未完成待办数量，与当前筛选可见数量无关；数字加粗，1 时显示 1 item left，其余显示 N items left。新增、完成、重新打开或删除时更新，单纯改名不变；非空清单全部完成时显示零，完整清单为空时随页脚隐藏。”。依据当前最终正文及子项汇总；子项必要条件均有证据。  代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SREQ-count-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                42,
                71,
                88,
                112
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/06.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            }
          ],
          "target_ref": "SREQ-count",
          "result": "partial",
          "note": "实际执行：06 — count wording, bold number, zero on nonempty completed list [passed; batch 6]；10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]；17 — global controls operate on invisible items [passed; batch 17]；V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 "
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-count-wording"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-count-wording-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-count-wording",
          "result": "fullfill",
          "note": "阅读当前源码，对照“清单非空时，未完成数量为 0、1、2，分别显示 0 items left、1 item left、2 items left，数字加粗。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-count-wording-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                42
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/06.execution.json"
            }
          ],
          "target_ref": "SACC-count-wording",
          "result": "fullfill",
          "note": "实际执行：06 — count wording, bold number, zero on nonempty completed list [passed; batch 6]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-count-updates"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-count-updates-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-count-updates",
          "result": "fullfill",
          "note": "阅读当前源码，对照“新增未完成待办或重新打开一条时数量加一；完成或删除一条未完成待办时减一；删除已完成待办、单纯改名不改变数量。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-count-updates-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            }
          ],
          "target_ref": "SACC-count-updates",
          "result": "fullfill",
          "note": "实际执行：V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-count-visibility"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-count-visibility-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-count-visibility",
          "result": "fullfill",
          "note": "阅读当前源码，对照“全部待办已完成但未删除时仍显示 0 items left；删除最后一条后计数随页脚隐藏。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-count-visibility-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                42,
                71,
                88
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/06.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            }
          ],
          "target_ref": "SACC-count-visibility",
          "result": "fullfill",
          "note": "实际执行：06 — count wording, bold number, zero on nonempty completed list [passed; batch 6]；10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-count-global"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-count-global-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-count-global",
          "result": "fullfill",
          "note": "阅读当前源码，对照“完整清单有两条未完成和一条已完成时，All、Active、Completed 均显示 2 items left，切换筛选不改变计数。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-count-global-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                112
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            }
          ],
          "target_ref": "SACC-count-global",
          "result": "fullfill",
          "note": "实际执行：17 — global controls operate on invisible items [passed; batch 17]；V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "requirement",
        "ref": "SREQ-edit"
      },
      "evidences": [
        {
          "id": "VEVD-SREQ-edit-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SREQ-edit",
          "result": "partial",
          "note": "阅读当前源码，对照“双击任意完成状态的待办标题可就地编辑，预填已提交标题并获得焦点，隐藏该条原标题及完成、删除控件。Enter 或失焦提交时去除首尾空白、保留中间空格：非空则保存到同一待办，保持完成状态和位置；为空则删除该条并更新相关数量、控件与空状态。Escape 取消并恢复原已提交标题，即使草稿为空或纯空白也保留原待办。Enter 提交或 Escape 取消后的失焦不得重复处理、保存已取消草稿或误删。”。依据当前最终正文及子项汇总；子项必要条件均有证据。  代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SREQ-edit-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                48,
                54,
                61,
                65,
                71,
                100,
                112,
                147,
                159
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/07.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/08.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/09.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/15.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/26.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SREQ-edit",
          "result": "partial",
          "note": "实际执行：07 — completed title starts focused edit without mutating committed content [passed; batch 7]；08 — Enter then residual blur submits only once, trims and preserves identity/status [passed; batch 8]；08 — blur commits nonempty title [passed; batch 8]；09 — Escape with text, empty or whitespace restores original and suppresses blur [passed; batch 9]；10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；15 — mutations recompute current view without changing selected filter [passed; batch 15]；17 — global controls operate on invisible items [passed; batch 17]；23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]；26 — editing class and controls switch coherently back to completed display [passed; batch 26]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SREQ-edit-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SREQ-edit",
          "result": "partial",
          "note": "layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 "
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-edit-enter"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-edit-enter-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-edit-enter",
          "result": "fullfill",
          "note": "阅读当前源码，对照“分别双击未完成和已完成待办的标题，均在原位置出现预填当前已提交标题且已获得焦点的编辑框。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-edit-enter-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                48
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/07.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-edit-enter",
          "result": "fullfill",
          "note": "实际执行：07 — completed title starts focused edit without mutating committed content [passed; batch 7]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-edit-hide-controls"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-edit-hide-controls-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-edit-hide-controls",
          "result": "partial",
          "note": "阅读当前源码，对照“编辑期间，该条原有标题、完成控件和删除控件隐藏，其他待办保持不变。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-edit-hide-controls-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                48,
                159
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/07.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/26.execution.json"
            }
          ],
          "target_ref": "SACC-edit-hide-controls",
          "result": "partial",
          "note": "实际执行：07 — completed title starts focused edit without mutating committed content [passed; batch 7]；26 — editing class and controls switch coherently back to completed display [passed; batch 26]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-edit-hide-controls-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-edit-hide-controls",
          "result": "fullfill",
          "note": "双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-edit-enter-submit"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-edit-enter-submit-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-edit-enter-submit",
          "result": "fullfill",
          "note": "阅读当前源码，对照“把标题改为“  买  面包  ”按 Enter，保存为“买  面包”并退出编辑，仍为原待办，身份、完成状态和位置不变。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-edit-enter-submit-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                54,
                61
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/08.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-edit-enter-submit",
          "result": "fullfill",
          "note": "实际执行：08 — Enter then residual blur submits only once, trims and preserves identity/status [passed; batch 8]；08 — blur commits nonempty title [passed; batch 8]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-edit-blur-submit"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-edit-blur-submit-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-edit-blur-submit",
          "result": "fullfill",
          "note": "阅读当前源码，对照“输入非空新标题后让编辑框失焦，按同样的首尾空白规则保存并退出编辑，身份、完成状态和位置不变。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-edit-blur-submit-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                54,
                61
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/08.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-edit-blur-submit",
          "result": "fullfill",
          "note": "实际执行：08 — Enter then residual blur submits only once, trims and preserves identity/status [passed; batch 8]；08 — blur commits nonempty title [passed; batch 8]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-edit-enter-then-blur"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-edit-enter-then-blur-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-edit-enter-then-blur",
          "result": "fullfill",
          "note": "阅读当前源码，对照“Enter 提交非空新标题后再触发失焦，待办只提交一次，保留新标题，不重复处理或误删。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-edit-enter-then-blur-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                54,
                61
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/08.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-edit-enter-then-blur",
          "result": "fullfill",
          "note": "实际执行：08 — Enter then residual blur submits only once, trims and preserves identity/status [passed; batch 8]；08 — blur commits nonempty title [passed; batch 8]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-edit-escape"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-edit-escape-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-edit-escape",
          "result": "fullfill",
          "note": "阅读当前源码，对照“输入新标题后按 Escape，退出编辑并恢复编辑前标题；随后失焦不提交已取消的草稿。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-edit-escape-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                65
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/09.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-edit-escape",
          "result": "fullfill",
          "note": "实际执行：09 — Escape with text, empty or whitespace restores original and suppresses blur [passed; batch 9]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-edit-escape-blank"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-edit-escape-blank-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-edit-escape-blank",
          "result": "fullfill",
          "note": "阅读当前源码，对照“将编辑草稿清空或改成纯空白后按 Escape，原待办和原标题保留；随后失焦也不保存或删除。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-edit-escape-blank-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                65
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/09.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-edit-escape-blank",
          "result": "fullfill",
          "note": "实际执行：09 — Escape with text, empty or whitespace restores original and suppresses blur [passed; batch 9]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-edit-delete-blank"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-edit-delete-blank-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-edit-delete-blank",
          "result": "fullfill",
          "note": "阅读当前源码，对照“分别将标题清空或改为纯空白，再分别通过 Enter 或失焦提交，均删除被编辑的那条，其他待办的内容、状态和顺序不变。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-edit-delete-blank-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                71
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-edit-delete-blank",
          "result": "fullfill",
          "note": "实际执行：10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-edit-delete-updates"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-edit-delete-updates-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-edit-delete-updates",
          "result": "fullfill",
          "note": "阅读当前源码，对照“空标题提交删除后，未完成计数、当前筛选结果、全选状态、Clear completed 和空清单展示按剩余完整清单更新，筛选选择保持不变；Enter 删除后继续失焦不重复删除。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-edit-delete-updates-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                71,
                112
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-edit-delete-updates",
          "result": "fullfill",
          "note": "实际执行：10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；17 — global controls operate on invisible items [passed; batch 17]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-edit-same-item-in-filter"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-edit-same-item-in-filter-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-edit-same-item-in-filter",
          "result": "fullfill",
          "note": "阅读当前源码，对照“在 Active 或 Completed 编辑可见待办并提交非空标题，修改作用于原待办；切换到 All 后看到相同的新标题、完成状态和位置。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-edit-same-item-in-filter-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                100
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/15.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-edit-same-item-in-filter",
          "result": "fullfill",
          "note": "实际执行：15 — mutations recompute current view without changing selected filter [passed; batch 15]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-edit-plain-text"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-edit-plain-text-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-edit-plain-text",
          "result": "fullfill",
          "note": "阅读当前源码，对照“通过 Enter 或失焦把标题改为包含页面标记的文字时，只执行规定的首尾空白处理，保留文字本身，不解释或执行其中内容。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-edit-plain-text-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                147
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-edit-plain-text",
          "result": "fullfill",
          "note": "实际执行：23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-edit-input-style"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-edit-input-style-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-edit-input-style",
          "result": "partial",
          "note": "阅读当前源码，对照“双击后编辑框在原标题位置替换展示内容，尺寸与该行协调，边框清晰且焦点状态明显。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-edit-input-style-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                159
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/26.execution.json"
            }
          ],
          "target_ref": "SACC-edit-input-style",
          "result": "partial",
          "note": "实际执行：26 — editing class and controls switch coherently back to completed display [passed; batch 26]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-edit-input-style-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-edit-input-style",
          "result": "fullfill",
          "note": "双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。"
      }
    },
    {
      "target": {
        "type": "requirement",
        "ref": "SREQ-delete"
      },
      "evidences": [
        {
          "id": "VEVD-SREQ-delete-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SREQ-delete",
          "result": "partial",
          "note": "阅读当前源码，对照“非编辑状态的待办在指针悬停时显示删除按钮，平时隐藏；点击即删除该条，无论其是否完成。其余待办的身份、内容、状态和相对顺序不变，未完成计数、全选与清除按钮按剩余清单更新，删光后隐藏主体和操作页脚。”。依据当前最终正文及子项汇总；子项必要条件均有证据。  代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SREQ-delete-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                71,
                79,
                159
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35,
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/11.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/26.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SREQ-delete",
          "result": "partial",
          "note": "实际执行：10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；11 — delete button targets independent identity [passed; batch 11]；26 — editing class and controls switch coherently back to completed display [passed; batch 26]；V06 — every command keeps global counts and item order consistent [passed; batch 13]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SREQ-delete-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SREQ-delete",
          "result": "partial",
          "note": "layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 "
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-delete-hover"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-delete-hover-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-delete-hover",
          "result": "partial",
          "note": "阅读当前源码，对照“非编辑条目未悬停时删除按钮隐藏，悬停时显示；点击后仅该条从清单移除。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-delete-hover-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                79
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/11.execution.json"
            }
          ],
          "target_ref": "SACC-delete-hover",
          "result": "partial",
          "note": "实际执行：11 — delete button targets independent identity [passed; batch 11]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-delete-hover-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-delete-hover",
          "result": "fullfill",
          "note": "指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-delete-either-state"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-delete-either-state-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-delete-either-state",
          "result": "fullfill",
          "note": "阅读当前源码，对照“未完成和已完成待办均可直接删除，其他待办身份、标题、状态和相对顺序不变。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-delete-either-state-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-delete-either-state",
          "result": "fullfill",
          "note": "实际执行：V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-delete-updates"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-delete-updates-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-delete-updates",
          "result": "fullfill",
          "note": "阅读当前源码，对照“删除后未完成计数、全选与清除按钮和剩余清单一致；删除最后一条后隐藏清单主体和操作页脚。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-delete-updates-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                71,
                79
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35,
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/11.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-delete-updates",
          "result": "fullfill",
          "note": "实际执行：10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；11 — delete button targets independent identity [passed; batch 11]；V06 — every command keeps global counts and item order consistent [passed; batch 13]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-delete-button-style"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-delete-button-style-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-delete-button-style",
          "result": "partial",
          "note": "阅读当前源码，对照“删除按钮位于待办行最右侧，非悬停时隐藏，悬停时显示淡红叉号；显示或隐藏不挤动标题或其他控件。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-delete-button-style-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                159
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/26.execution.json"
            }
          ],
          "target_ref": "SACC-delete-button-style",
          "result": "partial",
          "note": "实际执行：26 — editing class and controls switch coherently back to completed display [passed; batch 26]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-delete-button-style-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-delete-button-style",
          "result": "fullfill",
          "note": "指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。"
      }
    },
    {
      "target": {
        "type": "requirement",
        "ref": "SREQ-toggle-all"
      },
      "evidences": [
        {
          "id": "VEVD-SREQ-toggle-all-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SREQ-toggle-all",
          "result": "partial",
          "note": "阅读当前源码，对照“全选控件将整份清单统一设为已完成或未完成，不改变待办身份、标题或顺序。清单非空且全部完成时才显示选中；逐条完成最后一条时自动选中，重新打开或新增未完成待办时取消选中。 操作范围包括当前筛选隐藏的待办，更新后重新匹配当前视图且不切换筛选。”。依据当前最终正文及子项汇总；子项必要条件均有证据。  代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SREQ-toggle-all-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                82,
                88,
                112
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/12.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            }
          ],
          "target_ref": "SREQ-toggle-all",
          "result": "partial",
          "note": "实际执行：12 — UI toggle-all derives from full list and resets on reopen/add [passed; batch 12]；13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]；17 — global controls operate on invisible items [passed; batch 17]；V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 "
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-toggle-all-complete"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-toggle-all-complete-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-toggle-all-complete",
          "result": "fullfill",
          "note": "阅读当前源码，对照“选中全选控件后，整份清单所有条目变为已完成，未完成数量为零，身份、标题和顺序不变。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-toggle-all-complete-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                82
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/12.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            }
          ],
          "target_ref": "SACC-toggle-all-complete",
          "result": "fullfill",
          "note": "实际执行：12 — UI toggle-all derives from full list and resets on reopen/add [passed; batch 12]；V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-toggle-all-reopen"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-toggle-all-reopen-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-toggle-all-reopen",
          "result": "fullfill",
          "note": "阅读当前源码，对照“取消全选后，整份清单所有条目变为未完成，未完成数量等于清单总数，身份、标题和顺序不变。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-toggle-all-reopen-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                82
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/12.execution.json"
            }
          ],
          "target_ref": "SACC-toggle-all-reopen",
          "result": "fullfill",
          "note": "实际执行：12 — UI toggle-all derives from full list and resets on reopen/add [passed; batch 12]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-toggle-all-derived"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-toggle-all-derived-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-toggle-all-derived",
          "result": "fullfill",
          "note": "阅读当前源码，对照“存在未完成条目时全选未选中；逐条完成最后一条后自动选中，重新打开任意一条或新增一条后自动取消选中。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-toggle-all-derived-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                82
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/12.execution.json"
            }
          ],
          "target_ref": "SACC-toggle-all-derived",
          "result": "fullfill",
          "note": "实际执行：12 — UI toggle-all derives from full list and resets on reopen/add [passed; batch 12]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-toggle-all-empty-reset"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-toggle-all-empty-reset-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-toggle-all-empty-reset",
          "result": "fullfill",
          "note": "阅读当前源码，对照“清除全部已完成待办使清单为空后，不残留可见的全选选中状态；再次新增未完成待办时全选未选中。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-toggle-all-empty-reset-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                88
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            }
          ],
          "target_ref": "SACC-toggle-all-empty-reset",
          "result": "fullfill",
          "note": "实际执行：13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-toggle-all-global"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-toggle-all-global-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-toggle-all-global",
          "result": "fullfill",
          "note": "阅读当前源码，对照“在 Active 或 Completed 中执行全选或全部取消，隐藏条目也一并更新；当前筛选保持不变，可见条目按结果重新匹配。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-toggle-all-global-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                112
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            }
          ],
          "target_ref": "SACC-toggle-all-global",
          "result": "fullfill",
          "note": "实际执行：17 — global controls operate on invisible items [passed; batch 17]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "requirement",
        "ref": "SREQ-clear-completed"
      },
      "evidences": [
        {
          "id": "VEVD-SREQ-clear-completed-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SREQ-clear-completed",
          "result": "partial",
          "note": "阅读当前源码，对照“完整清单存在已完成待办时显示 Clear completed；点击删除所有已完成待办，保留未完成待办的身份、标题、状态和相对顺序，未完成计数不变。清除后按钮隐藏，有剩余待办则主体和页脚保留，清单为空则隐藏。 显示条件和删除范围均包含当前筛选隐藏的已完成待办。”。依据当前最终正文及子项汇总；子项必要条件均有证据。  代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SREQ-clear-completed-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                88,
                112
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            }
          ],
          "target_ref": "SREQ-clear-completed",
          "result": "partial",
          "note": "实际执行：13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]；17 — global controls operate on invisible items [passed; batch 17]；V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 "
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-clear-completed-visibility"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-clear-completed-visibility-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-clear-completed-visibility",
          "result": "fullfill",
          "note": "阅读当前源码，对照“有至少一条已完成待办时显示 Clear completed，没有已完成待办时隐藏。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-clear-completed-visibility-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                88
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            }
          ],
          "target_ref": "SACC-clear-completed-visibility",
          "result": "fullfill",
          "note": "实际执行：13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-clear-completed-remove"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-clear-completed-remove-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-clear-completed-remove",
          "result": "fullfill",
          "note": "阅读当前源码，对照“点击 Clear completed，所有已完成待办删除，未完成待办的身份、标题、状态和相对顺序不变，未完成数量不变。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-clear-completed-remove-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                88
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            }
          ],
          "target_ref": "SACC-clear-completed-remove",
          "result": "fullfill",
          "note": "实际执行：13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]；V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-clear-completed-after-clear"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-clear-completed-after-clear-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-clear-completed-after-clear",
          "result": "fullfill",
          "note": "阅读当前源码，对照“清除后按钮隐藏；若仍有未完成待办则继续显示主体和页脚，若删光则进入空清单状态。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-clear-completed-after-clear-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                88
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            }
          ],
          "target_ref": "SACC-clear-completed-after-clear",
          "result": "fullfill",
          "note": "实际执行：13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-clear-completed-global"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-clear-completed-global-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SACC-clear-completed-global",
          "result": "fullfill",
          "note": "阅读当前源码，对照“在 Active 中，只要完整清单有已完成待办就显示 Clear completed；点击清除全部隐藏的已完成项，未完成项不变，当前仍选中 Active。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-clear-completed-global-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                112
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            }
          ],
          "target_ref": "SACC-clear-completed-global",
          "result": "fullfill",
          "note": "实际执行：17 — global controls operate on invisible items [passed; batch 17]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "requirement",
        "ref": "SREQ-filter"
      },
      "evidences": [
        {
          "id": "VEVD-SREQ-filter-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SREQ-filter",
          "result": "partial",
          "note": "阅读当前源码，对照“页脚提供 All、Active、Completed，分别显示全部、未完成、已完成待办，并标明当前选中项。筛选仅决定可见条目，共享同一份完整清单，不修改实际内容、状态或原有相对顺序。 在任意视图操作同一份清单；新增、编辑、删除、单条或批量完成、清除已完成后立即按当前筛选重新匹配，筛选选择保持不变。”。依据当前最终正文及子项汇总；子项必要条件均有证据。  代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SREQ-filter-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                94,
                100,
                107,
                112
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/14.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/15.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/16.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SREQ-filter",
          "result": "partial",
          "note": "实际执行：14 — switching views preserves full list and original relative order [passed; batch 14]；15 — mutations recompute current view without changing selected filter [passed; batch 15]；16 — Completed add stays hidden but increments full count; empty view keeps footer [passed; batch 16]；17 — global controls operate on invisible items [passed; batch 17]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SREQ-filter-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SREQ-filter",
          "result": "partial",
          "note": "layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 "
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-filter-views"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-filter-views-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-filter-views",
          "result": "fullfill",
          "note": "阅读当前源码，对照“清单含未完成和已完成待办时，All 显示全部，Active 仅显示未完成，Completed 仅显示已完成。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-filter-views-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                94
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/14.execution.json"
            }
          ],
          "target_ref": "SACC-filter-views",
          "result": "fullfill",
          "note": "实际执行：14 — switching views preserves full list and original relative order [passed; batch 14]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-filter-selection"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-filter-selection-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-filter-selection",
          "result": "fullfill",
          "note": "阅读当前源码，对照“切换任一筛选后，仅该入口显示选中样式。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-filter-selection-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                94
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/14.execution.json"
            }
          ],
          "target_ref": "SACC-filter-selection",
          "result": "fullfill",
          "note": "实际执行：14 — switching views preserves full list and original relative order [passed; batch 14]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-filter-unchanged"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-filter-unchanged-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-filter-unchanged",
          "result": "fullfill",
          "note": "阅读当前源码，对照“切换筛选不新增、删除或修改实际待办，每个视图保留可见条目在完整清单中的相对顺序。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-filter-unchanged-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                94
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/14.execution.json"
            }
          ],
          "target_ref": "SACC-filter-unchanged",
          "result": "fullfill",
          "note": "实际执行：14 — switching views preserves full list and original relative order [passed; batch 14]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-filter-complete-in-active"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-filter-complete-in-active-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-filter-complete-in-active",
          "result": "fullfill",
          "note": "阅读当前源码，对照“在 Active 完成一条后，该条立即消失，在 Completed 或 All 可见，当前仍选中 Active。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-filter-complete-in-active-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                100
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/15.execution.json"
            }
          ],
          "target_ref": "SACC-filter-complete-in-active",
          "result": "fullfill",
          "note": "实际执行：15 — mutations recompute current view without changing selected filter [passed; batch 15]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-filter-reopen-in-completed"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-filter-reopen-in-completed-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-filter-reopen-in-completed",
          "result": "fullfill",
          "note": "阅读当前源码，对照“在 Completed 取消一条完成状态后，该条立即消失，在 Active 或 All 可见，当前仍选中 Completed。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-filter-reopen-in-completed-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                100
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/15.execution.json"
            }
          ],
          "target_ref": "SACC-filter-reopen-in-completed",
          "result": "fullfill",
          "note": "实际执行：15 — mutations recompute current view without changing selected filter [passed; batch 15]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-filter-mutation-sync"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-filter-mutation-sync-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-filter-mutation-sync",
          "result": "fullfill",
          "note": "阅读当前源码，对照“任一视图中新增、编辑、删除、全选或清除已完成后，可见列表立即按更新的清单重新匹配，当前筛选保持不变；删除项不再出现在任何视图。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-filter-mutation-sync-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                100,
                107,
                112
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/15.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/16.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-filter-mutation-sync",
          "result": "fullfill",
          "note": "实际执行：15 — mutations recompute current view without changing selected filter [passed; batch 15]；16 — Completed add stays hidden but increments full count; empty view keeps footer [passed; batch 16]；17 — global controls operate on invisible items [passed; batch 17]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-filter-selected-style"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-filter-selected-style-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-filter-selected-style",
          "result": "partial",
          "note": "阅读当前源码，对照“当前选中的分类以细的淡红色圆角边框圈出，其他分类无选中边框；切换分类时整排布局不明显跳动。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-filter-selected-style-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                94
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/14.execution.json"
            }
          ],
          "target_ref": "SACC-filter-selected-style",
          "result": "partial",
          "note": "实际执行：14 — switching views preserves full list and original relative order [passed; batch 14]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-filter-selected-style-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-filter-selected-style",
          "result": "fullfill",
          "note": "All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。"
      }
    },
    {
      "target": {
        "type": "requirement",
        "ref": "SREQ-navigation"
      },
      "evidences": [
        {
          "id": "VEVD-SREQ-navigation-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SREQ-navigation",
          "result": "partial",
          "note": "阅读当前源码，对照“地址 #/、#/active、#/completed 分别选择 All、Active、Completed；也允许实现统一采用等价的 #!/ 形式。未指定筛选时使用 All；直接访问合法地址采用对应筛选，点击入口时地址、选中项和列表同步更新，页面内导航保留现有待办。 浏览器后退、前进按历史记录同步筛选；在合法地址刷新后采用地址对应的筛选规则，但本版不要求恢复刷新前的待办。地址始终选择已定义的三种筛选，筛选语义调整时同步检查导航结果。”。依据当前最终正文及子项汇总；子项必要条件均有证据。  代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SREQ-navigation-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                118,
                122
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                5,
                7
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            }
          ],
          "target_ref": "SREQ-navigation",
          "result": "partial",
          "note": "实际执行：18 — direct URL selects category and click changes address without losing data [passed; batch 18]；19 — external address changes update selection without creating extra navigation [passed; batch 19]；canonical address mapping and unspecified default [passed; batch 18]；external history/address events publish selection without writing it back [passed; batch 19]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SREQ-navigation-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SREQ-navigation",
          "result": "partial",
          "note": "从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 "
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-navigation-default-direct"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-navigation-default-direct-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-navigation-default-direct",
          "result": "fullfill",
          "note": "阅读当前源码，对照“未指定筛选时使用 All；分别直接访问 #/、#/active、#/completed（或统一的等价 #!/ 入口），采用对应筛选规则。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-navigation-default-direct-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                118
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                5
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            }
          ],
          "target_ref": "SACC-navigation-default-direct",
          "result": "fullfill",
          "note": "实际执行：18 — direct URL selects category and click changes address without losing data [passed; batch 18]；canonical address mapping and unspecified default [passed; batch 18]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-navigation-click"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-navigation-click-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-navigation-click",
          "result": "fullfill",
          "note": "阅读当前源码，对照“页面已有待办时点击任一筛选入口，地址、选中入口和可见列表同步变化，完整清单的待办内容和顺序保留。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-navigation-click-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                118
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            }
          ],
          "target_ref": "SACC-navigation-click",
          "result": "fullfill",
          "note": "实际执行：18 — direct URL selects category and click changes address without losing data [passed; batch 18]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-navigation-route-consistency"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-navigation-route-consistency-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-navigation-route-consistency",
          "result": "fullfill",
          "note": "阅读当前源码，对照“采用 #/ 或等价 #!/ 形式时，三个入口与页面内导航使用一致形式；本版不要求同时支持两套形式。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-navigation-route-consistency-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                118
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                5
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            }
          ],
          "target_ref": "SACC-navigation-route-consistency",
          "result": "fullfill",
          "note": "实际执行：18 — direct URL selects category and click changes address without losing data [passed; batch 18]；canonical address mapping and unspecified default [passed; batch 18]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-navigation-history"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-navigation-history-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-navigation-history",
          "result": "partial",
          "note": "阅读当前源码，对照“从 All 切换到 Active 再到 Completed，后退依次返回 Active、All，前进依次回到 Active、Completed；地址、选中入口和可见列表同步，已有待办保持。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-navigation-history-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                122
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                7
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            }
          ],
          "target_ref": "SACC-navigation-history",
          "result": "partial",
          "note": "实际执行：19 — external address changes update selection without creating extra navigation [passed; batch 19]；external history/address events publish selection without writing it back [passed; batch 19]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-navigation-history-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-navigation-history",
          "result": "fullfill",
          "note": "从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-navigation-refresh"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-navigation-refresh-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-navigation-refresh",
          "result": "partial",
          "note": "阅读当前源码，对照“在合法筛选地址刷新页面后，采用地址对应的筛选规则；若操作页脚可见，其选中入口与地址一致。本项只验收筛选状态，不要求恢复刷新前的待办。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：分别直接访问并刷新 #/、#/active、#/completed，选中值为 All、Active、Completed；各次均显示空清单且 New todo 聚焦。此结果只证明筛选恢复，不证明待办恢复。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-navigation-refresh-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                118
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                5
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            }
          ],
          "target_ref": "SACC-navigation-refresh",
          "result": "partial",
          "note": "实际执行：18 — direct URL selects category and click changes address without losing data [passed; batch 18]；canonical address mapping and unspecified default [passed; batch 18]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-navigation-refresh-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-navigation-refresh",
          "result": "fullfill",
          "note": "分别直接访问并刷新 #/、#/active、#/completed，选中值为 All、Active、Completed；各次均显示空清单且 New todo 聚焦。此结果只证明筛选恢复，不证明待办恢复。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：分别直接访问并刷新 #/、#/active、#/completed，选中值为 All、Active、Completed；各次均显示空清单且 New todo 聚焦。此结果只证明筛选恢复，不证明待办恢复。"
      }
    },
    {
      "target": {
        "type": "requirement",
        "ref": "SREQ-persist"
      },
      "evidences": [
        {
          "id": "VEVD-SREQ-persist-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SREQ-persist",
          "result": "partial",
          "note": "阅读当前源码，对照“待办有效提交后自动将最新数据保存到当前浏览器 localStorage，无需额外保存操作，各框架实现相互隔离。保存每条待办的独立身份、整理后的标题、完成状态和加入顺序；改名更新原条目不产生副本，单条和批量状态切换同步保存，直接删除、空标题提交删除及清除已完成均移除对应数据，删光后保存空清单。 每次保存完整清单，包括当前筛选隐藏且未被操作的条目；未提交的新增文字、无效空输入、编辑草稿和正在编辑状态不作为已提交数据保存，Escape 后存储仍保留原标题。验收直接核对存储结果，不要求刷新后恢复显示；不得因不恢复或页面初始化未显示待办而清除已保存数据。”。依据当前最终正文及子项汇总；仍有 SACC-persist-automatic=partial。当前页面、可写且没有其他会话非空数据的正常提交已验证；已有非空旧数据时，本页所有新提交均返回 previous-session，不能核对新快照。ORISK-post-refresh-write-policy 尚未确定跨会话正确策略，因此保留 partial，不将保护旧数据等同于完整自动保存，也不擅自把恢复显示列为必需。  代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SREQ-persist-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                127,
                130,
                136,
                142,
                147
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
              "lines": [
                11
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
              "lines": [
                4,
                6
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53,
                80
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/20.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/22.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            }
          ],
          "target_ref": "SREQ-persist",
          "result": "partial",
          "note": "实际执行：20 — effective UI submission automatically saves in namespaced storage [passed; batch 20]；21 — editing, status and empty-title deletion update the same saved identity [passed; batch 21]；22 — editing draft survives unrelated renders and never leaks into other saves [passed; batch 22]；22 — startup and invalid drafts never write; filtered saves retain hidden identities [passed; batch 22]；23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]；all mutation paths save newest complete snapshot in order [passed; batch 21]；save isolates implementation keys and construction never writes [passed; batch 20]；snapshot contains only identity/title/completed, preserving array order [passed; batch 21]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]；V22 — prior data survives startup and repeated guarded submissions [passed; batch 22]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "partial",
        "reason": "依据当前最终正文及子项汇总；仍有 SACC-persist-automatic=partial。当前页面、可写且没有其他会话非空数据的正常提交已验证；已有非空旧数据时，本页所有新提交均返回 previous-session，不能核对新快照。ORISK-post-refresh-write-policy 尚未确定跨会话正确策略，因此保留 partial，不将保护旧数据等同于完整自动保存，也不擅自把恢复显示列为必需。 "
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-persist-automatic"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-persist-automatic-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-persist-automatic",
          "result": "partial",
          "note": "阅读当前源码，对照“完成一次有效待办操作后，无需额外保存动作，即可在当前实现的 localStorage 数据中核对最新结果。”。当前页面、可写且没有其他会话非空数据的正常提交已验证；已有非空旧数据时，本页所有新提交均返回 previous-session，不能核对新快照。ORISK-post-refresh-write-policy 尚未确定跨会话正确策略，因此保留 partial，不将保护旧数据等同于完整自动保存，也不擅自把恢复显示列为必需。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-persist-automatic-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                127
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
              "lines": [
                11
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/20.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-persist-automatic",
          "result": "fullfill",
          "note": "实际执行：20 — effective UI submission automatically saves in namespaced storage [passed; batch 20]；all mutation paths save newest complete snapshot in order [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "partial",
        "reason": "当前页面、可写且没有其他会话非空数据的正常提交已验证；已有非空旧数据时，本页所有新提交均返回 previous-session，不能核对新快照。ORISK-post-refresh-write-policy 尚未确定跨会话正确策略，因此保留 partial，不将保护旧数据等同于完整自动保存，也不擅自把恢复显示列为必需。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-persist-isolation"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-persist-isolation-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-persist-isolation",
          "result": "fullfill",
          "note": "阅读当前源码，对照“不同框架实现分别使用 todos-[framework]，其中 [framework] 替换为当前实现名称；一个实现的新增、修改或删除不覆盖另一实现的数据。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-persist-isolation-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
              "lines": [
                4
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/20.execution.json"
            }
          ],
          "target_ref": "SACC-persist-isolation",
          "result": "fullfill",
          "note": "实际执行：save isolates implementation keys and construction never writes [passed; batch 20]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-persist-create"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-persist-create-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-persist-create",
          "result": "fullfill",
          "note": "阅读当前源码，对照“有效新增后，存储中可核对独立身份、去除首尾空白的标题和未完成状态；连续新增保留加入顺序，同名两条保持独立。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-persist-create-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                127
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
              "lines": [
                11
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
              "lines": [
                6
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/20.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-persist-create",
          "result": "fullfill",
          "note": "实际执行：20 — effective UI submission automatically saves in namespaced storage [passed; batch 20]；all mutation paths save newest complete snapshot in order [passed; batch 21]；snapshot contains only identity/title/completed, preserving array order [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-persist-edit"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-persist-edit-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-persist-edit",
          "result": "fullfill",
          "note": "阅读当前源码，对照“通过 Enter 或失焦提交非空改名后，存储中同一身份的标题更新，完成状态和位置不变，不产生副本。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-persist-edit-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                130
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-persist-edit",
          "result": "fullfill",
          "note": "实际执行：21 — editing, status and empty-title deletion update the same saved identity [passed; batch 21]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-persist-completion"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-persist-completion-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-persist-completion",
          "result": "fullfill",
          "note": "阅读当前源码，对照“单条勾选、取消以及全选、全部取消后，存储中所有受影响待办的完成状态与操作结果一致，身份、标题和顺序不变。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-persist-completion-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                130
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
              "lines": [
                11
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-persist-completion",
          "result": "fullfill",
          "note": "实际执行：21 — editing, status and empty-title deletion update the same saved identity [passed; batch 21]；all mutation paths save newest complete snapshot in order [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-persist-delete"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-persist-delete-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-persist-delete",
          "result": "fullfill",
          "note": "阅读当前源码，对照“直接删除、将标题清空或改为纯空白后通过 Enter 或失焦提交删除、Clear completed 清除后，对应待办均从存储的有效清单移除；删光后存空清单，不残留旧的有效待办。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-persist-delete-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
              "lines": [
                11
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-persist-delete",
          "result": "fullfill",
          "note": "实际执行：all mutation paths save newest complete snapshot in order [passed; batch 21]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-persist-full-list"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-persist-full-list-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-persist-full-list",
          "result": "fullfill",
          "note": "阅读当前源码，对照“在 Active 或 Completed 中提交变化后，存储仍表示更新后的完整清单，筛选隐藏且未被操作的待办保留，不因不可见而丢失。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-persist-full-list-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                136,
                142
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/22.execution.json"
            }
          ],
          "target_ref": "SACC-persist-full-list",
          "result": "fullfill",
          "note": "实际执行：22 — editing draft survives unrelated renders and never leaks into other saves [passed; batch 22]；22 — startup and invalid drafts never write; filtered saves retain hidden identities [passed; batch 22]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-persist-exclude-drafts"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-persist-exclude-drafts-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-persist-exclude-drafts",
          "result": "fullfill",
          "note": "阅读当前源码，对照“新增框未按 Enter 的文字、被拒绝的空输入、编辑中的临时标题和正在编辑状态不进入已提交存储；即使此时发生其他有效操作，保存也不带入这些草稿。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-persist-exclude-drafts-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                136,
                142
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
              "lines": [
                6
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/22.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-persist-exclude-drafts",
          "result": "fullfill",
          "note": "实际执行：22 — editing draft survives unrelated renders and never leaks into other saves [passed; batch 22]；22 — startup and invalid drafts never write; filtered saves retain hidden identities [passed; batch 22]；snapshot contains only identity/title/completed, preserving array order [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-persist-cancel"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-persist-cancel-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-persist-cancel",
          "result": "fullfill",
          "note": "阅读当前源码，对照“编辑后按 Escape，存储中的标题仍为编辑前的已提交值；草稿为空或纯空白时也不删除存储中的原待办。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-persist-cancel-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                136,
                142
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/22.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "SACC-persist-cancel",
          "result": "fullfill",
          "note": "实际执行：22 — editing draft survives unrelated renders and never leaks into other saves [passed; batch 22]；22 — startup and invalid drafts never write; filtered saves retain hidden identities [passed; batch 22]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-persist-no-restore-no-clear"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-persist-no-restore-no-clear-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-persist-no-restore-no-clear",
          "result": "fullfill",
          "note": "阅读当前源码，对照“已有存储数据时刷新页面，本版不要求恢复并显示待办；不得仅因未恢复或初始显示为空而将已保存数据覆盖为空。持久化验收直接核对各次有效提交的存储结果。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-persist-no-restore-no-clear-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                136,
                142
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                80
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/22.execution.json"
            }
          ],
          "target_ref": "SACC-persist-no-restore-no-clear",
          "result": "fullfill",
          "note": "实际执行：22 — editing draft survives unrelated renders and never leaks into other saves [passed; batch 22]；22 — startup and invalid drafts never write; filtered saves retain hidden identities [passed; batch 22]；V22 — prior data survives startup and repeated guarded submissions [passed; batch 22]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-persist-plain-text"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-persist-plain-text-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SACC-persist-plain-text",
          "result": "fullfill",
          "note": "阅读当前源码，对照“新增或修改为“<b>买牛奶</b>”并提交后，存储标题为该文字本身，除规定的首尾空白处理外不擅自变更内容。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-persist-plain-text-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                147
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            }
          ],
          "target_ref": "SACC-persist-plain-text",
          "result": "fullfill",
          "note": "实际执行：23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "requirement",
        "ref": "SREQ-information"
      },
      "evidences": [
        {
          "id": "VEVD-SREQ-information-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "SREQ-information",
          "result": "partial",
          "note": "阅读当前源码，对照“卡片外居中展示 Double-click to edit a todo、当前实现的作者或团队信息，以及文字为 Part of TodoMVC、指向 https://todomvc.com/ 的项目链接；采用小号浅灰低强调文字，完整清单为空时仍保留。具体作者或团队文案由实现填写。”。依据当前最终正文及子项汇总；子项必要条件均有证据。  代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SREQ-information-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                163
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/27.execution.json"
            }
          ],
          "target_ref": "SREQ-information",
          "result": "partial",
          "note": "实际执行：27 — help/author/attribution remain outside hidden empty-list footer [passed; batch 27]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SREQ-information-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "SREQ-information",
          "result": "partial",
          "note": "layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "依据当前最终正文及子项汇总；子项必要条件均有证据。 "
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-information-content"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-information-content-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "SACC-information-content",
          "result": "fullfill",
          "note": "阅读当前源码，对照“卡片外显示 Double-click to edit a todo、当前实现的作者或团队名字，以及 Part of TodoMVC 链接，链接指向 https://todomvc.com/。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-information-content-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                163
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/27.execution.json"
            }
          ],
          "target_ref": "SACC-information-content",
          "result": "fullfill",
          "note": "实际执行：27 — help/author/attribution remain outside hidden empty-list footer [passed; batch 27]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-information-style"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-information-style-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "SACC-information-style",
          "result": "partial",
          "note": "阅读当前源码，对照“提示、作者或团队及归属信息居中，使用小号浅灰低强调文字。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-information-style-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                163
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/27.execution.json"
            }
          ],
          "target_ref": "SACC-information-style",
          "result": "partial",
          "note": "实际执行：27 — help/author/attribution remain outside hidden empty-list footer [passed; batch 27]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SACC-information-style-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "SACC-information-style",
          "result": "fullfill",
          "note": "当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
      }
    },
    {
      "target": {
        "type": "acceptance",
        "ref": "SACC-information-empty"
      },
      "evidences": [
        {
          "id": "VEVD-SACC-information-empty-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "SACC-information-empty",
          "result": "fullfill",
          "note": "阅读当前源码，对照“完整清单为空且操作页脚隐藏时，卡片外提示、作者或团队及 TodoMVC 项目链接仍可见。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SACC-information-empty-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                163
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/27.execution.json"
            }
          ],
          "target_ref": "SACC-information-empty",
          "result": "fullfill",
          "note": "实际执行：27 — help/author/attribution remain outside hidden empty-list footer [passed; batch 27]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "constraint",
        "ref": "SCON-consistent-behavior"
      },
      "evidences": [
        {
          "id": "VEVD-SCON-consistent-behavior-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SCON-consistent-behavior",
          "result": "partial",
          "note": "阅读当前源码，对照“应用在浏览器中使用一份待办清单；操作文案为英文，不同语言或框架的实现保持本版已确认的功能和用户可见用法一致。”。本次只验证 todo 的浏览器单清单和英文文案；没有对其他语言/框架实现执行同一验收套件，跨实现等价性证据不足。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SCON-consistent-behavior-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                20,
                163
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/01.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/27.execution.json"
            }
          ],
          "target_ref": "SCON-consistent-behavior",
          "result": "fullfill",
          "note": "实际执行：01 — browser shell has todos title and one list region [passed; batch 1]；27 — help/author/attribution remain outside hidden empty-list footer [passed; batch 27]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "partial",
        "reason": "本次只验证 todo 的浏览器单清单和英文文案；没有对其他语言/框架实现执行同一验收套件，跨实现等价性证据不足。"
      }
    },
    {
      "target": {
        "type": "constraint",
        "ref": "SCON-local-storage"
      },
      "evidences": [
        {
          "id": "VEVD-SCON-local-storage-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SCON-local-storage",
          "result": "partial",
          "note": "阅读当前源码，对照“已提交待办数据保存在当前浏览器的 localStorage，存储键遵循 todos-[framework]，其中 [framework] 替换为实现名称；不同框架实现的新增、修改和删除不得覆盖彼此的清单。具体框架内部实现不在本版业务需求中指定。”。保存键 todos-vanilla、序列化投影及实现隔离已验证；旧会话非空数据使本页后续新改动一直无法保存，跨会话衔接未定义。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SCON-local-storage-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                127
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
              "lines": [
                4
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                80
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/20.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/22.execution.json"
            }
          ],
          "target_ref": "SCON-local-storage",
          "result": "fullfill",
          "note": "实际执行：20 — effective UI submission automatically saves in namespaced storage [passed; batch 20]；save isolates implementation keys and construction never writes [passed; batch 20]；V22 — prior data survives startup and repeated guarded submissions [passed; batch 22]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "partial",
        "reason": "保存键 todos-vanilla、序列化投影及实现隔离已验证；旧会话非空数据使本页后续新改动一直无法保存，跨会话衔接未定义。"
      }
    },
    {
      "target": {
        "type": "constraint",
        "ref": "SCON-plain-text"
      },
      "evidences": [
        {
          "id": "VEVD-SCON-plain-text-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "SCON-plain-text",
          "result": "fullfill",
          "note": "阅读当前源码，对照“待办标题在新增、编辑、列表展示和保存过程中始终作为用户文本处理。除规定的首尾空白处理外，保留标题内容；例如输入 <b>买牛奶</b> 时，显示并保存这段文字本身，不将其解释为页面标记或可执行内容。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SCON-plain-text-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                147
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            }
          ],
          "target_ref": "SCON-plain-text",
          "result": "fullfill",
          "note": "实际执行：23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "constraint",
        "ref": "SCON-visual-layout"
      },
      "evidences": [
        {
          "id": "VEVD-SCON-visual-layout-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "SCON-visual-layout",
          "result": "partial",
          "note": "阅读当前源码，对照“页面采用简洁轻量的单列布局：很浅的灰色背景，水平居中的白色待办卡片；桌面宽度适中、不铺满屏幕，窄屏随可用宽度收缩且不产生横向滚动。todos 在卡片上方居中，使用明显大于输入框和清单文字的细体淡红色字，形成清晰视觉层级。 白色卡片可使用轻微阴影和底部叠纸效果；操作页脚紧凑、状态切换不明显跳动，控件与文字遵守各要求中的可见样式。卡片外的提示与归属信息居中显示为小号浅灰文字。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SCON-visual-layout-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                153,
                156,
                159,
                163
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/24.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/25.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/26.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/27.execution.json"
            }
          ],
          "target_ref": "SCON-visual-layout",
          "result": "partial",
          "note": "实际执行：24 — page retains one card and heading through empty/full transitions [passed; batch 24]；25 — long multiline and spaced titles remain readable content [passed; batch 25]；26 — editing class and controls switch coherently back to completed display [passed; batch 26]；27 — help/author/attribution remain outside hidden empty-list footer [passed; batch 27]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SCON-visual-layout-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "SCON-visual-layout",
          "result": "partial",
          "note": "layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
      }
    },
    {
      "target": {
        "type": "relation",
        "ref": "SREL-navigation-depends-filter"
      },
      "evidences": [
        {
          "id": "VEVD-SREL-navigation-depends-filter-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SREL-navigation-depends-filter",
          "result": "partial",
          "note": "阅读当前源码，对照“地址导航选择 All、Active、Completed 中的一种视图，其显示结果依赖状态筛选要求中定义的匹配规则；筛选规则调整时，须同步检查直接访问、点击切换、浏览器前进后退和刷新后的筛选结果。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-SREL-navigation-depends-filter-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                94,
                118,
                122
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                5
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/14.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            }
          ],
          "target_ref": "SREL-navigation-depends-filter",
          "result": "partial",
          "note": "实际执行：14 — switching views preserves full list and original relative order [passed; batch 14]；18 — direct URL selects category and click changes address without losing data [passed; batch 18]；19 — external address changes update selection without creating extra navigation [passed; batch 19]；canonical address mapping and unspecified default [passed; batch 18]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-SREL-navigation-depends-filter-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "SREL-navigation-depends-filter",
          "result": "partial",
          "note": "从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
      }
    }
  ],
  "solution_checks": [
    {
      "target": {
        "type": "app",
        "ref": "OAPP-todos"
      },
      "evidences": [
        {
          "id": "VEVD-OAPP-todos-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/package.json"
            }
          ],
          "target_ref": "OAPP-todos",
          "result": "fullfill",
          "note": "阅读当前源码，对照“在浏览器中运行的单清单待办应用；由页面内模块实现已确认的业务，架构不绑定具体语言或框架。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OAPP-todos-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                20
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/01.execution.json"
            }
          ],
          "target_ref": "OAPP-todos",
          "result": "fullfill",
          "note": "实际执行：01 — browser shell has todos title and one list region [passed; batch 1]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "module",
        "ref": "OMOD-ui"
      },
      "evidences": [
        {
          "id": "VEVD-OMOD-ui-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "OMOD-ui",
          "result": "partial",
          "note": "阅读当前源码，对照“负责页面布局、英文文案、文本呈现、新增草稿与编辑会话；通过状态模块执行命令并读取投影，通过导航模块同步地址筛选。按完整清单控制主体及页脚显隐，卡片外帮助归属始终保留；界面不直接写保存资源。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OMOD-ui-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                20,
                23,
                48,
                54,
                61,
                65,
                71,
                94,
                118,
                163
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/01.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/02.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/07.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/08.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/09.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/14.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/27.execution.json"
            }
          ],
          "target_ref": "OMOD-ui",
          "result": "partial",
          "note": "实际执行：01 — browser shell has todos title and one list region [passed; batch 1]；02 — focus, unsubmitted draft, Enter, clear and repeated add [passed; batch 2]；07 — completed title starts focused edit without mutating committed content [passed; batch 7]；08 — Enter then residual blur submits only once, trims and preserves identity/status [passed; batch 8]；08 — blur commits nonempty title [passed; batch 8]；09 — Escape with text, empty or whitespace restores original and suppresses blur [passed; batch 9]；10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；14 — switching views preserves full list and original relative order [passed; batch 14]；18 — direct URL selects category and click changes address without losing data [passed; batch 18]；27 — help/author/attribution remain outside hidden empty-list footer [passed; batch 27]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-OMOD-ui-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "OMOD-ui",
          "result": "partial",
          "note": "双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。"
      }
    },
    {
      "target": {
        "type": "module",
        "ref": "OMOD-store"
      },
      "evidences": [
        {
          "id": "VEVD-OMOD-store-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OMOD-store",
          "result": "fullfill",
          "note": "阅读当前源码，对照“拥有本页完整清单，统一处理用户命令并派生展示快照；有效变更通过保存适配提交最新清单，界面重绘不能触发额外写入。”。目标正文对应的代码职责与所列测试断言一致。 已核对真实失败返回及初始化不写入；跨会话恢复策略未定义，保存保护限制单独列入 VFND-cross-session-save，不据此宣称数据连续性已验证。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OMOD-store-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                112
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
              "lines": [
                3,
                11
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/02.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            }
          ],
          "target_ref": "OMOD-store",
          "result": "fullfill",
          "note": "实际执行：17 — global controls operate on invisible items [passed; batch 17]；snapshot copies cannot mutate owned data [passed; batch 2]；all mutation paths save newest complete snapshot in order [passed; batch 21]；V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 已核对真实失败返回及初始化不写入；跨会话恢复策略未定义，保存保护限制单独列入 VFND-cross-session-save，不据此宣称数据连续性已验证。"
      }
    },
    {
      "target": {
        "type": "module",
        "ref": "OMOD-router"
      },
      "evidences": [
        {
          "id": "VEVD-OMOD-router-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            }
          ],
          "target_ref": "OMOD-router",
          "result": "partial",
          "note": "阅读当前源码，对照“拥有地址与规范筛选值的映射，处理首次读取、点击切换和浏览器历史变化；地址变化后通知页面规范选择，不持有待办或复制匹配规则。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OMOD-router-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                118
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                5,
                7
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            }
          ],
          "target_ref": "OMOD-router",
          "result": "partial",
          "note": "实际执行：18 — direct URL selects category and click changes address without losing data [passed; batch 18]；canonical address mapping and unspecified default [passed; batch 18]；external history/address events publish selection without writing it back [passed; batch 19]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-OMOD-router-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            }
          ],
          "target_ref": "OMOD-router",
          "result": "partial",
          "note": "从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
      }
    },
    {
      "target": {
        "type": "module",
        "ref": "OMOD-storage"
      },
      "evidences": [
        {
          "id": "VEVD-OMOD-storage-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            }
          ],
          "target_ref": "OMOD-storage",
          "result": "fullfill",
          "note": "阅读当前源码，对照“把状态模块提交的完整清单写入当前实现隔离的浏览器保存空间；封装保存边界和结果，不接收界面草稿，不承担筛选和清单业务修改。”。目标正文对应的代码职责与所列测试断言一致。 已核对真实失败返回及初始化不写入；跨会话恢复策略未定义，保存保护限制单独列入 VFND-cross-session-save，不据此宣称数据连续性已验证。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OMOD-storage-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                127
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
              "lines": [
                4,
                5
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/20.execution.json"
            }
          ],
          "target_ref": "OMOD-storage",
          "result": "fullfill",
          "note": "实际执行：20 — effective UI submission automatically saves in namespaced storage [passed; batch 20]；save isolates implementation keys and construction never writes [passed; batch 20]；storage access and write exceptions return failure [passed; batch 20]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 已核对真实失败返回及初始化不写入；跨会话恢复策略未定义，保存保护限制单独列入 VFND-cross-session-save，不据此宣称数据连续性已验证。"
      }
    },
    {
      "target": {
        "type": "resource",
        "ref": "ORES-navigation"
      },
      "evidences": [
        {
          "id": "VEVD-ORES-navigation-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            }
          ],
          "target_ref": "ORES-navigation",
          "result": "partial",
          "note": "阅读当前源码，对照“提供当前页面地址的读取和页面内导航记录能力，不承载待办内容。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-ORES-navigation-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                118
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                5,
                7
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            }
          ],
          "target_ref": "ORES-navigation",
          "result": "partial",
          "note": "实际执行：18 — direct URL selects category and click changes address without losing data [passed; batch 18]；canonical address mapping and unspecified default [passed; batch 18]；external history/address events publish selection without writing it back [passed; batch 19]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-ORES-navigation-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            }
          ],
          "target_ref": "ORES-navigation",
          "result": "partial",
          "note": "从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
      }
    },
    {
      "target": {
        "type": "resource",
        "ref": "ORES-todo-data"
      },
      "evidences": [
        {
          "id": "VEVD-ORES-todo-data-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            }
          ],
          "target_ref": "ORES-todo-data",
          "result": "fullfill",
          "note": "阅读当前源码，对照“提供当前浏览器中按实现隔离的待办快照保存能力；是逻辑数据资源，不包含连接、部署或具体产品实例。”。目标正文对应的代码职责与所列测试断言一致。 已核对真实失败返回及初始化不写入；跨会话恢复策略未定义，保存保护限制单独列入 VFND-cross-session-save，不据此宣称数据连续性已验证。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-ORES-todo-data-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                127
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
              "lines": [
                4,
                5
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/20.execution.json"
            }
          ],
          "target_ref": "ORES-todo-data",
          "result": "fullfill",
          "note": "实际执行：20 — effective UI submission automatically saves in namespaced storage [passed; batch 20]；save isolates implementation keys and construction never writes [passed; batch 20]；storage access and write exceptions return failure [passed; batch 20]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 已核对真实失败返回及初始化不写入；跨会话恢复策略未定义，保存保护限制单独列入 VFND-cross-session-save，不据此宣称数据连续性已验证。"
      }
    },
    {
      "target": {
        "type": "relation",
        "ref": "OREL-ui-store"
      },
      "evidences": [
        {
          "id": "VEVD-OREL-ui-store-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OREL-ui-store",
          "result": "fullfill",
          "note": "阅读当前源码，对照“页面通过稳定能力提交清单变更并读取展示快照；不绕过状态模块直接改写条目。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OREL-ui-store-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                23,
                36,
                94
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/02.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/14.execution.json"
            }
          ],
          "target_ref": "OREL-ui-store",
          "result": "fullfill",
          "note": "实际执行：02 — focus, unsubmitted draft, Enter, clear and repeated add [passed; batch 2]；05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]；14 — switching views preserves full list and original relative order [passed; batch 14]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "relation",
        "ref": "OREL-ui-router"
      },
      "evidences": [
        {
          "id": "VEVD-OREL-ui-router-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            }
          ],
          "target_ref": "OREL-ui-router",
          "result": "fullfill",
          "note": "阅读当前源码，对照“页面读取规范筛选或请求切换地址，实际匹配仍委托清单状态。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OREL-ui-router-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                118
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                5,
                7
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            }
          ],
          "target_ref": "OREL-ui-router",
          "result": "fullfill",
          "note": "实际执行：18 — direct URL selects category and click changes address without losing data [passed; batch 18]；canonical address mapping and unspecified default [passed; batch 18]；external history/address events publish selection without writing it back [passed; batch 19]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "relation",
        "ref": "OREL-router-read-location"
      },
      "evidences": [
        {
          "id": "VEVD-OREL-router-read-location-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            }
          ],
          "target_ref": "OREL-router-read-location",
          "result": "fullfill",
          "note": "阅读当前源码，对照“导航模块读取当前页面地址并解析选择。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OREL-router-read-location-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                118
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                5,
                7
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            }
          ],
          "target_ref": "OREL-router-read-location",
          "result": "fullfill",
          "note": "实际执行：18 — direct URL selects category and click changes address without losing data [passed; batch 18]；canonical address mapping and unspecified default [passed; batch 18]；external history/address events publish selection without writing it back [passed; batch 19]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "relation",
        "ref": "OREL-router-write-location"
      },
      "evidences": [
        {
          "id": "VEVD-OREL-router-write-location-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            }
          ],
          "target_ref": "OREL-router-write-location",
          "result": "fullfill",
          "note": "阅读当前源码，对照“导航模块把明确选择写为规范地址并记录页面内导航。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OREL-router-write-location-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                118
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                5,
                7
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            }
          ],
          "target_ref": "OREL-router-write-location",
          "result": "fullfill",
          "note": "实际执行：18 — direct URL selects category and click changes address without losing data [passed; batch 18]；canonical address mapping and unspecified default [passed; batch 18]；external history/address events publish selection without writing it back [passed; batch 19]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "relation",
        "ref": "OREL-ui-router-events"
      },
      "evidences": [
        {
          "id": "VEVD-OREL-ui-router-events-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            }
          ],
          "target_ref": "OREL-ui-router-events",
          "result": "fullfill",
          "note": "阅读当前源码，对照“页面订阅导航模块发布的筛选变化，重新读取清单投影而不修改清单。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OREL-ui-router-events-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                118
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                5,
                7
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            }
          ],
          "target_ref": "OREL-ui-router-events",
          "result": "fullfill",
          "note": "实际执行：18 — direct URL selects category and click changes address without losing data [passed; batch 18]；canonical address mapping and unspecified default [passed; batch 18]；external history/address events publish selection without writing it back [passed; batch 19]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "relation",
        "ref": "OREL-router-history-events"
      },
      "evidences": [
        {
          "id": "VEVD-OREL-router-history-events-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            }
          ],
          "target_ref": "OREL-router-history-events",
          "result": "fullfill",
          "note": "阅读当前源码，对照“导航模块接收地址与历史的外部变化，再解析当前规范筛选。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OREL-router-history-events-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                118
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                5,
                7
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            }
          ],
          "target_ref": "OREL-router-history-events",
          "result": "fullfill",
          "note": "实际执行：18 — direct URL selects category and click changes address without losing data [passed; batch 18]；canonical address mapping and unspecified default [passed; batch 18]；external history/address events publish selection without writing it back [passed; batch 19]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "relation",
        "ref": "OREL-store-storage"
      },
      "evidences": [
        {
          "id": "VEVD-OREL-store-storage-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            }
          ],
          "target_ref": "OREL-store-storage",
          "result": "fullfill",
          "note": "阅读当前源码，对照“清单状态在有效变更后提交完整快照给保存适配，并读取保存结果；保存不由界面重绘触发。”。目标正文对应的代码职责与所列测试断言一致。 已核对真实失败返回及初始化不写入；跨会话恢复策略未定义，保存保护限制单独列入 VFND-cross-session-save，不据此宣称数据连续性已验证。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OREL-store-storage-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                127
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
              "lines": [
                4,
                5
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/20.execution.json"
            }
          ],
          "target_ref": "OREL-store-storage",
          "result": "fullfill",
          "note": "实际执行：20 — effective UI submission automatically saves in namespaced storage [passed; batch 20]；save isolates implementation keys and construction never writes [passed; batch 20]；storage access and write exceptions return failure [passed; batch 20]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 已核对真实失败返回及初始化不写入；跨会话恢复策略未定义，保存保护限制单独列入 VFND-cross-session-save，不据此宣称数据连续性已验证。"
      }
    },
    {
      "target": {
        "type": "relation",
        "ref": "OREL-storage-writes"
      },
      "evidences": [
        {
          "id": "VEVD-OREL-storage-writes-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            }
          ],
          "target_ref": "OREL-storage-writes",
          "result": "fullfill",
          "note": "阅读当前源码，对照“保存适配写入当前实现隔离的待办空间，不能覆盖其他实现。”。目标正文对应的代码职责与所列测试断言一致。 已核对真实失败返回及初始化不写入；跨会话恢复策略未定义，保存保护限制单独列入 VFND-cross-session-save，不据此宣称数据连续性已验证。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OREL-storage-writes-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                127
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
              "lines": [
                4,
                5
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/20.execution.json"
            }
          ],
          "target_ref": "OREL-storage-writes",
          "result": "fullfill",
          "note": "实际执行：20 — effective UI submission automatically saves in namespaced storage [passed; batch 20]；save isolates implementation keys and construction never writes [passed; batch 20]；storage access and write exceptions return failure [passed; batch 20]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 已核对真实失败返回及初始化不写入；跨会话恢复策略未定义，保存保护限制单独列入 VFND-cross-session-save，不据此宣称数据连续性已验证。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-launch"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-launch-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-launch",
          "result": "partial",
          "note": "阅读当前源码，对照“打开页面并建立当前展示状态”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：分别直接访问并刷新 #/、#/active、#/completed，选中值为 All、Active、Completed；各次均显示空清单且 New todo 聚焦。此结果只证明筛选恢复，不证明待办恢复。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-launch-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                20,
                23,
                118,
                163
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                80
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/01.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/02.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/27.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/22.execution.json"
            }
          ],
          "target_ref": "OSCN-launch",
          "result": "partial",
          "note": "实际执行：01 — browser shell has todos title and one list region [passed; batch 1]；02 — focus, unsubmitted draft, Enter, clear and repeated add [passed; batch 2]；18 — direct URL selects category and click changes address without losing data [passed; batch 18]；27 — help/author/attribution remain outside hidden empty-list footer [passed; batch 27]；V22 — prior data survives startup and repeated guarded submissions [passed; batch 22]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-OSCN-launch-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-launch",
          "result": "partial",
          "note": "分别直接访问并刷新 #/、#/active、#/completed，选中值为 All、Active、Completed；各次均显示空清单且 New todo 聚焦。此结果只证明筛选恢复，不证明待办恢复。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：分别直接访问并刷新 #/、#/active、#/completed，选中值为 All、Active、Completed；各次均显示空清单且 New todo 聚焦。此结果只证明筛选恢复，不证明待办恢复。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-create"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-create-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-create",
          "result": "fullfill",
          "note": "阅读当前源码，对照“有效标题新增一条待办”。目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-create-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                23,
                28,
                107,
                127
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/02.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/03.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/16.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/20.execution.json"
            }
          ],
          "target_ref": "OSCN-create",
          "result": "fullfill",
          "note": "实际执行：02 — focus, unsubmitted draft, Enter, clear and repeated add [passed; batch 2]；03 — trim only edges, reject empty, keep independent duplicate titles [passed; batch 3]；16 — Completed add stays hidden but increments full count; empty view keeps footer [passed; batch 16]；20 — effective UI submission automatically saves in namespaced storage [passed; batch 20]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-reject-create"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-reject-create-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-reject-create",
          "result": "fullfill",
          "note": "阅读当前源码，对照“拒绝空标题新增”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-reject-create-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                28,
                136,
                142
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/03.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/22.execution.json"
            }
          ],
          "target_ref": "OSCN-reject-create",
          "result": "fullfill",
          "note": "实际执行：03 — trim only edges, reject empty, keep independent duplicate titles [passed; batch 3]；22 — editing draft survives unrelated renders and never leaks into other saves [passed; batch 22]；22 — startup and invalid drafts never write; filtered saves retain hidden identities [passed; batch 22]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-complete"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-complete-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-complete",
          "result": "fullfill",
          "note": "阅读当前源码，对照“完成单条待办”。目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-complete-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                36,
                42,
                130
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/06.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OSCN-complete",
          "result": "fullfill",
          "note": "实际执行：05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]；06 — count wording, bold number, zero on nonempty completed list [passed; batch 6]；21 — editing, status and empty-title deletion update the same saved identity [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-reopen"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-reopen-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-reopen",
          "result": "fullfill",
          "note": "阅读当前源码，对照“重新打开单条待办”。目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-reopen-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                36,
                42,
                130
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/06.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OSCN-reopen",
          "result": "fullfill",
          "note": "实际执行：05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]；06 — count wording, bold number, zero on nonempty completed list [passed; batch 6]；21 — editing, status and empty-title deletion update the same saved identity [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-begin-edit"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-begin-edit-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-begin-edit",
          "result": "partial",
          "note": "阅读当前源码，对照“开始就地编辑”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-begin-edit-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                48,
                159
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/07.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/26.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OSCN-begin-edit",
          "result": "partial",
          "note": "实际执行：07 — completed title starts focused edit without mutating committed content [passed; batch 7]；26 — editing class and controls switch coherently back to completed display [passed; batch 26]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-OSCN-begin-edit-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-begin-edit",
          "result": "partial",
          "note": "双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-submit-edit"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-submit-edit-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-submit-edit",
          "result": "fullfill",
          "note": "阅读当前源码，对照“提交非空编辑标题”。目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-submit-edit-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                54,
                61,
                100
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/08.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/15.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OSCN-submit-edit",
          "result": "fullfill",
          "note": "实际执行：08 — Enter then residual blur submits only once, trims and preserves identity/status [passed; batch 8]；08 — blur commits nonempty title [passed; batch 8]；15 — mutations recompute current view without changing selected filter [passed; batch 15]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-cancel-edit"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-cancel-edit-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-cancel-edit",
          "result": "fullfill",
          "note": "阅读当前源码，对照“取消编辑并忽略后续失焦”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-cancel-edit-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                65,
                136,
                142
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/09.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/22.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OSCN-cancel-edit",
          "result": "fullfill",
          "note": "实际执行：09 — Escape with text, empty or whitespace restores original and suppresses blur [passed; batch 9]；22 — editing draft survives unrelated renders and never leaks into other saves [passed; batch 22]；22 — startup and invalid drafts never write; filtered saves retain hidden identities [passed; batch 22]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-delete-by-edit"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-delete-by-edit-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-delete-by-edit",
          "result": "fullfill",
          "note": "阅读当前源码，对照“提交空标题删除待办”。目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-delete-by-edit-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                71,
                112
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OSCN-delete-by-edit",
          "result": "fullfill",
          "note": "实际执行：10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；17 — global controls operate on invisible items [passed; batch 17]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-delete"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-delete-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-delete",
          "result": "partial",
          "note": "阅读当前源码，对照“直接删除一条待办”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-delete-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                79
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/11.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OSCN-delete",
          "result": "partial",
          "note": "实际执行：11 — delete button targets independent identity [passed; batch 11]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-OSCN-delete-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-delete",
          "result": "partial",
          "note": "指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-complete-all"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-complete-all-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-complete-all",
          "result": "fullfill",
          "note": "阅读当前源码，对照“完成整份清单”。目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-complete-all-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                82,
                112
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
              "lines": [
                11
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/12.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OSCN-complete-all",
          "result": "fullfill",
          "note": "实际执行：12 — UI toggle-all derives from full list and resets on reopen/add [passed; batch 12]；17 — global controls operate on invisible items [passed; batch 17]；all mutation paths save newest complete snapshot in order [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-reopen-all"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-reopen-all-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-reopen-all",
          "result": "fullfill",
          "note": "阅读当前源码，对照“重新打开整份清单”。目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-reopen-all-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                82,
                112
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
              "lines": [
                11
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/12.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OSCN-reopen-all",
          "result": "fullfill",
          "note": "实际执行：12 — UI toggle-all derives from full list and resets on reopen/add [passed; batch 12]；17 — global controls operate on invisible items [passed; batch 17]；all mutation paths save newest complete snapshot in order [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-clear-completed"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-clear-completed-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-clear-completed",
          "result": "fullfill",
          "note": "阅读当前源码，对照“清除整份清单的已完成待办”。目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-clear-completed-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                88,
                112
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
              "lines": [
                11
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OSCN-clear-completed",
          "result": "fullfill",
          "note": "实际执行：13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]；17 — global controls operate on invisible items [passed; batch 17]；all mutation paths save newest complete snapshot in order [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-select-filter"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-select-filter-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            }
          ],
          "target_ref": "OSCN-select-filter",
          "result": "fullfill",
          "note": "阅读当前源码，对照“切换完成状态筛选”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-select-filter-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                94,
                118
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/14.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            }
          ],
          "target_ref": "OSCN-select-filter",
          "result": "fullfill",
          "note": "实际执行：14 — switching views preserves full list and original relative order [passed; batch 14]；18 — direct URL selects category and click changes address without losing data [passed; batch 18]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-complete-in-active"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-complete-in-active-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-complete-in-active",
          "result": "fullfill",
          "note": "阅读当前源码，对照“在 Active 中完成待办”。目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-complete-in-active-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                100,
                130
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/15.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OSCN-complete-in-active",
          "result": "fullfill",
          "note": "实际执行：15 — mutations recompute current view without changing selected filter [passed; batch 15]；21 — editing, status and empty-title deletion update the same saved identity [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-reopen-in-completed"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-reopen-in-completed-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-reopen-in-completed",
          "result": "fullfill",
          "note": "阅读当前源码，对照“在 Completed 中重新打开待办”。目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-reopen-in-completed-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                100,
                130
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/15.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OSCN-reopen-in-completed",
          "result": "fullfill",
          "note": "实际执行：15 — mutations recompute current view without changing selected filter [passed; batch 15]；21 — editing, status and empty-title deletion update the same saved identity [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-create-in-completed"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-create-in-completed-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-create-in-completed",
          "result": "fullfill",
          "note": "阅读当前源码，对照“在 Completed 中新增未完成待办”。目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-create-in-completed-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                107,
                136,
                142
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/16.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/22.execution.json"
            }
          ],
          "target_ref": "OSCN-create-in-completed",
          "result": "fullfill",
          "note": "实际执行：16 — Completed add stays hidden but increments full count; empty view keeps footer [passed; batch 16]；22 — editing draft survives unrelated renders and never leaks into other saves [passed; batch 22]；22 — startup and invalid drafts never write; filtered saves retain hidden identities [passed; batch 22]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-clear-hidden-completed"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-clear-hidden-completed-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-clear-hidden-completed",
          "result": "fullfill",
          "note": "阅读当前源码，对照“在 Active 中清除隐藏的已完成项”。目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-clear-hidden-completed-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                112
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
              "lines": [
                11
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OSCN-clear-hidden-completed",
          "result": "fullfill",
          "note": "实际执行：17 — global controls operate on invisible items [passed; batch 17]；all mutation paths save newest complete snapshot in order [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 保存步骤的 verified 仅适用于当前页会话且保存成功的正常路径；ORISK-storage-failure 与 ORISK-post-refresh-write-policy 的异常/跨会话恢复不在该结论内。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-history-back"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-history-back-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-history-back",
          "result": "partial",
          "note": "阅读当前源码，对照“浏览器后退同步筛选”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-history-back-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                122
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                7
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            }
          ],
          "target_ref": "OSCN-history-back",
          "result": "partial",
          "note": "实际执行：19 — external address changes update selection without creating extra navigation [passed; batch 19]；external history/address events publish selection without writing it back [passed; batch 19]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-OSCN-history-back-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-history-back",
          "result": "partial",
          "note": "从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-history-forward"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-history-forward-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-history-forward",
          "result": "partial",
          "note": "阅读当前源码，对照“浏览器前进同步筛选”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-history-forward-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                122
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                7
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            }
          ],
          "target_ref": "OSCN-history-forward",
          "result": "partial",
          "note": "实际执行：19 — external address changes update selection without creating extra navigation [passed; batch 19]；external history/address events publish selection without writing it back [passed; batch 19]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-OSCN-history-forward-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OSCN-history-forward",
          "result": "partial",
          "note": "从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
      }
    },
    {
      "target": {
        "type": "scenario",
        "ref": "OSCN-show-empty-information"
      },
      "evidences": [
        {
          "id": "VEVD-OSCN-show-empty-information-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "OSCN-show-empty-information",
          "result": "fullfill",
          "note": "阅读当前源码，对照“空清单仍显示帮助与归属”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OSCN-show-empty-information-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                88,
                163
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/27.execution.json"
            }
          ],
          "target_ref": "OSCN-show-empty-information",
          "result": "fullfill",
          "note": "实际执行：13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]；27 — help/author/attribution remain outside hidden empty-list footer [passed; batch 27]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "concept",
        "ref": "OCON-todo-state"
      },
      "evidences": [
        {
          "id": "VEVD-OCON-todo-state-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "OCON-todo-state",
          "result": "fullfill",
          "note": "阅读当前源码，对照“本页完整清单是待办内容的唯一业务状态；每条由身份、标题、完成状态和加入位置构成。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OCON-todo-state-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                28,
                36,
                54,
                61,
                71,
                79,
                82,
                88
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
              "lines": [
                3
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/03.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/05.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/08.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/11.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/12.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/02.execution.json"
            }
          ],
          "target_ref": "OCON-todo-state",
          "result": "fullfill",
          "note": "实际执行：03 — trim only edges, reject empty, keep independent duplicate titles [passed; batch 3]；05 — UI toggle updates exactly the targeted todo and completion style [passed; batch 5]；08 — Enter then residual blur submits only once, trims and preserves identity/status [passed; batch 8]；08 — blur commits nonempty title [passed; batch 8]；10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；11 — delete button targets independent identity [passed; batch 11]；12 — UI toggle-all derives from full list and resets on reopen/add [passed; batch 12]；13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]；snapshot copies cannot mutate owned data [passed; batch 2]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "concept",
        "ref": "OCON-projection"
      },
      "evidences": [
        {
          "id": "VEVD-OCON-projection-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OCON-projection",
          "result": "fullfill",
          "note": "阅读当前源码，对照“展示值由完整清单派生，界面只消费一致快照；区域可见性与待办顺序不是另存的一份业务状态。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OCON-projection-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                32,
                42,
                82,
                88,
                107,
                112
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                35
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/04.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/06.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/12.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/13.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/16.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            }
          ],
          "target_ref": "OCON-projection",
          "result": "fullfill",
          "note": "实际执行：04 — empty main disappears, first add reveals it, stable order [passed; batch 4]；06 — count wording, bold number, zero on nonempty completed list [passed; batch 6]；12 — UI toggle-all derives from full list and resets on reopen/add [passed; batch 12]；13 — Clear completed keeps active entries and resets after deleting all [passed; batch 13]；16 — Completed add stays hidden but increments full count; empty view keeps footer [passed; batch 16]；17 — global controls operate on invisible items [passed; batch 17]；V06 — every command keeps global counts and item order consistent [passed; batch 13]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "concept",
        "ref": "OCON-edit-session"
      },
      "evidences": [
        {
          "id": "VEVD-OCON-edit-session-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "OCON-edit-session",
          "result": "fullfill",
          "note": "阅读当前源码，对照“编辑会话属于页面临时状态，引用目标待办身份，保存进入编辑前的标题和当前草稿；清单仍保留已提交内容。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OCON-edit-session-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                48,
                54,
                61,
                65,
                71,
                136,
                142
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/07.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/08.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/09.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/10.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/22.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OCON-edit-session",
          "result": "fullfill",
          "note": "实际执行：07 — completed title starts focused edit without mutating committed content [passed; batch 7]；08 — Enter then residual blur submits only once, trims and preserves identity/status [passed; batch 8]；08 — blur commits nonempty title [passed; batch 8]；09 — Escape with text, empty or whitespace restores original and suppresses blur [passed; batch 9]；10 — empty/space edit via Enter/blur removes only target and last deletion hides main [passed; batch 10]；22 — editing draft survives unrelated renders and never leaks into other saves [passed; batch 22]；22 — startup and invalid drafts never write; filtered saves retain hidden identities [passed; batch 22]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "concept",
        "ref": "OCON-filter-selection"
      },
      "evidences": [
        {
          "id": "VEVD-OCON-filter-selection-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            }
          ],
          "target_ref": "OCON-filter-selection",
          "result": "partial",
          "note": "阅读当前源码，对照“当前筛选是选择 All、Active、Completed 的展示状态，不是独立清单，也不是待办属性。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OCON-filter-selection-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                94,
                100,
                107,
                112,
                118,
                122
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                7
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/14.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/15.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/16.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/17.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            }
          ],
          "target_ref": "OCON-filter-selection",
          "result": "partial",
          "note": "实际执行：14 — switching views preserves full list and original relative order [passed; batch 14]；15 — mutations recompute current view without changing selected filter [passed; batch 15]；16 — Completed add stays hidden but increments full count; empty view keeps footer [passed; batch 16]；17 — global controls operate on invisible items [passed; batch 17]；18 — direct URL selects category and click changes address without losing data [passed; batch 18]；19 — external address changes update selection without creating extra navigation [passed; batch 19]；external history/address events publish selection without writing it back [passed; batch 19]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-OCON-filter-selection-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            }
          ],
          "target_ref": "OCON-filter-selection",
          "result": "partial",
          "note": "从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：从 All 点击 Active、Completed，再后退两次、前进两次；顺序为 Active:[A]、Completed:[B]、Active:[A]、All:[A,B]、Active:[A]、Completed:[B]。每步 hash、选中项和列表一致。"
      }
    },
    {
      "target": {
        "type": "concept",
        "ref": "OCON-commit-boundary"
      },
      "evidences": [
        {
          "id": "VEVD-OCON-commit-boundary-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            }
          ],
          "target_ref": "OCON-commit-boundary",
          "result": "fullfill",
          "note": "阅读当前源码，对照“保存由业务清单的有效变更驱动，保存目标是当前实现的完整已提交快照。”。目标正文对应的代码职责与所列测试断言一致。 已核对真实失败返回及初始化不写入；跨会话恢复策略未定义，保存保护限制单独列入 VFND-cross-session-save，不据此宣称数据连续性已验证。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OCON-commit-boundary-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                127,
                130,
                136,
                142
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
              "lines": [
                11
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
              "lines": [
                5
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53,
                80
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/20.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/22.execution.json"
            }
          ],
          "target_ref": "OCON-commit-boundary",
          "result": "fullfill",
          "note": "实际执行：20 — effective UI submission automatically saves in namespaced storage [passed; batch 20]；21 — editing, status and empty-title deletion update the same saved identity [passed; batch 21]；22 — editing draft survives unrelated renders and never leaks into other saves [passed; batch 22]；22 — startup and invalid drafts never write; filtered saves retain hidden identities [passed; batch 22]；all mutation paths save newest complete snapshot in order [passed; batch 21]；storage access and write exceptions return failure [passed; batch 20]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]；V22 — prior data survives startup and repeated guarded submissions [passed; batch 22]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 已核对真实失败返回及初始化不写入；跨会话恢复策略未定义，保存保护限制单独列入 VFND-cross-session-save，不据此宣称数据连续性已验证。"
      }
    },
    {
      "target": {
        "type": "concept",
        "ref": "OCON-plain-text"
      },
      "evidences": [
        {
          "id": "VEVD-OCON-plain-text-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            }
          ],
          "target_ref": "OCON-plain-text",
          "result": "fullfill",
          "note": "阅读当前源码，对照“标题在业务与保存中保持用户文本语义，页面通过文本呈现能力展示，不能把标题作为标记或执行内容。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OCON-plain-text-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                147
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                53
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "OCON-plain-text",
          "result": "fullfill",
          "note": "实际执行：23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]；V21 — UI edit and deletion variants persist exact committed snapshots [passed; batch 21]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "concept",
        "ref": "OCON-presentation"
      },
      "evidences": [
        {
          "id": "VEVD-OCON-presentation-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "OCON-presentation",
          "result": "partial",
          "note": "阅读当前源码，对照“页面模块统一维护布局与状态样式；视觉规则消费业务投影，不另建一套改变业务结果的状态。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-OCON-presentation-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                153,
                156,
                159,
                163
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/24.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/25.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/26.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/27.execution.json"
            }
          ],
          "target_ref": "OCON-presentation",
          "result": "partial",
          "note": "实际执行：24 — page retains one card and heading through empty/full transitions [passed; batch 24]；25 — long multiline and spaced titles remain readable content [passed; batch 25]；26 — editing class and controls switch coherently back to completed display [passed; batch 26]；27 — help/author/attribution remain outside hidden empty-list footer [passed; batch 27]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-OCON-presentation-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "OCON-presentation",
          "result": "partial",
          "note": "layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
      }
    },
    {
      "target": {
        "type": "decision",
        "ref": "ODEC-browser-boundary"
      },
      "evidences": [
        {
          "id": "VEVD-ODEC-browser-boundary-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/package.json"
            }
          ],
          "target_ref": "ODEC-browser-boundary",
          "result": "fullfill",
          "note": "阅读当前源码，对照“采用一个浏览器 Web App，按业务职责逐步引入内部模块；具体语言、框架及版本留给实现选择，不作为当前设计的前置条件。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-ODEC-browser-boundary-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                20
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/01.execution.json"
            }
          ],
          "target_ref": "ODEC-browser-boundary",
          "result": "fullfill",
          "note": "实际执行：01 — browser shell has todos title and one list region [passed; batch 1]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "decision",
        "ref": "ODEC-canonical-route"
      },
      "evidences": [
        {
          "id": "VEVD-ODEC-canonical-route-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "ODEC-canonical-route",
          "result": "fullfill",
          "note": "阅读当前源码，对照“本方案统一使用 #/、#/active、#/completed；导航层只把地址映射到 All、Active、Completed，由清单投影决定哪些待办可见。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-ODEC-canonical-route-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                118
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
              "lines": [
                5
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            }
          ],
          "target_ref": "ODEC-canonical-route",
          "result": "fullfill",
          "note": "实际执行：18 — direct URL selects category and click changes address without losing data [passed; batch 18]；canonical address mapping and unspecified default [passed; batch 18]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "decision",
        "ref": "ODEC-navigation-refresh"
      },
      "evidences": [
        {
          "id": "VEVD-ODEC-navigation-refresh-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "ODEC-navigation-refresh",
          "result": "partial",
          "note": "阅读当前源码，对照“页面启动从地址恢复筛选；本版不将刷新前待办恢复显示作为必须实现的路径。历史导航在同一页会话中不重置清单。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：分别直接访问并刷新 #/、#/active、#/completed，选中值为 All、Active、Completed；各次均显示空清单且 New todo 聚焦。此结果只证明筛选恢复，不证明待办恢复。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-ODEC-navigation-refresh-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                118,
                122
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/18.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/19.execution.json"
            }
          ],
          "target_ref": "ODEC-navigation-refresh",
          "result": "partial",
          "note": "实际执行：18 — direct URL selects category and click changes address without losing data [passed; batch 18]；19 — external address changes update selection without creating extra navigation [passed; batch 19]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-ODEC-navigation-refresh-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            }
          ],
          "target_ref": "ODEC-navigation-refresh",
          "result": "partial",
          "note": "分别直接访问并刷新 #/、#/active、#/completed，选中值为 All、Active、Completed；各次均显示空清单且 New todo 聚焦。此结果只证明筛选恢复，不证明待办恢复。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：分别直接访问并刷新 #/、#/active、#/completed，选中值为 All、Active、Completed；各次均显示空清单且 New todo 聚焦。此结果只证明筛选恢复，不证明待办恢复。"
      }
    },
    {
      "target": {
        "type": "decision",
        "ref": "ODEC-storage-adapter"
      },
      "evidences": [
        {
          "id": "VEVD-ODEC-storage-adapter-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/main.ts"
            }
          ],
          "target_ref": "ODEC-storage-adapter",
          "result": "fullfill",
          "note": "阅读当前源码，对照“有效清单变更由状态模块统一调用保存适配；适配实现遵守 localStorage 与 todos-[framework] 约束，实现名称由具体实现提供并保持一致，不固定框架和内部文件布局。”。目标正文对应的代码职责与所列测试断言一致。 已核对真实失败返回及初始化不写入；跨会话恢复策略未定义，保存保护限制单独列入 VFND-cross-session-save，不据此宣称数据连续性已验证。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-ODEC-storage-adapter-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                127
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
              "lines": [
                11
              ]
            },
            {
              "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
              "lines": [
                4
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/20.execution.json"
            },
            {
              "path": "design/stages/validation/example/workflow/batches/21.execution.json"
            }
          ],
          "target_ref": "ODEC-storage-adapter",
          "result": "fullfill",
          "note": "实际执行：20 — effective UI submission automatically saves in namespaced storage [passed; batch 20]；all mutation paths save newest complete snapshot in order [passed; batch 21]；save isolates implementation keys and construction never writes [passed; batch 20]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 已核对真实失败返回及初始化不写入；跨会话恢复策略未定义，保存保护限制单独列入 VFND-cross-session-save，不据此宣称数据连续性已验证。"
      }
    },
    {
      "target": {
        "type": "decision",
        "ref": "ODEC-no-startup-write"
      },
      "evidences": [
        {
          "id": "VEVD-ODEC-no-startup-write-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-state.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts"
            }
          ],
          "target_ref": "ODEC-no-startup-write",
          "result": "fullfill",
          "note": "阅读当前源码，对照“本版不要求刷新恢复待办显示；初始化只建立页面和地址筛选，不主动保存本页初始空清单。业务保存能力只由有效清单命令调用。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-ODEC-no-startup-write-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                136,
                142
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/validation.test.ts",
              "lines": [
                80
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/22.execution.json"
            }
          ],
          "target_ref": "ODEC-no-startup-write",
          "result": "fullfill",
          "note": "实际执行：22 — editing draft survives unrelated renders and never leaks into other saves [passed; batch 22]；22 — startup and invalid drafts never write; filtered saves retain hidden identities [passed; batch 22]；V22 — prior data survives startup and repeated guarded submissions [passed; batch 22]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "decision",
        "ref": "ODEC-text-rendering"
      },
      "evidences": [
        {
          "id": "VEVD-ODEC-text-rendering-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "ODEC-text-rendering",
          "result": "fullfill",
          "note": "阅读当前源码，对照“界面结构由实现定义，待办标题只填入文本内容或输入值；不把包含标记的标题拼接为可解释的页面结构。”。目标正文对应的代码职责与所列测试断言一致。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-ODEC-text-rendering-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                147
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/23.execution.json"
            }
          ],
          "target_ref": "ODEC-text-rendering",
          "result": "fullfill",
          "note": "实际执行：23 — markup remains literal text in creation, editing, DOM and storage [passed; batch 23]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。"
      }
    },
    {
      "target": {
        "type": "decision",
        "ref": "ODEC-presentation-owner"
      },
      "evidences": [
        {
          "id": "VEVD-ODEC-presentation-owner-code",
          "method": "code",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "ODEC-presentation-owner",
          "result": "partial",
          "note": "阅读当前源码，对照“页面模块维护统一布局和状态样式，具体 CSS 数值、组件拆分与文件布局留给 Implementation；视觉要求按 Specification 的可观察效果验收。”。目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。 代码阅读不单独证明布局、真实历史导航或交互运行结果。"
        },
        {
          "id": "VEVD-ODEC-presentation-owner-tests",
          "method": "test",
          "code_path": [
            {
              "path": "design/stages/implementation/example/todo/test/ui.test.ts",
              "lines": [
                153
              ]
            },
            {
              "path": "design/stages/validation/example/workflow/batches/24.execution.json"
            }
          ],
          "target_ref": "ODEC-presentation-owner",
          "result": "partial",
          "note": "实际执行：24 — page retains one card and heading through empty/full transitions [passed; batch 24]。逐条执行状态见 tests_checks；这里只证明这些断言覆盖的条件，DOM 模拟测试不能替代布局和真实历史导航观察，不以测试数量替代目标判断。"
        },
        {
          "id": "VEVD-ODEC-presentation-owner-runtime",
          "method": "runtime_observation",
          "code_path": [
            {
              "path": "design/stages/validation/example/workflow/browser.observations.json"
            },
            {
              "path": "design/stages/implementation/example/todo/src/ui.ts"
            },
            {
              "path": "design/stages/implementation/example/todo/src/styles.css"
            }
          ],
          "target_ref": "ODEC-presentation-owner",
          "result": "partial",
          "note": "layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
        }
      ],
      "result": {
        "status": "verified",
        "reason": "目标正文对应的代码职责与所列测试断言一致。 真实浏览器观察补充：layout: 桌面 CSS viewport=1100，scrollWidth=1100，白卡片 x=275、width=550，浅灰背景 rgb(245,245,245)。窄屏 viewport=320，scrollWidth=320，卡片 x=16、width=288；实测尺寸下无横向溢出。；heading: 桌面标题位于卡片上方居中，font-size=100px、font-weight=100、color=rgba(175,47,47,0.22)；截图确认层级明显。；rows: 长标题在 320px 宽度下换行；两行完成控件 x=28..58，标题 x=66..256，删除控件 x=256..296，均在卡片范围内且互不覆盖。white-space=pre-wrap；截图显示细灰分隔线。；footer: 桌面左计数 x=287，中筛选 x=471.390625，右清除 x=713.6640625。Clear completed 删除完成项并隐藏后，三者 x 与宽度保持相同；窄屏筛选移至第二行，页脚仍可用。；input: 新增框在卡片顶部且同宽；placeholder 计算样式为 italic；初始 New todo 聚焦，截图中有焦点边界，字号大于页脚。；completion: 勾选 Validation B 后显示绿色勾、浅灰标题及删除线，标题 color=rgb(217,217,217)、text-decoration-line=line-through；Validation A 勾选后又取消，恢复未完成。；edit: 双击 Validation A 后 Edit todo 预填并聚焦，border-style=solid，原 view 的 display=none；清空后 Escape 保留 Validation A。；delete: 指针位于 Validation A 行时截图出现行最右侧淡红叉；点击卡片页脚后读取删除按钮 visibility=hidden。CSS 固定删除占位，窄屏实测占位 x=256..296，无挤占标题。删除命令及两种完成状态由 V21 测试补充验证。；filter: All/Active/Completed 点击、历史导航后 DOM .selected 只有对应入口；桌面截图的 All 有细淡红边框，布局未因选择发生改变。；information: 当前作者显示 IntLoom；信息区 font-size=11px、color=rgb(153,153,153)、text-align=center，截图确认位于卡片外，空清单仍显示帮助及 Part of TodoMVC 链接。"
      }
    }
  ],
  "tests_checks": [
    {
      "test_code_ref": {
        "id": "VTCD-c9e581a325f4",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 20,
        "lineEnd": 22
      },
      "ttarget_refs": [
        "SREQ-display",
        "SACC-display-single-list",
        "SCON-consistent-behavior",
        "OSCN-launch",
        "ODEC-browser-boundary"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-58fbcd4d8794",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 23,
        "lineEnd": 27
      },
      "ttarget_refs": [
        "SREQ-create",
        "SACC-create-entry",
        "SACC-create-submit",
        "SACC-create-draft",
        "SACC-create-one-per-submit",
        "OSCN-launch",
        "OSCN-create"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-4481e40836b3",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 28,
        "lineEnd": 31
      },
      "ttarget_refs": [
        "SREQ-create",
        "SACC-create-submit",
        "SACC-create-trim",
        "SACC-create-blank",
        "SACC-create-duplicate",
        "OSCN-create",
        "OSCN-reject-create",
        "OCON-todo-state"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-37130bf9cfef",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 32,
        "lineEnd": 35
      },
      "ttarget_refs": [
        "SREQ-display",
        "SACC-display-order",
        "SACC-display-empty",
        "OCON-projection"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-286b82810649",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 36,
        "lineEnd": 41
      },
      "ttarget_refs": [
        "SREQ-display",
        "SACC-display-order",
        "SREQ-create",
        "SACC-create-duplicate",
        "SREQ-toggle",
        "SACC-toggle-complete",
        "SACC-toggle-reopen",
        "SACC-toggle-isolation",
        "OSCN-complete",
        "OSCN-reopen",
        "OCON-todo-state"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-744e67ba52cc",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 42,
        "lineEnd": 47
      },
      "ttarget_refs": [
        "SREQ-count",
        "SACC-count-wording",
        "SACC-count-visibility",
        "OSCN-complete",
        "OSCN-reopen",
        "OCON-projection"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-a3bd1dd31673",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 48,
        "lineEnd": 53
      },
      "ttarget_refs": [
        "SREQ-edit",
        "SACC-edit-enter",
        "SACC-edit-hide-controls",
        "OSCN-begin-edit",
        "OCON-edit-session"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-56b1444a3e7b",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 54,
        "lineEnd": 60
      },
      "ttarget_refs": [
        "SREQ-display",
        "SACC-display-order",
        "SREQ-edit",
        "SACC-edit-enter-submit",
        "SACC-edit-blur-submit",
        "SACC-edit-enter-then-blur",
        "OSCN-submit-edit",
        "OCON-todo-state",
        "OCON-edit-session"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-49816a37c56d",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 61,
        "lineEnd": 64
      },
      "ttarget_refs": [
        "SREQ-display",
        "SACC-display-order",
        "SREQ-edit",
        "SACC-edit-enter-submit",
        "SACC-edit-blur-submit",
        "SACC-edit-enter-then-blur",
        "OSCN-submit-edit",
        "OCON-todo-state",
        "OCON-edit-session"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-9e5b399de279",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 65,
        "lineEnd": 70
      },
      "ttarget_refs": [
        "SREQ-edit",
        "SACC-edit-escape",
        "SACC-edit-escape-blank",
        "OSCN-cancel-edit",
        "OCON-edit-session"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-e213e8b06b86",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 71,
        "lineEnd": 78
      },
      "ttarget_refs": [
        "SREQ-display",
        "SACC-display-empty",
        "SREQ-count",
        "SACC-count-visibility",
        "SREQ-edit",
        "SACC-edit-delete-blank",
        "SACC-edit-delete-updates",
        "SREQ-delete",
        "SACC-delete-updates",
        "OSCN-delete-by-edit",
        "OCON-todo-state",
        "OCON-edit-session"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-622b38a5c370",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 79,
        "lineEnd": 81
      },
      "ttarget_refs": [
        "SREQ-create",
        "SACC-create-duplicate",
        "SREQ-delete",
        "SACC-delete-hover",
        "SACC-delete-updates",
        "OSCN-delete",
        "OCON-todo-state"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-bbb24c70536b",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 82,
        "lineEnd": 87
      },
      "ttarget_refs": [
        "SREQ-toggle-all",
        "SACC-toggle-all-complete",
        "SACC-toggle-all-reopen",
        "SACC-toggle-all-derived",
        "OSCN-complete-all",
        "OSCN-reopen-all",
        "OCON-todo-state",
        "OCON-projection"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-2aec14137289",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 88,
        "lineEnd": 93
      },
      "ttarget_refs": [
        "SREQ-display",
        "SACC-display-empty",
        "SREQ-count",
        "SACC-count-visibility",
        "SREQ-toggle-all",
        "SACC-toggle-all-empty-reset",
        "SREQ-clear-completed",
        "SACC-clear-completed-visibility",
        "SACC-clear-completed-remove",
        "SACC-clear-completed-after-clear",
        "OSCN-clear-completed",
        "OSCN-show-empty-information",
        "OCON-todo-state",
        "OCON-projection"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-bca269053867",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 94,
        "lineEnd": 99
      },
      "ttarget_refs": [
        "SREQ-filter",
        "SACC-filter-views",
        "SACC-filter-selection",
        "SACC-filter-unchanged",
        "SACC-filter-selected-style",
        "SREL-navigation-depends-filter",
        "OSCN-select-filter",
        "OCON-filter-selection"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-104318b4af57",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 100,
        "lineEnd": 106
      },
      "ttarget_refs": [
        "SREQ-edit",
        "SACC-edit-same-item-in-filter",
        "SREQ-filter",
        "SACC-filter-complete-in-active",
        "SACC-filter-reopen-in-completed",
        "SACC-filter-mutation-sync",
        "OSCN-submit-edit",
        "OSCN-complete-in-active",
        "OSCN-reopen-in-completed",
        "OCON-filter-selection"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-b725c65458ab",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 107,
        "lineEnd": 111
      },
      "ttarget_refs": [
        "SREQ-display",
        "SACC-display-empty-filter",
        "SREQ-create",
        "SACC-create-in-completed",
        "SREQ-filter",
        "SACC-filter-mutation-sync",
        "OSCN-create",
        "OSCN-create-in-completed",
        "OCON-projection",
        "OCON-filter-selection"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-d2ddc1308d68",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 112,
        "lineEnd": 117
      },
      "ttarget_refs": [
        "SREQ-display",
        "SACC-display-empty-filter",
        "SREQ-count",
        "SACC-count-global",
        "SREQ-edit",
        "SACC-edit-delete-updates",
        "SREQ-toggle-all",
        "SACC-toggle-all-global",
        "SREQ-clear-completed",
        "SACC-clear-completed-global",
        "SREQ-filter",
        "SACC-filter-mutation-sync",
        "OSCN-delete-by-edit",
        "OSCN-complete-all",
        "OSCN-reopen-all",
        "OSCN-clear-completed",
        "OSCN-clear-hidden-completed",
        "OCON-projection",
        "OCON-filter-selection"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-a162783b5622",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 118,
        "lineEnd": 121
      },
      "ttarget_refs": [
        "SREQ-navigation",
        "SACC-navigation-default-direct",
        "SACC-navigation-click",
        "SACC-navigation-route-consistency",
        "SACC-navigation-refresh",
        "SREL-navigation-depends-filter",
        "OSCN-launch",
        "OSCN-select-filter",
        "OCON-filter-selection",
        "ODEC-canonical-route",
        "ODEC-navigation-refresh"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-34a3984e6883",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 122,
        "lineEnd": 126
      },
      "ttarget_refs": [
        "SREQ-navigation",
        "SACC-navigation-history",
        "SREL-navigation-depends-filter",
        "OSCN-history-back",
        "OSCN-history-forward",
        "OCON-filter-selection",
        "ODEC-navigation-refresh"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-206582f9b6c0",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 127,
        "lineEnd": 129
      },
      "ttarget_refs": [
        "SREQ-persist",
        "SACC-persist-automatic",
        "SACC-persist-create",
        "SCON-local-storage",
        "OSCN-create",
        "OCON-commit-boundary",
        "ODEC-storage-adapter"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-43ee41c30b41",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 130,
        "lineEnd": 135
      },
      "ttarget_refs": [
        "SREQ-persist",
        "SACC-persist-edit",
        "SACC-persist-completion",
        "OSCN-complete",
        "OSCN-reopen",
        "OSCN-complete-in-active",
        "OSCN-reopen-in-completed",
        "OCON-commit-boundary"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-a176c4759cdf",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 136,
        "lineEnd": 141
      },
      "ttarget_refs": [
        "SREQ-persist",
        "SACC-persist-full-list",
        "SACC-persist-exclude-drafts",
        "SACC-persist-cancel",
        "SACC-persist-no-restore-no-clear",
        "OSCN-reject-create",
        "OSCN-cancel-edit",
        "OSCN-create-in-completed",
        "OCON-edit-session",
        "OCON-commit-boundary",
        "ODEC-no-startup-write"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-e7256081bd8c",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 142,
        "lineEnd": 146
      },
      "ttarget_refs": [
        "SREQ-persist",
        "SACC-persist-full-list",
        "SACC-persist-exclude-drafts",
        "SACC-persist-cancel",
        "SACC-persist-no-restore-no-clear",
        "OSCN-reject-create",
        "OSCN-cancel-edit",
        "OSCN-create-in-completed",
        "OCON-edit-session",
        "OCON-commit-boundary",
        "ODEC-no-startup-write"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-5afe604c64ae",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 147,
        "lineEnd": 152
      },
      "ttarget_refs": [
        "SREQ-display",
        "SACC-display-plain-text",
        "SREQ-create",
        "SACC-create-plain-text",
        "SREQ-edit",
        "SACC-edit-plain-text",
        "SREQ-persist",
        "SACC-persist-plain-text",
        "SCON-plain-text",
        "OCON-plain-text",
        "ODEC-text-rendering"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-1e8e410f236a",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 153,
        "lineEnd": 155
      },
      "ttarget_refs": [
        "SREQ-display",
        "SACC-display-layout",
        "SACC-display-heading-style",
        "SCON-visual-layout",
        "OCON-presentation",
        "ODEC-presentation-owner"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-3fd743bbdb6a",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 156,
        "lineEnd": 158
      },
      "ttarget_refs": [
        "SREQ-display",
        "SACC-display-row-style",
        "SREQ-create",
        "SACC-create-input-style",
        "SCON-visual-layout",
        "OCON-presentation"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-34523fe2f0e0",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 159,
        "lineEnd": 162
      },
      "ttarget_refs": [
        "SREQ-toggle",
        "SACC-toggle-state-style",
        "SREQ-edit",
        "SACC-edit-hide-controls",
        "SACC-edit-input-style",
        "SREQ-delete",
        "SACC-delete-button-style",
        "SCON-visual-layout",
        "OSCN-begin-edit",
        "OCON-presentation"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-df26214ee8d3",
        "path": "design/stages/implementation/example/todo/test/ui.test.ts",
        "lineStart": 163,
        "lineEnd": 167
      },
      "ttarget_refs": [
        "SREQ-display",
        "SACC-display-footer-style",
        "SREQ-information",
        "SACC-information-content",
        "SACC-information-style",
        "SACC-information-empty",
        "SCON-consistent-behavior",
        "SCON-visual-layout",
        "OSCN-launch",
        "OSCN-show-empty-information",
        "OCON-presentation"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-fddf1bbdb0ec",
        "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
        "lineStart": 3,
        "lineEnd": 3
      },
      "ttarget_refs": [
        "OCON-todo-state"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-0e7b4ef52bec",
        "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
        "lineStart": 4,
        "lineEnd": 4
      },
      "ttarget_refs": [
        "OCON-todo-state"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-0de3c2fd4371",
        "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
        "lineStart": 5,
        "lineEnd": 5
      },
      "ttarget_refs": [
        "OCON-todo-state"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-a6613dff253c",
        "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
        "lineStart": 6,
        "lineEnd": 6
      },
      "ttarget_refs": [
        "OCON-todo-state"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-4b209dff456b",
        "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
        "lineStart": 7,
        "lineEnd": 7
      },
      "ttarget_refs": [
        "OCON-todo-state"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-4701cd09e318",
        "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
        "lineStart": 8,
        "lineEnd": 8
      },
      "ttarget_refs": [
        "OCON-todo-state"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-2373a34f1d58",
        "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
        "lineStart": 9,
        "lineEnd": 9
      },
      "ttarget_refs": [
        "OCON-todo-state"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-1bf4a02d9fd7",
        "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
        "lineStart": 10,
        "lineEnd": 10
      },
      "ttarget_refs": [
        "OCON-todo-state"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-1120e0ce25f5",
        "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
        "lineStart": 11,
        "lineEnd": 14
      },
      "ttarget_refs": [
        "SREQ-persist",
        "SACC-persist-automatic",
        "SACC-persist-create",
        "SACC-persist-completion",
        "SACC-persist-delete",
        "OSCN-complete-all",
        "OSCN-reopen-all",
        "OSCN-clear-completed",
        "OSCN-clear-hidden-completed",
        "OCON-commit-boundary",
        "ODEC-storage-adapter"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-f33d1938a3a2",
        "path": "design/stages/implementation/example/todo/test/todo-state.test.ts",
        "lineStart": 15,
        "lineEnd": 15
      },
      "ttarget_refs": [
        "OCON-todo-state"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-bfc75f07444d",
        "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
        "lineStart": 5,
        "lineEnd": 5
      },
      "ttarget_refs": [
        "SREQ-navigation",
        "SACC-navigation-default-direct",
        "SACC-navigation-route-consistency",
        "SACC-navigation-refresh",
        "SREL-navigation-depends-filter",
        "ODEC-canonical-route"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-d82136c50476",
        "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
        "lineStart": 6,
        "lineEnd": 6
      },
      "ttarget_refs": [
        "OCON-filter-selection"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-a381bd72a6ad",
        "path": "design/stages/implementation/example/todo/test/filter-router.test.ts",
        "lineStart": 7,
        "lineEnd": 7
      },
      "ttarget_refs": [
        "SREQ-navigation",
        "SACC-navigation-history",
        "OSCN-history-back",
        "OSCN-history-forward",
        "OCON-filter-selection"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-2220cd185989",
        "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
        "lineStart": 4,
        "lineEnd": 4
      },
      "ttarget_refs": [
        "SREQ-persist",
        "SACC-persist-isolation",
        "SCON-local-storage",
        "ODEC-storage-adapter"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-39947b1b9be8",
        "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
        "lineStart": 5,
        "lineEnd": 5
      },
      "ttarget_refs": [
        "OCON-commit-boundary"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-ad54168612b5",
        "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
        "lineStart": 6,
        "lineEnd": 6
      },
      "ttarget_refs": [
        "SREQ-persist",
        "SACC-persist-create",
        "SACC-persist-exclude-drafts"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-e543d0912ca1",
        "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
        "lineStart": 7,
        "lineEnd": 7
      },
      "ttarget_refs": [
        "OCON-commit-boundary"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-6320b89ad2bf",
        "path": "design/stages/implementation/example/todo/test/todo-persistence.test.ts",
        "lineStart": 8,
        "lineEnd": 8
      },
      "ttarget_refs": [
        "OCON-commit-boundary"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-5ee628e731e0",
        "path": "design/stages/validation/example/workflow/validation.test.ts",
        "lineStart": 27,
        "lineEnd": 33
      },
      "ttarget_refs": [
        "SREQ-toggle"
      ],
      "status": "failed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-522ca19f5002",
        "path": "design/stages/validation/example/workflow/validation.test.ts",
        "lineStart": 35,
        "lineEnd": 51
      },
      "ttarget_refs": [
        "SREQ-display",
        "SACC-display-order",
        "SREQ-toggle",
        "SACC-toggle-isolation",
        "SREQ-count",
        "SACC-count-updates",
        "SACC-count-global",
        "SREQ-delete",
        "SACC-delete-updates",
        "SREQ-toggle-all",
        "SACC-toggle-all-complete",
        "SREQ-clear-completed",
        "SACC-clear-completed-remove",
        "OCON-projection"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-65652fda2ff7",
        "path": "design/stages/validation/example/workflow/validation.test.ts",
        "lineStart": 53,
        "lineEnd": 78
      },
      "ttarget_refs": [
        "SREQ-create",
        "SACC-create-duplicate",
        "SREQ-edit",
        "SACC-edit-enter",
        "SACC-edit-enter-submit",
        "SACC-edit-blur-submit",
        "SACC-edit-enter-then-blur",
        "SACC-edit-escape",
        "SACC-edit-escape-blank",
        "SACC-edit-delete-blank",
        "SACC-edit-delete-updates",
        "SACC-edit-same-item-in-filter",
        "SACC-edit-plain-text",
        "SREQ-delete",
        "SACC-delete-either-state",
        "SACC-delete-updates",
        "SREQ-filter",
        "SACC-filter-mutation-sync",
        "SREQ-persist",
        "SACC-persist-edit",
        "SACC-persist-delete",
        "SACC-persist-cancel",
        "OSCN-begin-edit",
        "OSCN-submit-edit",
        "OSCN-cancel-edit",
        "OSCN-delete-by-edit",
        "OSCN-delete",
        "OCON-edit-session",
        "OCON-commit-boundary",
        "OCON-plain-text"
      ],
      "status": "passed"
    },
    {
      "test_code_ref": {
        "id": "VTCD-d47ce5032f68",
        "path": "design/stages/validation/example/workflow/validation.test.ts",
        "lineStart": 80,
        "lineEnd": 89
      },
      "ttarget_refs": [
        "SREQ-persist",
        "SACC-persist-no-restore-no-clear",
        "SCON-local-storage",
        "OSCN-launch",
        "OCON-commit-boundary",
        "ODEC-no-startup-write"
      ],
      "status": "passed"
    }
  ],
  "code_issues": [
    {
      "code_paths": [
        {
          "path": "design/stages/implementation/example/todo/src/ui.ts",
          "lines": [
            35,
            36,
            37
          ]
        },
        {
          "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts",
          "lines": [
            9,
            10,
            11
          ]
        }
      ],
      "reason": "重复逻辑：筛选到 hash 的编码在链接生成与导航选择中重复。当前一致，但未来变更需要双点维护。",
      "needRefactor": true
    },
    {
      "code_paths": [
        {
          "path": "design/stages/implementation/example/todo/src/styles.css",
          "lines": [
            3,
            6,
            8,
            10,
            14,
            16,
            25,
            31,
            34,
            42
          ]
        }
      ],
      "reason": "无效/重复样式声明：body 的旧 margin/font-family、view 的旧 gap、edit 的旧 width 被后续规则覆盖，完成删除线重复，旧 selected outline 被置为 none；只指出这些声明，未把整个规则块或文件判为死代码。",
      "needRefactor": true
    }
  ],
  "results": {
    "specification": [
      {
        "type": "requirement",
        "total_count": 12,
        "verified_count": 11,
        "partial_count": 1,
        "undone_count": 0,
        "failed_count": 0
      },
      {
        "type": "constraint",
        "total_count": 4,
        "verified_count": 2,
        "partial_count": 2,
        "undone_count": 0,
        "failed_count": 0
      },
      {
        "type": "relation",
        "total_count": 1,
        "verified_count": 1,
        "partial_count": 0,
        "undone_count": 0,
        "failed_count": 0
      },
      {
        "type": "acceptance",
        "total_count": 78,
        "verified_count": 77,
        "partial_count": 1,
        "undone_count": 0,
        "failed_count": 0
      }
    ],
    "solution_module": {
      "type": "scenario",
      "total_count": 21,
      "verified_count": 21,
      "partial_count": 0,
      "undone_count": 0,
      "failed_count": 0
    }
  },
  "findings": [
    {
      "id": "VFND-keyboard-focus",
      "status": "confirmed",
      "description": "完成切换会替换非编辑行内部节点，原聚焦 checkbox 被移除；V05 附加质量测试失败，最终真实浏览器 Space 操作也使焦点落回 BODY。",
      "impact": "中断连续键盘操作。该焦点连续性是附加质量检查，原 Specification 没有明确对应验收条款，因此不据此伪造 SACC-toggle 的失败。",
      "locations": [
        {
          "path": "design/stages/implementation/example/todo/src/ui.ts",
          "lineStart": 80,
          "lineEnd": 93
        },
        {
          "path": "design/stages/validation/example/workflow/validation.test.ts",
          "lineStart": 27,
          "lineEnd": 33
        }
      ],
      "severity_level": "high"
    },
    {
      "id": "VFND-route-encoding-duplication",
      "status": "confirmed",
      "description": "UI 创建筛选链接和 Router.select 各自维护相同的筛选到 hash 映射。当前地址结果一致，但规则修改需要同步两处。",
      "impact": "增加导航规则修改成本；关联 OMOD-router/ODEC-canonical-route 的维护风险，当前三条合法路由仍通过验收。",
      "locations": [
        {
          "path": "design/stages/implementation/example/todo/src/ui.ts",
          "lineStart": 35,
          "lineEnd": 38
        },
        {
          "path": "design/stages/implementation/example/todo/src/modules/filter-router.ts",
          "lineStart": 9,
          "lineEnd": 12
        }
      ],
      "severity_level": "medium"
    },
    {
      "id": "VFND-cross-session-save",
      "status": "confirmed",
      "description": "同名存储键已有非空旧清单时，新页面连续两次有效新增均返回 previous-session，当前页新增结果一直未写入，界面只有未保存提示。",
      "impact": "保留旧数据但阻断该页面后续保存。行为已由 V22 复现；恢复、合并或替换哪个策略才正确仍由 ORISK-post-refresh-write-policy 保留为需求边界，相关自动保存检查为 partial。",
      "locations": [
        {
          "path": "design/stages/implementation/example/todo/src/modules/todo-persistence.ts",
          "lineStart": 14,
          "lineEnd": 20
        },
        {
          "path": "design/stages/implementation/example/todo/src/ui.ts",
          "lineStart": 95,
          "lineEnd": 96
        }
      ],
      "severity_level": "high"
    },
    {
      "id": "VFND-overridden-style-rules",
      "status": "confirmed",
      "description": "样式文件保留逐轮覆盖声明，例如早期 body margin/font-family、view gap、edit width、completed title 和 selected outline 的部分声明随后被覆盖或重复。",
      "impact": "局部可读性问题，需结合前后规则判断最终效果；未发现由这些覆盖直接造成的视觉验收失败。",
      "locations": [
        {
          "path": "design/stages/implementation/example/todo/src/styles.css",
          "lineStart": 3,
          "lineEnd": 18
        },
        {
          "path": "design/stages/implementation/example/todo/src/styles.css",
          "lineStart": 25,
          "lineEnd": 42
        }
      ],
      "severity_level": "low"
    }
  ]
} satisfies ValidationArtifact;
