/**
 * 依次应用 todo.record.ts 中 27 轮已模拟确认的变化后得到的完整 Specification Artifact。
 * 业务依据仅为 todo.intents.ts 的 todomvcIntents 及本轮问题对应的 knowledge。
 * record_refs 保留实际模拟轮次来源；没有待决问题，不包含刷新恢复显示或后续修改需求。
 */
import type { SpecificationArtifact } from '../artifact.js';

export const todoArtifact = {
  "domains": [
    {
      "id": "SDOM-todos",
      "responsibility": "管理一份待办清单：记录要做的事情，修改内容，标记完成，移除不再需要的事项，按完成状态查看清单，并保存已提交的数据。每条待办具有独立身份、标题和完成状态。",
      "status": "active"
    }
  ],
  "features": [
    {
      "id": "SFEA-display",
      "responsibility": "展示待办清单、空清单状态、未完成数量和必要的操作提示。",
      "status": "active",
      "domain_ref": "SDOM-todos"
    },
    {
      "id": "SFEA-create",
      "responsibility": "把用户输入的有效标题加入清单，形成新的未完成待办。",
      "status": "active",
      "domain_ref": "SDOM-todos"
    },
    {
      "id": "SFEA-completion",
      "responsibility": "切换单条或整份清单的完成状态，并一致呈现结果。",
      "status": "active",
      "domain_ref": "SDOM-todos"
    },
    {
      "id": "SFEA-edit",
      "responsibility": "就地修改待办标题，支持提交、取消，以及通过清空标题删除待办。",
      "status": "active",
      "domain_ref": "SDOM-todos"
    },
    {
      "id": "SFEA-remove",
      "responsibility": "删除指定待办，或一次清除全部已完成待办。",
      "status": "active",
      "domain_ref": "SDOM-todos"
    },
    {
      "id": "SFEA-filter",
      "responsibility": "按待办完成状态查看同一份清单，并通过地址、浏览器前进后退和刷新表达当前筛选。",
      "status": "active",
      "domain_ref": "SDOM-todos"
    },
    {
      "id": "SFEA-persistence",
      "responsibility": "自动持久化待办的已提交内容、完成状态和删除结果。",
      "status": "active",
      "domain_ref": "SDOM-todos"
    }
  ],
  "requirements": [
    {
      "id": "SREQ-display",
      "status": "active",
      "description": "浏览器页面提供一份待办清单，标题为 todos，新增入口始终可用。按加入顺序展示待办，修改标题或完成状态不改变位置。完整清单为空时隐藏清单主体（含全选控件）与操作页脚；加入第一条后显示，删除最后一条后重新隐藏。 当前筛选无匹配项但完整清单非空时，仅待办列表为空，主体、全选和操作页脚仍按非空清单显示，可继续切换筛选。",
      "acceptances": [
        {
          "id": "SACC-display-single-list",
          "requirement_ref": "SREQ-display",
          "description": "打开应用时呈现单清单待办页面，标题显示 todos。"
        },
        {
          "id": "SACC-display-order",
          "requirement_ref": "SREQ-display",
          "description": "按顺序新增 A、B、C，清单依次显示 A、B、C；修改 B 的标题或完成状态后，B 仍位于第二条。"
        },
        {
          "id": "SACC-display-empty",
          "requirement_ref": "SREQ-display",
          "description": "完整清单为空时，标题和新增框可见，清单主体、全选和操作页脚隐藏；新增第一条后显示，删除最后一条后重新隐藏。"
        },
        {
          "id": "SACC-display-empty-filter",
          "requirement_ref": "SREQ-display",
          "description": "完整清单有待办但当前筛选没有匹配项时，列表为空，新增入口、全选、未完成数字及筛选按钮仍可用，可切回有内容的分类。"
        },
        {
          "id": "SACC-display-plain-text",
          "requirement_ref": "SREQ-display",
          "description": "标题“<b>买牛奶</b>”在列表中原样显示，不产生加粗效果；标题中的可执行内容不得执行。"
        },
        {
          "id": "SACC-display-layout",
          "requirement_ref": "SREQ-display",
          "description": "桌面显示浅灰背景上的居中单列白色待办卡片，卡片不铺满屏幕；窄屏下内容随宽度收缩且不出现横向滚动。"
        },
        {
          "id": "SACC-display-heading-style",
          "requirement_ref": "SREQ-display",
          "description": "todos 位于卡片上方居中，字形细、颜色淡红，字号明显大于输入框和清单文字。"
        },
        {
          "id": "SACC-display-row-style",
          "requirement_ref": "SREQ-display",
          "description": "每条待办单独占一行，保持舒适一致的间距并用细灰线分隔；长标题可换行，不遮挡左右两侧操作控件。"
        },
        {
          "id": "SACC-display-footer-style",
          "requirement_ref": "SREQ-display",
          "description": "操作页脚紧凑排列：左侧为剩余数量，中间为 All、Active、Completed，右侧按需显示 Clear completed；切换筛选或按钮显隐时整排不明显跳动。"
        }
      ],
      "feature_ref": "SFEA-display",
      "record_refs": [
        "RUN-todomvc-spec-01",
        "RUN-todomvc-spec-04",
        "RUN-todomvc-spec-16",
        "RUN-todomvc-spec-23",
        "RUN-todomvc-spec-24",
        "RUN-todomvc-spec-25",
        "RUN-todomvc-spec-27"
      ]
    },
    {
      "id": "SREQ-create",
      "status": "active",
      "description": "页面顶部提供提示为 What needs to be done? 的新增输入框，加载后获得焦点；按 Enter 将去除首尾空白后的非空标题作为一条具有独立身份的未完成待办追加到末尾，成功后清空输入。保留中间空格，允许同名待办；空输入、纯空白或未按 Enter 的输入不创建待办。",
      "acceptances": [
        {
          "id": "SACC-create-entry",
          "requirement_ref": "SREQ-create",
          "description": "页面顶部新增输入框显示 What needs to be done?，加载页面后可直接输入。"
        },
        {
          "id": "SACC-create-submit",
          "requirement_ref": "SREQ-create",
          "description": "输入“买牛奶”按 Enter，末尾新增标题为“买牛奶”的未完成待办，新增框清空并可继续输入下一条。"
        },
        {
          "id": "SACC-create-draft",
          "requirement_ref": "SREQ-create",
          "description": "只在新增框输入文字而不按 Enter，清单不增加待办。"
        },
        {
          "id": "SACC-create-trim",
          "requirement_ref": "SREQ-create",
          "description": "输入“  买  牛奶  ”按 Enter，仅新增标题为“买  牛奶”的待办，首尾空白去除且中间空格保留。"
        },
        {
          "id": "SACC-create-blank",
          "requirement_ref": "SREQ-create",
          "description": "空输入或纯空白按 Enter 均不创建待办，清单数量保持不变。"
        },
        {
          "id": "SACC-create-duplicate",
          "requirement_ref": "SREQ-create",
          "description": "连续两次提交相同标题，得到两条独立待办；之后修改、完成或删除其中一条时，另一条保持不变。"
        },
        {
          "id": "SACC-create-one-per-submit",
          "requirement_ref": "SREQ-create",
          "description": "连续提交有效标题时，每次 Enter 只增加一条，并按提交先后追加到清单末尾。"
        },
        {
          "id": "SACC-create-in-completed",
          "requirement_ref": "SREQ-create",
          "description": "在 Completed 提交有效标题，新待办以未完成状态加入完整清单末尾，当前不可见但未完成数量加一，筛选保持 Completed；切换到 Active 或 All 后可见。"
        },
        {
          "id": "SACC-create-plain-text",
          "requirement_ref": "SREQ-create",
          "description": "新增标题“<b>买牛奶</b>”后保留该文字本身，只执行规定的首尾空白处理，不解释为页面标记或可执行内容。"
        },
        {
          "id": "SACC-create-input-style",
          "requirement_ref": "SREQ-create",
          "description": "新增框位于白色卡片最上方，与清单等宽，输入文字较大，What needs to be done? 使用浅灰斜体，获得焦点时有可见输入状态。"
        }
      ],
      "feature_ref": "SFEA-create",
      "record_refs": [
        "RUN-todomvc-spec-02",
        "RUN-todomvc-spec-03",
        "RUN-todomvc-spec-04",
        "RUN-todomvc-spec-16",
        "RUN-todomvc-spec-23",
        "RUN-todomvc-spec-25"
      ]
    },
    {
      "id": "SREQ-toggle",
      "status": "active",
      "description": "每条非编辑状态的待办提供完成控件，可在未完成与已完成之间切换；已完成标题显示删除线。操作立即更新界面，不改变该条的身份、标题、位置或其他待办。",
      "acceptances": [
        {
          "id": "SACC-toggle-complete",
          "requirement_ref": "SREQ-toggle",
          "description": "勾选未完成待办后立即显示选中状态和标题删除线，无需刷新。"
        },
        {
          "id": "SACC-toggle-reopen",
          "requirement_ref": "SREQ-toggle",
          "description": "取消勾选已完成待办后立即恢复未完成状态并去除删除线。"
        },
        {
          "id": "SACC-toggle-isolation",
          "requirement_ref": "SREQ-toggle",
          "description": "切换一条待办完成状态时，其身份、标题和位置不变，其他条目保持不变。"
        },
        {
          "id": "SACC-toggle-state-style",
          "requirement_ref": "SREQ-toggle",
          "description": "未完成时左侧为圆形完成控件、标题为清晰深色；完成后控件显示绿色勾，标题变为浅灰色并显示删除线，取消完成后恢复未完成样式。"
        }
      ],
      "feature_ref": "SFEA-completion",
      "record_refs": [
        "RUN-todomvc-spec-05",
        "RUN-todomvc-spec-26"
      ]
    },
    {
      "id": "SREQ-count",
      "status": "active",
      "description": "操作页脚始终显示完整清单中未完成待办数量，与当前筛选可见数量无关；数字加粗，1 时显示 1 item left，其余显示 N items left。新增、完成、重新打开或删除时更新，单纯改名不变；非空清单全部完成时显示零，完整清单为空时随页脚隐藏。",
      "acceptances": [
        {
          "id": "SACC-count-wording",
          "requirement_ref": "SREQ-count",
          "description": "清单非空时，未完成数量为 0、1、2，分别显示 0 items left、1 item left、2 items left，数字加粗。"
        },
        {
          "id": "SACC-count-updates",
          "requirement_ref": "SREQ-count",
          "description": "新增未完成待办或重新打开一条时数量加一；完成或删除一条未完成待办时减一；删除已完成待办、单纯改名不改变数量。"
        },
        {
          "id": "SACC-count-visibility",
          "requirement_ref": "SREQ-count",
          "description": "全部待办已完成但未删除时仍显示 0 items left；删除最后一条后计数随页脚隐藏。"
        },
        {
          "id": "SACC-count-global",
          "requirement_ref": "SREQ-count",
          "description": "完整清单有两条未完成和一条已完成时，All、Active、Completed 均显示 2 items left，切换筛选不改变计数。"
        }
      ],
      "feature_ref": "SFEA-display",
      "record_refs": [
        "RUN-todomvc-spec-06",
        "RUN-todomvc-spec-17"
      ]
    },
    {
      "id": "SREQ-edit",
      "status": "active",
      "description": "双击任意完成状态的待办标题可就地编辑，预填已提交标题并获得焦点，隐藏该条原标题及完成、删除控件。Enter 或失焦提交时去除首尾空白、保留中间空格：非空则保存到同一待办，保持完成状态和位置；为空则删除该条并更新相关数量、控件与空状态。Escape 取消并恢复原已提交标题，即使草稿为空或纯空白也保留原待办。Enter 提交或 Escape 取消后的失焦不得重复处理、保存已取消草稿或误删。",
      "acceptances": [
        {
          "id": "SACC-edit-enter",
          "requirement_ref": "SREQ-edit",
          "description": "分别双击未完成和已完成待办的标题，均在原位置出现预填当前已提交标题且已获得焦点的编辑框。"
        },
        {
          "id": "SACC-edit-hide-controls",
          "requirement_ref": "SREQ-edit",
          "description": "编辑期间，该条原有标题、完成控件和删除控件隐藏，其他待办保持不变。"
        },
        {
          "id": "SACC-edit-enter-submit",
          "requirement_ref": "SREQ-edit",
          "description": "把标题改为“  买  面包  ”按 Enter，保存为“买  面包”并退出编辑，仍为原待办，身份、完成状态和位置不变。"
        },
        {
          "id": "SACC-edit-blur-submit",
          "requirement_ref": "SREQ-edit",
          "description": "输入非空新标题后让编辑框失焦，按同样的首尾空白规则保存并退出编辑，身份、完成状态和位置不变。"
        },
        {
          "id": "SACC-edit-enter-then-blur",
          "requirement_ref": "SREQ-edit",
          "description": "Enter 提交非空新标题后再触发失焦，待办只提交一次，保留新标题，不重复处理或误删。"
        },
        {
          "id": "SACC-edit-escape",
          "requirement_ref": "SREQ-edit",
          "description": "输入新标题后按 Escape，退出编辑并恢复编辑前标题；随后失焦不提交已取消的草稿。"
        },
        {
          "id": "SACC-edit-escape-blank",
          "requirement_ref": "SREQ-edit",
          "description": "将编辑草稿清空或改成纯空白后按 Escape，原待办和原标题保留；随后失焦也不保存或删除。"
        },
        {
          "id": "SACC-edit-delete-blank",
          "requirement_ref": "SREQ-edit",
          "description": "分别将标题清空或改为纯空白，再分别通过 Enter 或失焦提交，均删除被编辑的那条，其他待办的内容、状态和顺序不变。"
        },
        {
          "id": "SACC-edit-delete-updates",
          "requirement_ref": "SREQ-edit",
          "description": "空标题提交删除后，未完成计数、当前筛选结果、全选状态、Clear completed 和空清单展示按剩余完整清单更新，筛选选择保持不变；Enter 删除后继续失焦不重复删除。"
        },
        {
          "id": "SACC-edit-same-item-in-filter",
          "requirement_ref": "SREQ-edit",
          "description": "在 Active 或 Completed 编辑可见待办并提交非空标题，修改作用于原待办；切换到 All 后看到相同的新标题、完成状态和位置。"
        },
        {
          "id": "SACC-edit-plain-text",
          "requirement_ref": "SREQ-edit",
          "description": "通过 Enter 或失焦把标题改为包含页面标记的文字时，只执行规定的首尾空白处理，保留文字本身，不解释或执行其中内容。"
        },
        {
          "id": "SACC-edit-input-style",
          "requirement_ref": "SREQ-edit",
          "description": "双击后编辑框在原标题位置替换展示内容，尺寸与该行协调，边框清晰且焦点状态明显。"
        }
      ],
      "feature_ref": "SFEA-edit",
      "record_refs": [
        "RUN-todomvc-spec-07",
        "RUN-todomvc-spec-08",
        "RUN-todomvc-spec-09",
        "RUN-todomvc-spec-10",
        "RUN-todomvc-spec-15",
        "RUN-todomvc-spec-17",
        "RUN-todomvc-spec-23",
        "RUN-todomvc-spec-26"
      ]
    },
    {
      "id": "SREQ-delete",
      "status": "active",
      "description": "非编辑状态的待办在指针悬停时显示删除按钮，平时隐藏；点击即删除该条，无论其是否完成。其余待办的身份、内容、状态和相对顺序不变，未完成计数、全选与清除按钮按剩余清单更新，删光后隐藏主体和操作页脚。",
      "acceptances": [
        {
          "id": "SACC-delete-hover",
          "requirement_ref": "SREQ-delete",
          "description": "非编辑条目未悬停时删除按钮隐藏，悬停时显示；点击后仅该条从清单移除。"
        },
        {
          "id": "SACC-delete-either-state",
          "requirement_ref": "SREQ-delete",
          "description": "未完成和已完成待办均可直接删除，其他待办身份、标题、状态和相对顺序不变。"
        },
        {
          "id": "SACC-delete-updates",
          "requirement_ref": "SREQ-delete",
          "description": "删除后未完成计数、全选与清除按钮和剩余清单一致；删除最后一条后隐藏清单主体和操作页脚。"
        },
        {
          "id": "SACC-delete-button-style",
          "requirement_ref": "SREQ-delete",
          "description": "删除按钮位于待办行最右侧，非悬停时隐藏，悬停时显示淡红叉号；显示或隐藏不挤动标题或其他控件。"
        }
      ],
      "feature_ref": "SFEA-remove",
      "record_refs": [
        "RUN-todomvc-spec-11",
        "RUN-todomvc-spec-26"
      ]
    },
    {
      "id": "SREQ-toggle-all",
      "status": "active",
      "description": "全选控件将整份清单统一设为已完成或未完成，不改变待办身份、标题或顺序。清单非空且全部完成时才显示选中；逐条完成最后一条时自动选中，重新打开或新增未完成待办时取消选中。 操作范围包括当前筛选隐藏的待办，更新后重新匹配当前视图且不切换筛选。",
      "acceptances": [
        {
          "id": "SACC-toggle-all-complete",
          "requirement_ref": "SREQ-toggle-all",
          "description": "选中全选控件后，整份清单所有条目变为已完成，未完成数量为零，身份、标题和顺序不变。"
        },
        {
          "id": "SACC-toggle-all-reopen",
          "requirement_ref": "SREQ-toggle-all",
          "description": "取消全选后，整份清单所有条目变为未完成，未完成数量等于清单总数，身份、标题和顺序不变。"
        },
        {
          "id": "SACC-toggle-all-derived",
          "requirement_ref": "SREQ-toggle-all",
          "description": "存在未完成条目时全选未选中；逐条完成最后一条后自动选中，重新打开任意一条或新增一条后自动取消选中。"
        },
        {
          "id": "SACC-toggle-all-empty-reset",
          "requirement_ref": "SREQ-toggle-all",
          "description": "清除全部已完成待办使清单为空后，不残留可见的全选选中状态；再次新增未完成待办时全选未选中。"
        },
        {
          "id": "SACC-toggle-all-global",
          "requirement_ref": "SREQ-toggle-all",
          "description": "在 Active 或 Completed 中执行全选或全部取消，隐藏条目也一并更新；当前筛选保持不变，可见条目按结果重新匹配。"
        }
      ],
      "feature_ref": "SFEA-completion",
      "record_refs": [
        "RUN-todomvc-spec-12",
        "RUN-todomvc-spec-13",
        "RUN-todomvc-spec-17"
      ]
    },
    {
      "id": "SREQ-clear-completed",
      "status": "active",
      "description": "完整清单存在已完成待办时显示 Clear completed；点击删除所有已完成待办，保留未完成待办的身份、标题、状态和相对顺序，未完成计数不变。清除后按钮隐藏，有剩余待办则主体和页脚保留，清单为空则隐藏。 显示条件和删除范围均包含当前筛选隐藏的已完成待办。",
      "acceptances": [
        {
          "id": "SACC-clear-completed-visibility",
          "requirement_ref": "SREQ-clear-completed",
          "description": "有至少一条已完成待办时显示 Clear completed，没有已完成待办时隐藏。"
        },
        {
          "id": "SACC-clear-completed-remove",
          "requirement_ref": "SREQ-clear-completed",
          "description": "点击 Clear completed，所有已完成待办删除，未完成待办的身份、标题、状态和相对顺序不变，未完成数量不变。"
        },
        {
          "id": "SACC-clear-completed-after-clear",
          "requirement_ref": "SREQ-clear-completed",
          "description": "清除后按钮隐藏；若仍有未完成待办则继续显示主体和页脚，若删光则进入空清单状态。"
        },
        {
          "id": "SACC-clear-completed-global",
          "requirement_ref": "SREQ-clear-completed",
          "description": "在 Active 中，只要完整清单有已完成待办就显示 Clear completed；点击清除全部隐藏的已完成项，未完成项不变，当前仍选中 Active。"
        }
      ],
      "feature_ref": "SFEA-remove",
      "record_refs": [
        "RUN-todomvc-spec-13",
        "RUN-todomvc-spec-17"
      ]
    },
    {
      "id": "SREQ-filter",
      "status": "active",
      "description": "页脚提供 All、Active、Completed，分别显示全部、未完成、已完成待办，并标明当前选中项。筛选仅决定可见条目，共享同一份完整清单，不修改实际内容、状态或原有相对顺序。 在任意视图操作同一份清单；新增、编辑、删除、单条或批量完成、清除已完成后立即按当前筛选重新匹配，筛选选择保持不变。",
      "acceptances": [
        {
          "id": "SACC-filter-views",
          "requirement_ref": "SREQ-filter",
          "description": "清单含未完成和已完成待办时，All 显示全部，Active 仅显示未完成，Completed 仅显示已完成。"
        },
        {
          "id": "SACC-filter-selection",
          "requirement_ref": "SREQ-filter",
          "description": "切换任一筛选后，仅该入口显示选中样式。"
        },
        {
          "id": "SACC-filter-unchanged",
          "requirement_ref": "SREQ-filter",
          "description": "切换筛选不新增、删除或修改实际待办，每个视图保留可见条目在完整清单中的相对顺序。"
        },
        {
          "id": "SACC-filter-complete-in-active",
          "requirement_ref": "SREQ-filter",
          "description": "在 Active 完成一条后，该条立即消失，在 Completed 或 All 可见，当前仍选中 Active。"
        },
        {
          "id": "SACC-filter-reopen-in-completed",
          "requirement_ref": "SREQ-filter",
          "description": "在 Completed 取消一条完成状态后，该条立即消失，在 Active 或 All 可见，当前仍选中 Completed。"
        },
        {
          "id": "SACC-filter-mutation-sync",
          "requirement_ref": "SREQ-filter",
          "description": "任一视图中新增、编辑、删除、全选或清除已完成后，可见列表立即按更新的清单重新匹配，当前筛选保持不变；删除项不再出现在任何视图。"
        },
        {
          "id": "SACC-filter-selected-style",
          "requirement_ref": "SREQ-filter",
          "description": "当前选中的分类以细的淡红色圆角边框圈出，其他分类无选中边框；切换分类时整排布局不明显跳动。"
        }
      ],
      "feature_ref": "SFEA-filter",
      "record_refs": [
        "RUN-todomvc-spec-14",
        "RUN-todomvc-spec-15",
        "RUN-todomvc-spec-27"
      ]
    },
    {
      "id": "SREQ-navigation",
      "status": "active",
      "description": "地址 #/、#/active、#/completed 分别选择 All、Active、Completed；也允许实现统一采用等价的 #!/ 形式。未指定筛选时使用 All；直接访问合法地址采用对应筛选，点击入口时地址、选中项和列表同步更新，页面内导航保留现有待办。 浏览器后退、前进按历史记录同步筛选；在合法地址刷新后采用地址对应的筛选规则，但本版不要求恢复刷新前的待办。地址始终选择已定义的三种筛选，筛选语义调整时同步检查导航结果。",
      "acceptances": [
        {
          "id": "SACC-navigation-default-direct",
          "requirement_ref": "SREQ-navigation",
          "description": "未指定筛选时使用 All；分别直接访问 #/、#/active、#/completed（或统一的等价 #!/ 入口），采用对应筛选规则。"
        },
        {
          "id": "SACC-navigation-click",
          "requirement_ref": "SREQ-navigation",
          "description": "页面已有待办时点击任一筛选入口，地址、选中入口和可见列表同步变化，完整清单的待办内容和顺序保留。"
        },
        {
          "id": "SACC-navigation-route-consistency",
          "requirement_ref": "SREQ-navigation",
          "description": "采用 #/ 或等价 #!/ 形式时，三个入口与页面内导航使用一致形式；本版不要求同时支持两套形式。"
        },
        {
          "id": "SACC-navigation-history",
          "requirement_ref": "SREQ-navigation",
          "description": "从 All 切换到 Active 再到 Completed，后退依次返回 Active、All，前进依次回到 Active、Completed；地址、选中入口和可见列表同步，已有待办保持。"
        },
        {
          "id": "SACC-navigation-refresh",
          "requirement_ref": "SREQ-navigation",
          "description": "在合法筛选地址刷新页面后，采用地址对应的筛选规则；若操作页脚可见，其选中入口与地址一致。本项只验收筛选状态，不要求恢复刷新前的待办。"
        }
      ],
      "feature_ref": "SFEA-filter",
      "record_refs": [
        "RUN-todomvc-spec-18",
        "RUN-todomvc-spec-19"
      ]
    },
    {
      "id": "SREQ-persist",
      "status": "active",
      "description": "待办有效提交后自动将最新数据保存到当前浏览器 localStorage，无需额外保存操作，各框架实现相互隔离。保存每条待办的独立身份、整理后的标题、完成状态和加入顺序；改名更新原条目不产生副本，单条和批量状态切换同步保存，直接删除、空标题提交删除及清除已完成均移除对应数据，删光后保存空清单。 每次保存完整清单，包括当前筛选隐藏且未被操作的条目；未提交的新增文字、无效空输入、编辑草稿和正在编辑状态不作为已提交数据保存，Escape 后存储仍保留原标题。验收直接核对存储结果，不要求刷新后恢复显示；不得因不恢复或页面初始化未显示待办而清除已保存数据。",
      "acceptances": [
        {
          "id": "SACC-persist-automatic",
          "requirement_ref": "SREQ-persist",
          "description": "完成一次有效待办操作后，无需额外保存动作，即可在当前实现的 localStorage 数据中核对最新结果。"
        },
        {
          "id": "SACC-persist-isolation",
          "requirement_ref": "SREQ-persist",
          "description": "不同框架实现分别使用 todos-[framework]，其中 [framework] 替换为当前实现名称；一个实现的新增、修改或删除不覆盖另一实现的数据。"
        },
        {
          "id": "SACC-persist-create",
          "requirement_ref": "SREQ-persist",
          "description": "有效新增后，存储中可核对独立身份、去除首尾空白的标题和未完成状态；连续新增保留加入顺序，同名两条保持独立。"
        },
        {
          "id": "SACC-persist-edit",
          "requirement_ref": "SREQ-persist",
          "description": "通过 Enter 或失焦提交非空改名后，存储中同一身份的标题更新，完成状态和位置不变，不产生副本。"
        },
        {
          "id": "SACC-persist-completion",
          "requirement_ref": "SREQ-persist",
          "description": "单条勾选、取消以及全选、全部取消后，存储中所有受影响待办的完成状态与操作结果一致，身份、标题和顺序不变。"
        },
        {
          "id": "SACC-persist-delete",
          "requirement_ref": "SREQ-persist",
          "description": "直接删除、将标题清空或改为纯空白后通过 Enter 或失焦提交删除、Clear completed 清除后，对应待办均从存储的有效清单移除；删光后存空清单，不残留旧的有效待办。"
        },
        {
          "id": "SACC-persist-full-list",
          "requirement_ref": "SREQ-persist",
          "description": "在 Active 或 Completed 中提交变化后，存储仍表示更新后的完整清单，筛选隐藏且未被操作的待办保留，不因不可见而丢失。"
        },
        {
          "id": "SACC-persist-exclude-drafts",
          "requirement_ref": "SREQ-persist",
          "description": "新增框未按 Enter 的文字、被拒绝的空输入、编辑中的临时标题和正在编辑状态不进入已提交存储；即使此时发生其他有效操作，保存也不带入这些草稿。"
        },
        {
          "id": "SACC-persist-cancel",
          "requirement_ref": "SREQ-persist",
          "description": "编辑后按 Escape，存储中的标题仍为编辑前的已提交值；草稿为空或纯空白时也不删除存储中的原待办。"
        },
        {
          "id": "SACC-persist-no-restore-no-clear",
          "requirement_ref": "SREQ-persist",
          "description": "已有存储数据时刷新页面，本版不要求恢复并显示待办；不得仅因未恢复或初始显示为空而将已保存数据覆盖为空。持久化验收直接核对各次有效提交的存储结果。"
        },
        {
          "id": "SACC-persist-plain-text",
          "requirement_ref": "SREQ-persist",
          "description": "新增或修改为“<b>买牛奶</b>”并提交后，存储标题为该文字本身，除规定的首尾空白处理外不擅自变更内容。"
        }
      ],
      "feature_ref": "SFEA-persistence",
      "record_refs": [
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22",
        "RUN-todomvc-spec-23"
      ]
    },
    {
      "id": "SREQ-information",
      "status": "active",
      "description": "卡片外居中展示 Double-click to edit a todo、当前实现的作者或团队信息，以及文字为 Part of TodoMVC、指向 https://todomvc.com/ 的项目链接；采用小号浅灰低强调文字，完整清单为空时仍保留。具体作者或团队文案由实现填写。",
      "acceptances": [
        {
          "id": "SACC-information-content",
          "requirement_ref": "SREQ-information",
          "description": "卡片外显示 Double-click to edit a todo、当前实现的作者或团队名字，以及 Part of TodoMVC 链接，链接指向 https://todomvc.com/。"
        },
        {
          "id": "SACC-information-style",
          "requirement_ref": "SREQ-information",
          "description": "提示、作者或团队及归属信息居中，使用小号浅灰低强调文字。"
        },
        {
          "id": "SACC-information-empty",
          "requirement_ref": "SREQ-information",
          "description": "完整清单为空且操作页脚隐藏时，卡片外提示、作者或团队及 TodoMVC 项目链接仍可见。"
        }
      ],
      "feature_ref": "SFEA-display",
      "record_refs": [
        "RUN-todomvc-spec-27"
      ]
    }
  ],
  "constraints": [
    {
      "id": "SCON-consistent-behavior",
      "status": "active",
      "description": "应用在浏览器中使用一份待办清单；操作文案为英文，不同语言或框架的实现保持本版已确认的功能和用户可见用法一致。",
      "record_refs": [
        "RUN-todomvc-spec-01"
      ]
    },
    {
      "id": "SCON-local-storage",
      "status": "active",
      "description": "已提交待办数据保存在当前浏览器的 localStorage，存储键遵循 todos-[framework]，其中 [framework] 替换为实现名称；不同框架实现的新增、修改和删除不得覆盖彼此的清单。具体框架内部实现不在本版业务需求中指定。",
      "record_refs": [
        "RUN-todomvc-spec-20"
      ]
    },
    {
      "id": "SCON-plain-text",
      "status": "active",
      "description": "待办标题在新增、编辑、列表展示和保存过程中始终作为用户文本处理。除规定的首尾空白处理外，保留标题内容；例如输入 <b>买牛奶</b> 时，显示并保存这段文字本身，不将其解释为页面标记或可执行内容。",
      "record_refs": [
        "RUN-todomvc-spec-23"
      ]
    },
    {
      "id": "SCON-visual-layout",
      "status": "active",
      "description": "页面采用简洁轻量的单列布局：很浅的灰色背景，水平居中的白色待办卡片；桌面宽度适中、不铺满屏幕，窄屏随可用宽度收缩且不产生横向滚动。todos 在卡片上方居中，使用明显大于输入框和清单文字的细体淡红色字，形成清晰视觉层级。 白色卡片可使用轻微阴影和底部叠纸效果；操作页脚紧凑、状态切换不明显跳动，控件与文字遵守各要求中的可见样式。卡片外的提示与归属信息居中显示为小号浅灰文字。",
      "record_refs": [
        "RUN-todomvc-spec-24",
        "RUN-todomvc-spec-27"
      ]
    }
  ],
  "relations": [
    {
      "id": "SREL-navigation-depends-filter",
      "status": "active",
      "source_req_ref": "SREQ-navigation",
      "target_req_ref": "SREQ-filter",
      "type": "depends_on",
      "description": "地址导航选择 All、Active、Completed 中的一种视图，其显示结果依赖状态筛选要求中定义的匹配规则；筛选规则调整时，须同步检查直接访问、点击切换、浏览器前进后退和刷新后的筛选结果。",
      "record_refs": [
        "RUN-todomvc-spec-18",
        "RUN-todomvc-spec-19"
      ]
    }
  ],
  "deferreds": []
} satisfies SpecificationArtifact;
