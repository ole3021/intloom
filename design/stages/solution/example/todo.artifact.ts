/**
 * 以 specification/example/todo.records.ts 的 27 条 Record 顺序模拟 Solution。
 * 每轮只读取重建的当轮 Specification 状态；最终状态与 todo.artifact.ts 核对一致。
 * 与上游共用 Workflow Run ID，模拟 design / postHook / clarify（按需）/ confirm / finalize。
 * user 反馈和问答均为明确标注的模拟交互，不是真实对话或已接入 Kernel 的运行日志。
 * 来源中的 Acceptance 映射到所属 Requirement，Specification Relation 映射到两端 Requirement，遵守当前 origin_refs 类型。
 */
import type { SolutionArtifact } from '../artifact.js';

/** 最后一次模拟 Finalize 的完整设计；D2 图与正文同步，非阻塞风险单独保留。 */
export const todoSolutionArtifact = {
  "structure": {
    "apps": [
      {
        "id": "OAPP-todos",
        "name": "TodoMVC",
        "type": "web",
        "description": "在浏览器中运行的单清单待办应用；由页面内模块实现已确认的业务，架构不绑定具体语言或框架。",
        "technologies": [
          {
            "type": "platform",
            "name": "Web Browser"
          }
        ],
        "modules": [
          {
            "id": "OMOD-ui",
            "parent_ref": "OAPP-todos",
            "name": "页面交互",
            "status": "active",
            "description": "负责页面布局、英文文案、文本呈现、新增草稿与编辑会话；通过状态模块执行命令并读取投影，通过导航模块同步地址筛选。按完整清单控制主体及页脚显隐，卡片外帮助归属始终保留；界面不直接写保存资源。",
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
              "SREQ-information"
            ],
            "constraint_refs": [
              "SCON-consistent-behavior",
              "SCON-plain-text",
              "SCON-visual-layout"
            ]
          },
          {
            "id": "OMOD-store",
            "parent_ref": "OAPP-todos",
            "name": "清单状态",
            "status": "active",
            "description": "拥有本页完整清单，统一处理用户命令并派生展示快照；有效变更通过保存适配提交最新清单，界面重绘不能触发额外写入。",
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
              "SREQ-persist"
            ],
            "interfaces": [
              {
                "id": "OMOD-store-INT-read",
                "name": "读取展示快照",
                "type": "call",
                "description": "接收当前筛选，返回保留原顺序的可见待办及完整清单派生的空状态、未完成数、全选状态和是否有已完成项。"
              },
              {
                "id": "OMOD-store-INT-command",
                "name": "提交清单变更",
                "type": "call",
                "description": "统一提供新增、单条完成切换、编辑提交、身份移除、全量完成状态设定和清除全部已完成项；所有命令基于完整清单执行。"
              }
            ],
            "constraint_refs": [
              "SCON-plain-text"
            ]
          },
          {
            "id": "OMOD-router",
            "parent_ref": "OAPP-todos",
            "name": "筛选导航",
            "status": "active",
            "description": "拥有地址与规范筛选值的映射，处理首次读取、点击切换和浏览器历史变化；地址变化后通知页面规范选择，不持有待办或复制匹配规则。",
            "requirement_refs": [
              "SREQ-navigation",
              "SREQ-filter"
            ],
            "interfaces": [
              {
                "id": "OMOD-router-INT-current",
                "name": "读取当前筛选",
                "type": "call",
                "description": "将当前地址解析为唯一规范筛选值，地址未指定时返回 All。"
              },
              {
                "id": "OMOD-router-INT-select",
                "name": "切换筛选地址",
                "type": "call",
                "description": "接收规范筛选选择，更新对应地址并返回当前筛选，不修改清单。"
              },
              {
                "id": "OMOD-router-INT-changed",
                "name": "筛选已变化",
                "type": "event",
                "description": "当浏览器历史导航引起地址变化时发布规范筛选值，通知页面同步选中项和展示投影。"
              }
            ]
          },
          {
            "id": "OMOD-storage",
            "parent_ref": "OAPP-todos",
            "name": "保存适配",
            "status": "active",
            "description": "把状态模块提交的完整清单写入当前实现隔离的浏览器保存空间；封装保存边界和结果，不接收界面草稿，不承担筛选和清单业务修改。",
            "requirement_refs": [
              "SREQ-persist"
            ],
            "constraint_refs": [
              "SCON-local-storage",
              "SCON-plain-text"
            ],
            "interfaces": [
              {
                "id": "OMOD-storage-INT-save",
                "name": "保存已提交清单",
                "type": "call",
                "description": "接收包含独立身份、整理后标题、完成状态和顺序的完整清单，保存最新快照；空清单表示有效删光结果，返回真实保存结果。"
              }
            ]
          }
        ]
      }
    ],
    "packages": [],
    "resources": [
      {
        "id": "ORES-navigation",
        "name": "页面地址与导航历史",
        "type": "other",
        "description": "提供当前页面地址的读取和页面内导航记录能力，不承载待办内容。",
        "capabilities": [
          {
            "name": "current location"
          },
          {
            "name": "navigation history"
          }
        ],
        "requirement_refs": [
          "SREQ-navigation"
        ]
      },
      {
        "id": "ORES-todo-data",
        "name": "浏览器内待办保存空间",
        "type": "database",
        "description": "提供当前浏览器中按实现隔离的待办快照保存能力；是逻辑数据资源，不包含连接、部署或具体产品实例。",
        "capabilities": [
          {
            "name": "durable storage",
            "description": "在当前浏览器中保留已提交清单。"
          },
          {
            "name": "namespace isolation",
            "description": "各实现的保存空间相互独立。"
          }
        ],
        "requirement_refs": [
          "SREQ-persist"
        ],
        "constraint_refs": [
          "SCON-local-storage"
        ]
      }
    ],
    "relations": [
      {
        "id": "OREL-ui-store",
        "source_ref": "OMOD-ui",
        "target_ref": "OMOD-store",
        "type": "calls",
        "description": "页面通过稳定能力提交清单变更并读取展示快照；不绕过状态模块直接改写条目。",
        "requirement_refs": [
          "SREQ-display",
          "SREQ-create"
        ]
      },
      {
        "id": "OREL-ui-router",
        "source_ref": "OMOD-ui",
        "target_ref": "OMOD-router",
        "type": "calls",
        "description": "页面读取规范筛选或请求切换地址，实际匹配仍委托清单状态。",
        "requirement_refs": [
          "SREQ-navigation",
          "SREQ-filter"
        ]
      },
      {
        "id": "OREL-router-read-location",
        "source_ref": "OMOD-router",
        "target_ref": "ORES-navigation",
        "type": "reads",
        "description": "导航模块读取当前页面地址并解析选择。",
        "requirement_refs": [
          "SREQ-navigation"
        ]
      },
      {
        "id": "OREL-router-write-location",
        "source_ref": "OMOD-router",
        "target_ref": "ORES-navigation",
        "type": "writes",
        "description": "导航模块把明确选择写为规范地址并记录页面内导航。",
        "requirement_refs": [
          "SREQ-navigation"
        ]
      },
      {
        "id": "OREL-ui-router-events",
        "source_ref": "OMOD-ui",
        "target_ref": "OMOD-router",
        "type": "subscribes",
        "description": "页面订阅导航模块发布的筛选变化，重新读取清单投影而不修改清单。",
        "requirement_refs": [
          "SREQ-navigation",
          "SREQ-filter"
        ]
      },
      {
        "id": "OREL-router-history-events",
        "source_ref": "OMOD-router",
        "target_ref": "ORES-navigation",
        "type": "subscribes",
        "description": "导航模块接收地址与历史的外部变化，再解析当前规范筛选。",
        "requirement_refs": [
          "SREQ-navigation"
        ]
      },
      {
        "id": "OREL-store-storage",
        "source_ref": "OMOD-store",
        "target_ref": "OMOD-storage",
        "type": "calls",
        "description": "清单状态在有效变更后提交完整快照给保存适配，并读取保存结果；保存不由界面重绘触发。",
        "requirement_refs": [
          "SREQ-persist"
        ]
      },
      {
        "id": "OREL-storage-writes",
        "source_ref": "OMOD-storage",
        "target_ref": "ORES-todo-data",
        "type": "writes",
        "description": "保存适配写入当前实现隔离的待办空间，不能覆盖其他实现。",
        "requirement_refs": [
          "SREQ-persist"
        ],
        "constraint_refs": [
          "SCON-local-storage"
        ]
      }
    ]
  },
  "scenarios": [
    {
      "id": "OSCN-launch",
      "status": "active",
      "description": "打开页面并建立当前展示状态",
      "requirement_refs": [
        "SREQ-display",
        "SREQ-create",
        "SREQ-navigation",
        "SREQ-information",
        "SREQ-persist"
      ],
      "initial_state": "开始新的页面会话。",
      "participants": [
        {
          "id": "OPAR-launch-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-launch-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-launch-router",
          "type": "module",
          "ref": "OMOD-router",
          "name": "筛选导航"
        },
        {
          "id": "OPAR-launch-history",
          "type": "resource",
          "ref": "ORES-navigation",
          "name": "地址与导航历史"
        },
        {
          "id": "OPAR-launch-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        }
      ],
      "steps": [
        {
          "id": "OSCN-launch-STEP-1",
          "source_ref": "OPAR-launch-user",
          "target_ref": "OPAR-launch-ui",
          "type": "start",
          "action": "打开浏览器中的 TodoMVC 单清单应用。"
        },
        {
          "id": "OSCN-launch-STEP-2",
          "source_ref": "OPAR-launch-ui",
          "target_ref": "OPAR-launch-router",
          "type": "call",
          "action": "解析当前合法筛选地址；地址没有指定筛选时选择 All。"
        },
        {
          "id": "OSCN-launch-STEP-3",
          "source_ref": "OPAR-launch-router",
          "target_ref": "OPAR-launch-history",
          "type": "read",
          "action": "读取当前页面地址，按已确认的路由映射确定筛选。"
        },
        {
          "id": "OSCN-launch-STEP-4",
          "source_ref": "OPAR-launch-router",
          "target_ref": "OPAR-launch-ui",
          "type": "return",
          "action": "返回规范化筛选值，不改变待办数据。"
        },
        {
          "id": "OSCN-launch-STEP-5",
          "source_ref": "OPAR-launch-ui",
          "target_ref": "OPAR-launch-store",
          "type": "call",
          "action": "读取本页清单展示结果。"
        },
        {
          "id": "OSCN-launch-STEP-6",
          "source_ref": "OPAR-launch-store",
          "target_ref": "OPAR-launch-ui",
          "type": "return",
          "action": "返回当前清单及本轮已经定义的派生展示值。"
        },
        {
          "id": "OSCN-launch-STEP-7",
          "source_ref": "OPAR-launch-ui",
          "type": "activity",
          "action": "呈现当前视图、标题、新增入口和卡片外帮助归属信息，应用统一视觉规则；加载后将焦点交给新增输入框。"
        },
        {
          "id": "OSCN-launch-STEP-8",
          "source_ref": "OPAR-launch-ui",
          "type": "activity",
          "action": "启动与首次呈现不构成待办提交，不触发保存，不因未恢复显示而覆盖原有存储。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "标题、新增入口及已确定的显示区域与当前清单一致，新增框获得焦点。"
        },
        {
          "type": "state",
          "description": "筛选由当前地址确定。"
        },
        {
          "type": "state",
          "description": "初始化不写入或清除已保存清单；本版不要求刷新恢复待办显示。"
        }
      ]
    },
    {
      "id": "OSCN-create",
      "status": "active",
      "description": "有效标题新增一条待办",
      "requirement_refs": [
        "SREQ-create",
        "SREQ-display",
        "SREQ-count",
        "SREQ-filter",
        "SREQ-persist"
      ],
      "initial_state": "新增草稿去除首尾空白后非空，可与已有条目同名。 本场景保存资源可用。",
      "participants": [
        {
          "id": "OPAR-create-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-create-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-create-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        },
        {
          "id": "OPAR-create-storage",
          "type": "module",
          "ref": "OMOD-storage",
          "name": "保存适配"
        },
        {
          "id": "OPAR-create-saved",
          "type": "resource",
          "ref": "ORES-todo-data",
          "name": "浏览器内待办数据"
        }
      ],
      "steps": [
        {
          "id": "OSCN-create-STEP-1",
          "source_ref": "OPAR-create-user",
          "target_ref": "OPAR-create-ui",
          "type": "call",
          "action": "在新增框按 Enter。"
        },
        {
          "id": "OSCN-create-STEP-2",
          "source_ref": "OPAR-create-ui",
          "target_ref": "OPAR-create-store",
          "type": "call",
          "action": "整理标题并验证非空，为本次新增分配独立身份，保留中间空格。"
        },
        {
          "id": "OSCN-create-STEP-3",
          "source_ref": "OPAR-create-store",
          "type": "activity",
          "action": "按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。"
        },
        {
          "id": "OSCN-create-STEP-4",
          "source_ref": "OPAR-create-store",
          "target_ref": "OPAR-create-storage",
          "type": "call",
          "action": "提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。"
        },
        {
          "id": "OSCN-create-STEP-5",
          "source_ref": "OPAR-create-storage",
          "target_ref": "OPAR-create-saved",
          "type": "write",
          "action": "在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。"
        },
        {
          "id": "OSCN-create-STEP-6",
          "source_ref": "OPAR-create-storage",
          "target_ref": "OPAR-create-store",
          "type": "return",
          "action": "返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。"
        },
        {
          "id": "OSCN-create-STEP-7",
          "source_ref": "OPAR-create-store",
          "target_ref": "OPAR-create-ui",
          "type": "return",
          "action": "返回本次命令结果，界面保留当前筛选。"
        },
        {
          "id": "OSCN-create-STEP-8",
          "source_ref": "OPAR-create-ui",
          "target_ref": "OPAR-create-store",
          "type": "call",
          "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
        },
        {
          "id": "OSCN-create-STEP-9",
          "source_ref": "OPAR-create-store",
          "target_ref": "OPAR-create-ui",
          "type": "return",
          "action": "返回一致的展示快照。"
        },
        {
          "id": "OSCN-create-STEP-10",
          "source_ref": "OPAR-create-ui",
          "type": "activity",
          "action": "只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。"
        },
        {
          "type": "state",
          "description": "存储中该实现的最新清单与本次已提交结果一致。"
        }
      ]
    },
    {
      "id": "OSCN-reject-create",
      "status": "active",
      "description": "拒绝空标题新增",
      "requirement_refs": [
        "SREQ-create"
      ],
      "initial_state": "新增框为空或只含空白。",
      "participants": [
        {
          "id": "OPAR-reject-create-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-reject-create-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-reject-create-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        }
      ],
      "steps": [
        {
          "id": "OSCN-reject-create-STEP-1",
          "source_ref": "OPAR-reject-create-user",
          "target_ref": "OPAR-reject-create-ui",
          "type": "call",
          "action": "按 Enter 提交新增草稿。"
        },
        {
          "id": "OSCN-reject-create-STEP-2",
          "source_ref": "OPAR-reject-create-ui",
          "target_ref": "OPAR-reject-create-store",
          "type": "call",
          "action": "提交新增标题。"
        },
        {
          "id": "OSCN-reject-create-STEP-3",
          "source_ref": "OPAR-reject-create-store",
          "type": "activity",
          "action": "去除首尾空白后结果为空，拒绝产生清单变更。"
        },
        {
          "id": "OSCN-reject-create-STEP-4",
          "source_ref": "OPAR-reject-create-store",
          "target_ref": "OPAR-reject-create-ui",
          "type": "return",
          "action": "返回无新增结果；不产生已提交条目。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "无效新增不改变清单或数量，不调用保存；拒绝的空标题不会进入存储。"
        }
      ]
    },
    {
      "id": "OSCN-complete",
      "status": "active",
      "description": "完成单条待办",
      "requirement_refs": [
        "SREQ-toggle",
        "SREQ-display",
        "SREQ-count",
        "SREQ-filter",
        "SREQ-persist"
      ],
      "initial_state": "目标待办存在且未完成。 本场景保存资源可用。",
      "participants": [
        {
          "id": "OPAR-complete-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-complete-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-complete-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        },
        {
          "id": "OPAR-complete-storage",
          "type": "module",
          "ref": "OMOD-storage",
          "name": "保存适配"
        },
        {
          "id": "OPAR-complete-saved",
          "type": "resource",
          "ref": "ORES-todo-data",
          "name": "浏览器内待办数据"
        }
      ],
      "steps": [
        {
          "id": "OSCN-complete-STEP-1",
          "source_ref": "OPAR-complete-user",
          "target_ref": "OPAR-complete-ui",
          "type": "call",
          "action": "勾选目标待办。"
        },
        {
          "id": "OSCN-complete-STEP-2",
          "source_ref": "OPAR-complete-ui",
          "target_ref": "OPAR-complete-store",
          "type": "call",
          "action": "按身份把目标设为已完成。"
        },
        {
          "id": "OSCN-complete-STEP-3",
          "source_ref": "OPAR-complete-store",
          "type": "activity",
          "action": "按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。"
        },
        {
          "id": "OSCN-complete-STEP-4",
          "source_ref": "OPAR-complete-store",
          "target_ref": "OPAR-complete-storage",
          "type": "call",
          "action": "提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。"
        },
        {
          "id": "OSCN-complete-STEP-5",
          "source_ref": "OPAR-complete-storage",
          "target_ref": "OPAR-complete-saved",
          "type": "write",
          "action": "在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。"
        },
        {
          "id": "OSCN-complete-STEP-6",
          "source_ref": "OPAR-complete-storage",
          "target_ref": "OPAR-complete-store",
          "type": "return",
          "action": "返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。"
        },
        {
          "id": "OSCN-complete-STEP-7",
          "source_ref": "OPAR-complete-store",
          "target_ref": "OPAR-complete-ui",
          "type": "return",
          "action": "返回本次命令结果，界面保留当前筛选。"
        },
        {
          "id": "OSCN-complete-STEP-8",
          "source_ref": "OPAR-complete-ui",
          "target_ref": "OPAR-complete-store",
          "type": "call",
          "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
        },
        {
          "id": "OSCN-complete-STEP-9",
          "source_ref": "OPAR-complete-store",
          "target_ref": "OPAR-complete-ui",
          "type": "return",
          "action": "返回一致的展示快照。"
        },
        {
          "id": "OSCN-complete-STEP-10",
          "source_ref": "OPAR-complete-ui",
          "type": "activity",
          "action": "目标立即呈现选中与完成删除线，其他待办不变。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "目标立即呈现选中与完成删除线，其他待办不变。"
        },
        {
          "type": "state",
          "description": "存储中该实现的最新清单与本次已提交结果一致。"
        }
      ]
    },
    {
      "id": "OSCN-reopen",
      "status": "active",
      "description": "重新打开单条待办",
      "requirement_refs": [
        "SREQ-toggle",
        "SREQ-display",
        "SREQ-count",
        "SREQ-filter",
        "SREQ-persist"
      ],
      "initial_state": "目标待办存在且已完成。 本场景保存资源可用。",
      "participants": [
        {
          "id": "OPAR-reopen-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-reopen-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-reopen-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        },
        {
          "id": "OPAR-reopen-storage",
          "type": "module",
          "ref": "OMOD-storage",
          "name": "保存适配"
        },
        {
          "id": "OPAR-reopen-saved",
          "type": "resource",
          "ref": "ORES-todo-data",
          "name": "浏览器内待办数据"
        }
      ],
      "steps": [
        {
          "id": "OSCN-reopen-STEP-1",
          "source_ref": "OPAR-reopen-user",
          "target_ref": "OPAR-reopen-ui",
          "type": "call",
          "action": "取消目标勾选。"
        },
        {
          "id": "OSCN-reopen-STEP-2",
          "source_ref": "OPAR-reopen-ui",
          "target_ref": "OPAR-reopen-store",
          "type": "call",
          "action": "按身份把目标设为未完成。"
        },
        {
          "id": "OSCN-reopen-STEP-3",
          "source_ref": "OPAR-reopen-store",
          "type": "activity",
          "action": "按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。"
        },
        {
          "id": "OSCN-reopen-STEP-4",
          "source_ref": "OPAR-reopen-store",
          "target_ref": "OPAR-reopen-storage",
          "type": "call",
          "action": "提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。"
        },
        {
          "id": "OSCN-reopen-STEP-5",
          "source_ref": "OPAR-reopen-storage",
          "target_ref": "OPAR-reopen-saved",
          "type": "write",
          "action": "在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。"
        },
        {
          "id": "OSCN-reopen-STEP-6",
          "source_ref": "OPAR-reopen-storage",
          "target_ref": "OPAR-reopen-store",
          "type": "return",
          "action": "返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。"
        },
        {
          "id": "OSCN-reopen-STEP-7",
          "source_ref": "OPAR-reopen-store",
          "target_ref": "OPAR-reopen-ui",
          "type": "return",
          "action": "返回本次命令结果，界面保留当前筛选。"
        },
        {
          "id": "OSCN-reopen-STEP-8",
          "source_ref": "OPAR-reopen-ui",
          "target_ref": "OPAR-reopen-store",
          "type": "call",
          "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
        },
        {
          "id": "OSCN-reopen-STEP-9",
          "source_ref": "OPAR-reopen-store",
          "target_ref": "OPAR-reopen-ui",
          "type": "return",
          "action": "返回一致的展示快照。"
        },
        {
          "id": "OSCN-reopen-STEP-10",
          "source_ref": "OPAR-reopen-ui",
          "type": "activity",
          "action": "目标立即恢复未完成样式，其他待办不变。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "目标立即恢复未完成样式，其他待办不变。"
        },
        {
          "type": "state",
          "description": "存储中该实现的最新清单与本次已提交结果一致。"
        }
      ]
    },
    {
      "id": "OSCN-begin-edit",
      "status": "active",
      "description": "开始就地编辑",
      "requirement_refs": [
        "SREQ-edit"
      ],
      "initial_state": "目标待办存在，处于展示状态。",
      "participants": [
        {
          "id": "OPAR-begin-edit-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-begin-edit-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-begin-edit-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        }
      ],
      "steps": [
        {
          "id": "OSCN-begin-edit-STEP-1",
          "source_ref": "OPAR-begin-edit-user",
          "target_ref": "OPAR-begin-edit-ui",
          "type": "call",
          "action": "双击目标待办的标题。"
        },
        {
          "id": "OSCN-begin-edit-STEP-2",
          "source_ref": "OPAR-begin-edit-ui",
          "target_ref": "OPAR-begin-edit-store",
          "type": "call",
          "action": "读取目标身份对应的已提交内容。"
        },
        {
          "id": "OSCN-begin-edit-STEP-3",
          "source_ref": "OPAR-begin-edit-store",
          "target_ref": "OPAR-begin-edit-ui",
          "type": "return",
          "action": "返回目标的原标题和完成状态。"
        },
        {
          "id": "OSCN-begin-edit-STEP-4",
          "source_ref": "OPAR-begin-edit-ui",
          "type": "activity",
          "action": "建立绑定该身份的临时编辑会话并预填草稿；在原位置显示编辑框、交付焦点，隐藏该行展示及完成和删除控件。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "目标行进入编辑状态，完整清单的已提交内容保持不变。"
        }
      ]
    },
    {
      "id": "OSCN-submit-edit",
      "status": "active",
      "description": "提交非空编辑标题",
      "requirement_refs": [
        "SREQ-edit",
        "SREQ-display",
        "SREQ-count",
        "SREQ-filter",
        "SREQ-persist"
      ],
      "initial_state": "目标的编辑会话有效，草稿整理后非空。 本场景保存资源可用。",
      "participants": [
        {
          "id": "OPAR-submit-edit-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-submit-edit-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-submit-edit-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        },
        {
          "id": "OPAR-submit-edit-storage",
          "type": "module",
          "ref": "OMOD-storage",
          "name": "保存适配"
        },
        {
          "id": "OPAR-submit-edit-saved",
          "type": "resource",
          "ref": "ORES-todo-data",
          "name": "浏览器内待办数据"
        }
      ],
      "steps": [
        {
          "id": "OSCN-submit-edit-STEP-1",
          "source_ref": "OPAR-submit-edit-user",
          "target_ref": "OPAR-submit-edit-ui",
          "type": "call",
          "action": "通过 Enter 或编辑框失焦提交草稿。"
        },
        {
          "id": "OSCN-submit-edit-STEP-2",
          "source_ref": "OPAR-submit-edit-ui",
          "type": "activity",
          "action": "校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。"
        },
        {
          "id": "OSCN-submit-edit-STEP-3",
          "source_ref": "OPAR-submit-edit-ui",
          "target_ref": "OPAR-submit-edit-store",
          "type": "call",
          "action": "按原身份提交整理后的非空标题，保留完成状态与位置。"
        },
        {
          "id": "OSCN-submit-edit-STEP-4",
          "source_ref": "OPAR-submit-edit-store",
          "type": "activity",
          "action": "按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。"
        },
        {
          "id": "OSCN-submit-edit-STEP-5",
          "source_ref": "OPAR-submit-edit-store",
          "target_ref": "OPAR-submit-edit-storage",
          "type": "call",
          "action": "提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。"
        },
        {
          "id": "OSCN-submit-edit-STEP-6",
          "source_ref": "OPAR-submit-edit-storage",
          "target_ref": "OPAR-submit-edit-saved",
          "type": "write",
          "action": "在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。"
        },
        {
          "id": "OSCN-submit-edit-STEP-7",
          "source_ref": "OPAR-submit-edit-storage",
          "target_ref": "OPAR-submit-edit-store",
          "type": "return",
          "action": "返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。"
        },
        {
          "id": "OSCN-submit-edit-STEP-8",
          "source_ref": "OPAR-submit-edit-store",
          "target_ref": "OPAR-submit-edit-ui",
          "type": "return",
          "action": "返回本次命令结果，界面保留当前筛选。"
        },
        {
          "id": "OSCN-submit-edit-STEP-9",
          "source_ref": "OPAR-submit-edit-ui",
          "target_ref": "OPAR-submit-edit-store",
          "type": "call",
          "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
        },
        {
          "id": "OSCN-submit-edit-STEP-10",
          "source_ref": "OPAR-submit-edit-store",
          "target_ref": "OPAR-submit-edit-ui",
          "type": "return",
          "action": "返回一致的展示快照。"
        },
        {
          "id": "OSCN-submit-edit-STEP-11",
          "source_ref": "OPAR-submit-edit-ui",
          "type": "activity",
          "action": "退出编辑并显示同一待办的新标题，后续失焦不会重复提交。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "退出编辑并显示同一待办的新标题，后续失焦不会重复提交。"
        },
        {
          "type": "state",
          "description": "存储中该实现的最新清单与本次已提交结果一致。"
        }
      ]
    },
    {
      "id": "OSCN-cancel-edit",
      "status": "active",
      "description": "取消编辑并忽略后续失焦",
      "requirement_refs": [
        "SREQ-edit"
      ],
      "initial_state": "编辑会话有效，草稿可为空、纯空白或任意新标题。",
      "participants": [
        {
          "id": "OPAR-cancel-edit-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-cancel-edit-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        }
      ],
      "steps": [
        {
          "id": "OSCN-cancel-edit-STEP-1",
          "source_ref": "OPAR-cancel-edit-user",
          "target_ref": "OPAR-cancel-edit-ui",
          "type": "call",
          "action": "按 Escape。"
        },
        {
          "id": "OSCN-cancel-edit-STEP-2",
          "source_ref": "OPAR-cancel-edit-ui",
          "type": "activity",
          "action": "关闭会话并丢弃草稿，不分发清单变更命令；从已提交快照恢复原标题。"
        },
        {
          "id": "OSCN-cancel-edit-STEP-3",
          "source_ref": "OPAR-cancel-edit-user",
          "target_ref": "OPAR-cancel-edit-ui",
          "type": "call",
          "action": "随后发生该编辑框的失焦。"
        },
        {
          "id": "OSCN-cancel-edit-STEP-4",
          "source_ref": "OPAR-cancel-edit-ui",
          "type": "activity",
          "action": "识别该会话已经关闭，忽略残留失焦。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "编辑会话结束，原待办和原标题保留；取消不分发保存，其他有效命令保存时仍使用原已提交标题。"
        }
      ]
    },
    {
      "id": "OSCN-delete-by-edit",
      "status": "active",
      "description": "提交空标题删除待办",
      "requirement_refs": [
        "SREQ-edit",
        "SREQ-display",
        "SREQ-count",
        "SREQ-filter",
        "SREQ-persist"
      ],
      "initial_state": "目标编辑会话有效，草稿整理后为空。 本场景保存资源可用。",
      "participants": [
        {
          "id": "OPAR-delete-by-edit-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-delete-by-edit-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-delete-by-edit-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        },
        {
          "id": "OPAR-delete-by-edit-storage",
          "type": "module",
          "ref": "OMOD-storage",
          "name": "保存适配"
        },
        {
          "id": "OPAR-delete-by-edit-saved",
          "type": "resource",
          "ref": "ORES-todo-data",
          "name": "浏览器内待办数据"
        }
      ],
      "steps": [
        {
          "id": "OSCN-delete-by-edit-STEP-1",
          "source_ref": "OPAR-delete-by-edit-user",
          "target_ref": "OPAR-delete-by-edit-ui",
          "type": "call",
          "action": "按 Enter 或使编辑框失焦。"
        },
        {
          "id": "OSCN-delete-by-edit-STEP-2",
          "source_ref": "OPAR-delete-by-edit-ui",
          "type": "activity",
          "action": "校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。"
        },
        {
          "id": "OSCN-delete-by-edit-STEP-3",
          "source_ref": "OPAR-delete-by-edit-ui",
          "target_ref": "OPAR-delete-by-edit-store",
          "type": "call",
          "action": "按编辑会话绑定的身份移除目标待办。"
        },
        {
          "id": "OSCN-delete-by-edit-STEP-4",
          "source_ref": "OPAR-delete-by-edit-store",
          "type": "activity",
          "action": "按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。"
        },
        {
          "id": "OSCN-delete-by-edit-STEP-5",
          "source_ref": "OPAR-delete-by-edit-store",
          "target_ref": "OPAR-delete-by-edit-storage",
          "type": "call",
          "action": "提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。"
        },
        {
          "id": "OSCN-delete-by-edit-STEP-6",
          "source_ref": "OPAR-delete-by-edit-storage",
          "target_ref": "OPAR-delete-by-edit-saved",
          "type": "write",
          "action": "在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。"
        },
        {
          "id": "OSCN-delete-by-edit-STEP-7",
          "source_ref": "OPAR-delete-by-edit-storage",
          "target_ref": "OPAR-delete-by-edit-store",
          "type": "return",
          "action": "返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。"
        },
        {
          "id": "OSCN-delete-by-edit-STEP-8",
          "source_ref": "OPAR-delete-by-edit-store",
          "target_ref": "OPAR-delete-by-edit-ui",
          "type": "return",
          "action": "返回本次命令结果，界面保留当前筛选。"
        },
        {
          "id": "OSCN-delete-by-edit-STEP-9",
          "source_ref": "OPAR-delete-by-edit-ui",
          "target_ref": "OPAR-delete-by-edit-store",
          "type": "call",
          "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
        },
        {
          "id": "OSCN-delete-by-edit-STEP-10",
          "source_ref": "OPAR-delete-by-edit-store",
          "target_ref": "OPAR-delete-by-edit-ui",
          "type": "return",
          "action": "返回一致的展示快照。"
        },
        {
          "id": "OSCN-delete-by-edit-STEP-11",
          "source_ref": "OPAR-delete-by-edit-ui",
          "type": "activity",
          "action": "仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。"
        },
        {
          "type": "state",
          "description": "存储中该实现的最新清单与本次已提交结果一致。"
        }
      ]
    },
    {
      "id": "OSCN-delete",
      "status": "active",
      "description": "直接删除一条待办",
      "requirement_refs": [
        "SREQ-delete",
        "SREQ-display",
        "SREQ-count",
        "SREQ-filter",
        "SREQ-persist"
      ],
      "initial_state": "目标待办存在且不在编辑状态。 本场景保存资源可用。",
      "participants": [
        {
          "id": "OPAR-delete-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-delete-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-delete-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        },
        {
          "id": "OPAR-delete-storage",
          "type": "module",
          "ref": "OMOD-storage",
          "name": "保存适配"
        },
        {
          "id": "OPAR-delete-saved",
          "type": "resource",
          "ref": "ORES-todo-data",
          "name": "浏览器内待办数据"
        }
      ],
      "steps": [
        {
          "id": "OSCN-delete-STEP-1",
          "source_ref": "OPAR-delete-user",
          "target_ref": "OPAR-delete-ui",
          "type": "call",
          "action": "悬停目标行并点击删除按钮。"
        },
        {
          "id": "OSCN-delete-STEP-2",
          "source_ref": "OPAR-delete-ui",
          "target_ref": "OPAR-delete-store",
          "type": "call",
          "action": "按被点击条目的身份执行移除。"
        },
        {
          "id": "OSCN-delete-STEP-3",
          "source_ref": "OPAR-delete-store",
          "type": "activity",
          "action": "按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。"
        },
        {
          "id": "OSCN-delete-STEP-4",
          "source_ref": "OPAR-delete-store",
          "target_ref": "OPAR-delete-storage",
          "type": "call",
          "action": "提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。"
        },
        {
          "id": "OSCN-delete-STEP-5",
          "source_ref": "OPAR-delete-storage",
          "target_ref": "OPAR-delete-saved",
          "type": "write",
          "action": "在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。"
        },
        {
          "id": "OSCN-delete-STEP-6",
          "source_ref": "OPAR-delete-storage",
          "target_ref": "OPAR-delete-store",
          "type": "return",
          "action": "返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。"
        },
        {
          "id": "OSCN-delete-STEP-7",
          "source_ref": "OPAR-delete-store",
          "target_ref": "OPAR-delete-ui",
          "type": "return",
          "action": "返回本次命令结果，界面保留当前筛选。"
        },
        {
          "id": "OSCN-delete-STEP-8",
          "source_ref": "OPAR-delete-ui",
          "target_ref": "OPAR-delete-store",
          "type": "call",
          "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
        },
        {
          "id": "OSCN-delete-STEP-9",
          "source_ref": "OPAR-delete-store",
          "target_ref": "OPAR-delete-ui",
          "type": "return",
          "action": "返回一致的展示快照。"
        },
        {
          "id": "OSCN-delete-STEP-10",
          "source_ref": "OPAR-delete-ui",
          "type": "activity",
          "action": "只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。"
        },
        {
          "type": "state",
          "description": "存储中该实现的最新清单与本次已提交结果一致。"
        }
      ]
    },
    {
      "id": "OSCN-complete-all",
      "status": "active",
      "description": "完成整份清单",
      "requirement_refs": [
        "SREQ-toggle-all",
        "SREQ-display",
        "SREQ-count",
        "SREQ-filter",
        "SREQ-persist"
      ],
      "initial_state": "清单非空，存在未完成待办。 本场景保存资源可用。",
      "participants": [
        {
          "id": "OPAR-complete-all-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-complete-all-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-complete-all-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        },
        {
          "id": "OPAR-complete-all-storage",
          "type": "module",
          "ref": "OMOD-storage",
          "name": "保存适配"
        },
        {
          "id": "OPAR-complete-all-saved",
          "type": "resource",
          "ref": "ORES-todo-data",
          "name": "浏览器内待办数据"
        }
      ],
      "steps": [
        {
          "id": "OSCN-complete-all-STEP-1",
          "source_ref": "OPAR-complete-all-user",
          "target_ref": "OPAR-complete-all-ui",
          "type": "call",
          "action": "把全选控件设为选中。"
        },
        {
          "id": "OSCN-complete-all-STEP-2",
          "source_ref": "OPAR-complete-all-ui",
          "target_ref": "OPAR-complete-all-store",
          "type": "call",
          "action": "把完整清单所有条目标为已完成。"
        },
        {
          "id": "OSCN-complete-all-STEP-3",
          "source_ref": "OPAR-complete-all-store",
          "type": "activity",
          "action": "按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。"
        },
        {
          "id": "OSCN-complete-all-STEP-4",
          "source_ref": "OPAR-complete-all-store",
          "target_ref": "OPAR-complete-all-storage",
          "type": "call",
          "action": "提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。"
        },
        {
          "id": "OSCN-complete-all-STEP-5",
          "source_ref": "OPAR-complete-all-storage",
          "target_ref": "OPAR-complete-all-saved",
          "type": "write",
          "action": "在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。"
        },
        {
          "id": "OSCN-complete-all-STEP-6",
          "source_ref": "OPAR-complete-all-storage",
          "target_ref": "OPAR-complete-all-store",
          "type": "return",
          "action": "返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。"
        },
        {
          "id": "OSCN-complete-all-STEP-7",
          "source_ref": "OPAR-complete-all-store",
          "target_ref": "OPAR-complete-all-ui",
          "type": "return",
          "action": "返回本次命令结果，界面保留当前筛选。"
        },
        {
          "id": "OSCN-complete-all-STEP-8",
          "source_ref": "OPAR-complete-all-ui",
          "target_ref": "OPAR-complete-all-store",
          "type": "call",
          "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
        },
        {
          "id": "OSCN-complete-all-STEP-9",
          "source_ref": "OPAR-complete-all-store",
          "target_ref": "OPAR-complete-all-ui",
          "type": "return",
          "action": "返回一致的展示快照。"
        },
        {
          "id": "OSCN-complete-all-STEP-10",
          "source_ref": "OPAR-complete-all-ui",
          "type": "activity",
          "action": "未完成数量为零，全选选中，所有标题和顺序保持。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "未完成数量为零，全选选中，所有标题和顺序保持。"
        },
        {
          "type": "state",
          "description": "存储中该实现的最新清单与本次已提交结果一致。"
        }
      ]
    },
    {
      "id": "OSCN-reopen-all",
      "status": "active",
      "description": "重新打开整份清单",
      "requirement_refs": [
        "SREQ-toggle-all",
        "SREQ-display",
        "SREQ-count",
        "SREQ-filter",
        "SREQ-persist"
      ],
      "initial_state": "清单非空且全选已选中。 本场景保存资源可用。",
      "participants": [
        {
          "id": "OPAR-reopen-all-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-reopen-all-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-reopen-all-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        },
        {
          "id": "OPAR-reopen-all-storage",
          "type": "module",
          "ref": "OMOD-storage",
          "name": "保存适配"
        },
        {
          "id": "OPAR-reopen-all-saved",
          "type": "resource",
          "ref": "ORES-todo-data",
          "name": "浏览器内待办数据"
        }
      ],
      "steps": [
        {
          "id": "OSCN-reopen-all-STEP-1",
          "source_ref": "OPAR-reopen-all-user",
          "target_ref": "OPAR-reopen-all-ui",
          "type": "call",
          "action": "取消全选控件。"
        },
        {
          "id": "OSCN-reopen-all-STEP-2",
          "source_ref": "OPAR-reopen-all-ui",
          "target_ref": "OPAR-reopen-all-store",
          "type": "call",
          "action": "把完整清单所有条目标为未完成。"
        },
        {
          "id": "OSCN-reopen-all-STEP-3",
          "source_ref": "OPAR-reopen-all-store",
          "type": "activity",
          "action": "按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。"
        },
        {
          "id": "OSCN-reopen-all-STEP-4",
          "source_ref": "OPAR-reopen-all-store",
          "target_ref": "OPAR-reopen-all-storage",
          "type": "call",
          "action": "提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。"
        },
        {
          "id": "OSCN-reopen-all-STEP-5",
          "source_ref": "OPAR-reopen-all-storage",
          "target_ref": "OPAR-reopen-all-saved",
          "type": "write",
          "action": "在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。"
        },
        {
          "id": "OSCN-reopen-all-STEP-6",
          "source_ref": "OPAR-reopen-all-storage",
          "target_ref": "OPAR-reopen-all-store",
          "type": "return",
          "action": "返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。"
        },
        {
          "id": "OSCN-reopen-all-STEP-7",
          "source_ref": "OPAR-reopen-all-store",
          "target_ref": "OPAR-reopen-all-ui",
          "type": "return",
          "action": "返回本次命令结果，界面保留当前筛选。"
        },
        {
          "id": "OSCN-reopen-all-STEP-8",
          "source_ref": "OPAR-reopen-all-ui",
          "target_ref": "OPAR-reopen-all-store",
          "type": "call",
          "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
        },
        {
          "id": "OSCN-reopen-all-STEP-9",
          "source_ref": "OPAR-reopen-all-store",
          "target_ref": "OPAR-reopen-all-ui",
          "type": "return",
          "action": "返回一致的展示快照。"
        },
        {
          "id": "OSCN-reopen-all-STEP-10",
          "source_ref": "OPAR-reopen-all-ui",
          "type": "activity",
          "action": "未完成数量等于完整清单总数，全选未选中，标题和顺序保持。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "未完成数量等于完整清单总数，全选未选中，标题和顺序保持。"
        },
        {
          "type": "state",
          "description": "存储中该实现的最新清单与本次已提交结果一致。"
        }
      ]
    },
    {
      "id": "OSCN-clear-completed",
      "status": "active",
      "description": "清除整份清单的已完成待办",
      "requirement_refs": [
        "SREQ-clear-completed",
        "SREQ-toggle-all",
        "SREQ-display",
        "SREQ-count",
        "SREQ-filter",
        "SREQ-persist"
      ],
      "initial_state": "完整清单存在已完成待办。 本场景保存资源可用。",
      "participants": [
        {
          "id": "OPAR-clear-completed-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-clear-completed-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-clear-completed-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        },
        {
          "id": "OPAR-clear-completed-storage",
          "type": "module",
          "ref": "OMOD-storage",
          "name": "保存适配"
        },
        {
          "id": "OPAR-clear-completed-saved",
          "type": "resource",
          "ref": "ORES-todo-data",
          "name": "浏览器内待办数据"
        }
      ],
      "steps": [
        {
          "id": "OSCN-clear-completed-STEP-1",
          "source_ref": "OPAR-clear-completed-user",
          "target_ref": "OPAR-clear-completed-ui",
          "type": "call",
          "action": "点击 Clear completed。"
        },
        {
          "id": "OSCN-clear-completed-STEP-2",
          "source_ref": "OPAR-clear-completed-ui",
          "target_ref": "OPAR-clear-completed-store",
          "type": "call",
          "action": "移除完整清单中全部已完成身份，保留未完成项。"
        },
        {
          "id": "OSCN-clear-completed-STEP-3",
          "source_ref": "OPAR-clear-completed-store",
          "type": "activity",
          "action": "按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。"
        },
        {
          "id": "OSCN-clear-completed-STEP-4",
          "source_ref": "OPAR-clear-completed-store",
          "target_ref": "OPAR-clear-completed-storage",
          "type": "call",
          "action": "提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。"
        },
        {
          "id": "OSCN-clear-completed-STEP-5",
          "source_ref": "OPAR-clear-completed-storage",
          "target_ref": "OPAR-clear-completed-saved",
          "type": "write",
          "action": "在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。"
        },
        {
          "id": "OSCN-clear-completed-STEP-6",
          "source_ref": "OPAR-clear-completed-storage",
          "target_ref": "OPAR-clear-completed-store",
          "type": "return",
          "action": "返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。"
        },
        {
          "id": "OSCN-clear-completed-STEP-7",
          "source_ref": "OPAR-clear-completed-store",
          "target_ref": "OPAR-clear-completed-ui",
          "type": "return",
          "action": "返回本次命令结果，界面保留当前筛选。"
        },
        {
          "id": "OSCN-clear-completed-STEP-8",
          "source_ref": "OPAR-clear-completed-ui",
          "target_ref": "OPAR-clear-completed-store",
          "type": "call",
          "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
        },
        {
          "id": "OSCN-clear-completed-STEP-9",
          "source_ref": "OPAR-clear-completed-store",
          "target_ref": "OPAR-clear-completed-ui",
          "type": "return",
          "action": "返回一致的展示快照。"
        },
        {
          "id": "OSCN-clear-completed-STEP-10",
          "source_ref": "OPAR-clear-completed-ui",
          "type": "activity",
          "action": "清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。"
        },
        {
          "type": "state",
          "description": "存储中该实现的最新清单与本次已提交结果一致。"
        }
      ]
    },
    {
      "id": "OSCN-select-filter",
      "status": "active",
      "description": "切换完成状态筛选",
      "requirement_refs": [
        "SREQ-filter",
        "SREQ-navigation",
        "SREQ-display"
      ],
      "initial_state": "用户在当前页面选择另一种筛选，已有清单保持。",
      "participants": [
        {
          "id": "OPAR-select-filter-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-select-filter-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-select-filter-router",
          "type": "module",
          "ref": "OMOD-router",
          "name": "筛选导航"
        },
        {
          "id": "OPAR-select-filter-history",
          "type": "resource",
          "ref": "ORES-navigation",
          "name": "地址与导航历史"
        },
        {
          "id": "OPAR-select-filter-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        }
      ],
      "steps": [
        {
          "id": "OSCN-select-filter-STEP-1",
          "source_ref": "OPAR-select-filter-user",
          "target_ref": "OPAR-select-filter-ui",
          "type": "call",
          "action": "点击一个筛选入口。"
        },
        {
          "id": "OSCN-select-filter-STEP-2",
          "source_ref": "OPAR-select-filter-ui",
          "target_ref": "OPAR-select-filter-router",
          "type": "call",
          "action": "请求选择 All、Active 或 Completed。"
        },
        {
          "id": "OSCN-select-filter-STEP-3",
          "source_ref": "OPAR-select-filter-router",
          "target_ref": "OPAR-select-filter-history",
          "type": "write",
          "action": "写入该选择对应的规范地址，并形成页面内导航记录。"
        },
        {
          "id": "OSCN-select-filter-STEP-4",
          "source_ref": "OPAR-select-filter-router",
          "target_ref": "OPAR-select-filter-ui",
          "type": "return",
          "action": "返回当前规范筛选值。"
        },
        {
          "id": "OSCN-select-filter-STEP-5",
          "source_ref": "OPAR-select-filter-ui",
          "target_ref": "OPAR-select-filter-store",
          "type": "call",
          "action": "按返回的筛选值读取展示快照。"
        },
        {
          "id": "OSCN-select-filter-STEP-6",
          "source_ref": "OPAR-select-filter-store",
          "target_ref": "OPAR-select-filter-ui",
          "type": "return",
          "action": "返回可见项及完整清单统计。"
        },
        {
          "id": "OSCN-select-filter-STEP-7",
          "source_ref": "OPAR-select-filter-ui",
          "type": "activity",
          "action": "同步选中入口和可见列表，保持待办内容及顺序。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "地址、选中入口和可见列表表达同一种筛选，完整清单保持不变。"
        }
      ]
    },
    {
      "id": "OSCN-complete-in-active",
      "status": "active",
      "description": "在 Active 中完成待办",
      "requirement_refs": [
        "SREQ-filter",
        "SREQ-toggle",
        "SREQ-display",
        "SREQ-count",
        "SREQ-persist"
      ],
      "initial_state": "当前为 Active，目标待办未完成。 本场景保存资源可用。",
      "participants": [
        {
          "id": "OPAR-complete-in-active-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-complete-in-active-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-complete-in-active-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        },
        {
          "id": "OPAR-complete-in-active-storage",
          "type": "module",
          "ref": "OMOD-storage",
          "name": "保存适配"
        },
        {
          "id": "OPAR-complete-in-active-saved",
          "type": "resource",
          "ref": "ORES-todo-data",
          "name": "浏览器内待办数据"
        }
      ],
      "steps": [
        {
          "id": "OSCN-complete-in-active-STEP-1",
          "source_ref": "OPAR-complete-in-active-user",
          "target_ref": "OPAR-complete-in-active-ui",
          "type": "call",
          "action": "勾选当前可见目标。"
        },
        {
          "id": "OSCN-complete-in-active-STEP-2",
          "source_ref": "OPAR-complete-in-active-ui",
          "target_ref": "OPAR-complete-in-active-store",
          "type": "call",
          "action": "按原身份设为已完成，不修改筛选选择。"
        },
        {
          "id": "OSCN-complete-in-active-STEP-3",
          "source_ref": "OPAR-complete-in-active-store",
          "type": "activity",
          "action": "按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。"
        },
        {
          "id": "OSCN-complete-in-active-STEP-4",
          "source_ref": "OPAR-complete-in-active-store",
          "target_ref": "OPAR-complete-in-active-storage",
          "type": "call",
          "action": "提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。"
        },
        {
          "id": "OSCN-complete-in-active-STEP-5",
          "source_ref": "OPAR-complete-in-active-storage",
          "target_ref": "OPAR-complete-in-active-saved",
          "type": "write",
          "action": "在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。"
        },
        {
          "id": "OSCN-complete-in-active-STEP-6",
          "source_ref": "OPAR-complete-in-active-storage",
          "target_ref": "OPAR-complete-in-active-store",
          "type": "return",
          "action": "返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。"
        },
        {
          "id": "OSCN-complete-in-active-STEP-7",
          "source_ref": "OPAR-complete-in-active-store",
          "target_ref": "OPAR-complete-in-active-ui",
          "type": "return",
          "action": "返回本次命令结果，界面保留当前筛选。"
        },
        {
          "id": "OSCN-complete-in-active-STEP-8",
          "source_ref": "OPAR-complete-in-active-ui",
          "target_ref": "OPAR-complete-in-active-store",
          "type": "call",
          "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
        },
        {
          "id": "OSCN-complete-in-active-STEP-9",
          "source_ref": "OPAR-complete-in-active-store",
          "target_ref": "OPAR-complete-in-active-ui",
          "type": "return",
          "action": "返回一致的展示快照。"
        },
        {
          "id": "OSCN-complete-in-active-STEP-10",
          "source_ref": "OPAR-complete-in-active-ui",
          "type": "activity",
          "action": "目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。"
        },
        {
          "type": "state",
          "description": "存储中该实现的最新清单与本次已提交结果一致。"
        }
      ]
    },
    {
      "id": "OSCN-reopen-in-completed",
      "status": "active",
      "description": "在 Completed 中重新打开待办",
      "requirement_refs": [
        "SREQ-filter",
        "SREQ-toggle",
        "SREQ-display",
        "SREQ-count",
        "SREQ-persist"
      ],
      "initial_state": "当前为 Completed，目标待办已完成。 本场景保存资源可用。",
      "participants": [
        {
          "id": "OPAR-reopen-in-completed-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-reopen-in-completed-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-reopen-in-completed-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        },
        {
          "id": "OPAR-reopen-in-completed-storage",
          "type": "module",
          "ref": "OMOD-storage",
          "name": "保存适配"
        },
        {
          "id": "OPAR-reopen-in-completed-saved",
          "type": "resource",
          "ref": "ORES-todo-data",
          "name": "浏览器内待办数据"
        }
      ],
      "steps": [
        {
          "id": "OSCN-reopen-in-completed-STEP-1",
          "source_ref": "OPAR-reopen-in-completed-user",
          "target_ref": "OPAR-reopen-in-completed-ui",
          "type": "call",
          "action": "取消当前可见目标的勾选。"
        },
        {
          "id": "OSCN-reopen-in-completed-STEP-2",
          "source_ref": "OPAR-reopen-in-completed-ui",
          "target_ref": "OPAR-reopen-in-completed-store",
          "type": "call",
          "action": "按原身份设为未完成，不修改筛选选择。"
        },
        {
          "id": "OSCN-reopen-in-completed-STEP-3",
          "source_ref": "OPAR-reopen-in-completed-store",
          "type": "activity",
          "action": "按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。"
        },
        {
          "id": "OSCN-reopen-in-completed-STEP-4",
          "source_ref": "OPAR-reopen-in-completed-store",
          "target_ref": "OPAR-reopen-in-completed-storage",
          "type": "call",
          "action": "提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。"
        },
        {
          "id": "OSCN-reopen-in-completed-STEP-5",
          "source_ref": "OPAR-reopen-in-completed-storage",
          "target_ref": "OPAR-reopen-in-completed-saved",
          "type": "write",
          "action": "在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。"
        },
        {
          "id": "OSCN-reopen-in-completed-STEP-6",
          "source_ref": "OPAR-reopen-in-completed-storage",
          "target_ref": "OPAR-reopen-in-completed-store",
          "type": "return",
          "action": "返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。"
        },
        {
          "id": "OSCN-reopen-in-completed-STEP-7",
          "source_ref": "OPAR-reopen-in-completed-store",
          "target_ref": "OPAR-reopen-in-completed-ui",
          "type": "return",
          "action": "返回本次命令结果，界面保留当前筛选。"
        },
        {
          "id": "OSCN-reopen-in-completed-STEP-8",
          "source_ref": "OPAR-reopen-in-completed-ui",
          "target_ref": "OPAR-reopen-in-completed-store",
          "type": "call",
          "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
        },
        {
          "id": "OSCN-reopen-in-completed-STEP-9",
          "source_ref": "OPAR-reopen-in-completed-store",
          "target_ref": "OPAR-reopen-in-completed-ui",
          "type": "return",
          "action": "返回一致的展示快照。"
        },
        {
          "id": "OSCN-reopen-in-completed-STEP-10",
          "source_ref": "OPAR-reopen-in-completed-ui",
          "type": "activity",
          "action": "目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。"
        },
        {
          "type": "state",
          "description": "存储中该实现的最新清单与本次已提交结果一致。"
        }
      ]
    },
    {
      "id": "OSCN-create-in-completed",
      "status": "active",
      "description": "在 Completed 中新增未完成待办",
      "requirement_refs": [
        "SREQ-create",
        "SREQ-filter",
        "SREQ-count",
        "SREQ-display",
        "SREQ-persist"
      ],
      "initial_state": "当前为 Completed，新增草稿有效。 本场景保存资源可用。",
      "participants": [
        {
          "id": "OPAR-create-in-completed-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-create-in-completed-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-create-in-completed-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        },
        {
          "id": "OPAR-create-in-completed-storage",
          "type": "module",
          "ref": "OMOD-storage",
          "name": "保存适配"
        },
        {
          "id": "OPAR-create-in-completed-saved",
          "type": "resource",
          "ref": "ORES-todo-data",
          "name": "浏览器内待办数据"
        }
      ],
      "steps": [
        {
          "id": "OSCN-create-in-completed-STEP-1",
          "source_ref": "OPAR-create-in-completed-user",
          "target_ref": "OPAR-create-in-completed-ui",
          "type": "call",
          "action": "按 Enter 提交新增标题。"
        },
        {
          "id": "OSCN-create-in-completed-STEP-2",
          "source_ref": "OPAR-create-in-completed-ui",
          "target_ref": "OPAR-create-in-completed-store",
          "type": "call",
          "action": "创建新的未完成身份并追加到完整清单末尾。"
        },
        {
          "id": "OSCN-create-in-completed-STEP-3",
          "source_ref": "OPAR-create-in-completed-store",
          "type": "activity",
          "action": "按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。"
        },
        {
          "id": "OSCN-create-in-completed-STEP-4",
          "source_ref": "OPAR-create-in-completed-store",
          "target_ref": "OPAR-create-in-completed-storage",
          "type": "call",
          "action": "提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。"
        },
        {
          "id": "OSCN-create-in-completed-STEP-5",
          "source_ref": "OPAR-create-in-completed-storage",
          "target_ref": "OPAR-create-in-completed-saved",
          "type": "write",
          "action": "在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。"
        },
        {
          "id": "OSCN-create-in-completed-STEP-6",
          "source_ref": "OPAR-create-in-completed-storage",
          "target_ref": "OPAR-create-in-completed-store",
          "type": "return",
          "action": "返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。"
        },
        {
          "id": "OSCN-create-in-completed-STEP-7",
          "source_ref": "OPAR-create-in-completed-store",
          "target_ref": "OPAR-create-in-completed-ui",
          "type": "return",
          "action": "返回本次命令结果，界面保留当前筛选。"
        },
        {
          "id": "OSCN-create-in-completed-STEP-8",
          "source_ref": "OPAR-create-in-completed-ui",
          "target_ref": "OPAR-create-in-completed-store",
          "type": "call",
          "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
        },
        {
          "id": "OSCN-create-in-completed-STEP-9",
          "source_ref": "OPAR-create-in-completed-store",
          "target_ref": "OPAR-create-in-completed-ui",
          "type": "return",
          "action": "返回一致的展示快照。"
        },
        {
          "id": "OSCN-create-in-completed-STEP-10",
          "source_ref": "OPAR-create-in-completed-ui",
          "type": "activity",
          "action": "新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。"
        },
        {
          "type": "state",
          "description": "存储中该实现的最新清单与本次已提交结果一致。"
        }
      ]
    },
    {
      "id": "OSCN-clear-hidden-completed",
      "status": "active",
      "description": "在 Active 中清除隐藏的已完成项",
      "requirement_refs": [
        "SREQ-filter",
        "SREQ-clear-completed",
        "SREQ-count",
        "SREQ-display",
        "SREQ-persist"
      ],
      "initial_state": "当前为 Active，完整清单有已完成项。 本场景保存资源可用。",
      "participants": [
        {
          "id": "OPAR-clear-hidden-completed-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-clear-hidden-completed-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-clear-hidden-completed-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        },
        {
          "id": "OPAR-clear-hidden-completed-storage",
          "type": "module",
          "ref": "OMOD-storage",
          "name": "保存适配"
        },
        {
          "id": "OPAR-clear-hidden-completed-saved",
          "type": "resource",
          "ref": "ORES-todo-data",
          "name": "浏览器内待办数据"
        }
      ],
      "steps": [
        {
          "id": "OSCN-clear-hidden-completed-STEP-1",
          "source_ref": "OPAR-clear-hidden-completed-user",
          "target_ref": "OPAR-clear-hidden-completed-ui",
          "type": "call",
          "action": "点击仍然可见的 Clear completed。"
        },
        {
          "id": "OSCN-clear-hidden-completed-STEP-2",
          "source_ref": "OPAR-clear-hidden-completed-ui",
          "target_ref": "OPAR-clear-hidden-completed-store",
          "type": "call",
          "action": "从完整清单选择并移除全部已完成身份，包括当前看不到的项。"
        },
        {
          "id": "OSCN-clear-hidden-completed-STEP-3",
          "source_ref": "OPAR-clear-hidden-completed-store",
          "type": "activity",
          "action": "按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。"
        },
        {
          "id": "OSCN-clear-hidden-completed-STEP-4",
          "source_ref": "OPAR-clear-hidden-completed-store",
          "target_ref": "OPAR-clear-hidden-completed-storage",
          "type": "call",
          "action": "提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。"
        },
        {
          "id": "OSCN-clear-hidden-completed-STEP-5",
          "source_ref": "OPAR-clear-hidden-completed-storage",
          "target_ref": "OPAR-clear-hidden-completed-saved",
          "type": "write",
          "action": "在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。"
        },
        {
          "id": "OSCN-clear-hidden-completed-STEP-6",
          "source_ref": "OPAR-clear-hidden-completed-storage",
          "target_ref": "OPAR-clear-hidden-completed-store",
          "type": "return",
          "action": "返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。"
        },
        {
          "id": "OSCN-clear-hidden-completed-STEP-7",
          "source_ref": "OPAR-clear-hidden-completed-store",
          "target_ref": "OPAR-clear-hidden-completed-ui",
          "type": "return",
          "action": "返回本次命令结果，界面保留当前筛选。"
        },
        {
          "id": "OSCN-clear-hidden-completed-STEP-8",
          "source_ref": "OPAR-clear-hidden-completed-ui",
          "target_ref": "OPAR-clear-hidden-completed-store",
          "type": "call",
          "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
        },
        {
          "id": "OSCN-clear-hidden-completed-STEP-9",
          "source_ref": "OPAR-clear-hidden-completed-store",
          "target_ref": "OPAR-clear-hidden-completed-ui",
          "type": "return",
          "action": "返回一致的展示快照。"
        },
        {
          "id": "OSCN-clear-hidden-completed-STEP-10",
          "source_ref": "OPAR-clear-hidden-completed-ui",
          "type": "activity",
          "action": "隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。"
        },
        {
          "type": "state",
          "description": "存储中该实现的最新清单与本次已提交结果一致。"
        }
      ]
    },
    {
      "id": "OSCN-history-back",
      "status": "active",
      "description": "浏览器后退同步筛选",
      "requirement_refs": [
        "SREQ-navigation",
        "SREQ-filter"
      ],
      "initial_state": "已从 All 导航到 Active 再到 Completed。",
      "participants": [
        {
          "id": "OPAR-history-back-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-history-back-history",
          "type": "resource",
          "ref": "ORES-navigation",
          "name": "地址与导航历史"
        },
        {
          "id": "OPAR-history-back-router",
          "type": "module",
          "ref": "OMOD-router",
          "name": "筛选导航"
        },
        {
          "id": "OPAR-history-back-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-history-back-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        }
      ],
      "steps": [
        {
          "id": "OSCN-history-back-STEP-1",
          "source_ref": "OPAR-history-back-user",
          "target_ref": "OPAR-history-back-history",
          "type": "call",
          "action": "使用浏览器后退。"
        },
        {
          "id": "OSCN-history-back-STEP-2",
          "source_ref": "OPAR-history-back-history",
          "target_ref": "OPAR-history-back-router",
          "type": "event",
          "action": "当前地址按已有历史发生变化。"
        },
        {
          "id": "OSCN-history-back-STEP-3",
          "source_ref": "OPAR-history-back-router",
          "target_ref": "OPAR-history-back-history",
          "type": "read",
          "action": "读取变化后的地址，解析规范筛选，不写入额外历史。"
        },
        {
          "id": "OSCN-history-back-STEP-4",
          "source_ref": "OPAR-history-back-router",
          "target_ref": "OPAR-history-back-ui",
          "type": "event",
          "action": "发布变化后的规范筛选。"
        },
        {
          "id": "OSCN-history-back-STEP-5",
          "source_ref": "OPAR-history-back-ui",
          "target_ref": "OPAR-history-back-store",
          "type": "call",
          "action": "按新的选择读取展示投影。"
        },
        {
          "id": "OSCN-history-back-STEP-6",
          "source_ref": "OPAR-history-back-store",
          "target_ref": "OPAR-history-back-ui",
          "type": "return",
          "action": "返回匹配列表与完整清单统计。"
        },
        {
          "id": "OSCN-history-back-STEP-7",
          "source_ref": "OPAR-history-back-ui",
          "type": "activity",
          "action": "同步唯一选中入口与列表，保留本页清单。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "历史位置、地址、选中项和展示列表一致，待办内容与顺序保持。"
        }
      ]
    },
    {
      "id": "OSCN-history-forward",
      "status": "active",
      "description": "浏览器前进同步筛选",
      "requirement_refs": [
        "SREQ-navigation",
        "SREQ-filter"
      ],
      "initial_state": "已按历史退回 All，前方有 Active、Completed 记录。",
      "participants": [
        {
          "id": "OPAR-history-forward-user",
          "type": "actor",
          "name": "用户"
        },
        {
          "id": "OPAR-history-forward-history",
          "type": "resource",
          "ref": "ORES-navigation",
          "name": "地址与导航历史"
        },
        {
          "id": "OPAR-history-forward-router",
          "type": "module",
          "ref": "OMOD-router",
          "name": "筛选导航"
        },
        {
          "id": "OPAR-history-forward-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-history-forward-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        }
      ],
      "steps": [
        {
          "id": "OSCN-history-forward-STEP-1",
          "source_ref": "OPAR-history-forward-user",
          "target_ref": "OPAR-history-forward-history",
          "type": "call",
          "action": "使用浏览器前进。"
        },
        {
          "id": "OSCN-history-forward-STEP-2",
          "source_ref": "OPAR-history-forward-history",
          "target_ref": "OPAR-history-forward-router",
          "type": "event",
          "action": "当前地址按已有历史发生变化。"
        },
        {
          "id": "OSCN-history-forward-STEP-3",
          "source_ref": "OPAR-history-forward-router",
          "target_ref": "OPAR-history-forward-history",
          "type": "read",
          "action": "读取变化后的地址，解析规范筛选，不写入额外历史。"
        },
        {
          "id": "OSCN-history-forward-STEP-4",
          "source_ref": "OPAR-history-forward-router",
          "target_ref": "OPAR-history-forward-ui",
          "type": "event",
          "action": "发布变化后的规范筛选。"
        },
        {
          "id": "OSCN-history-forward-STEP-5",
          "source_ref": "OPAR-history-forward-ui",
          "target_ref": "OPAR-history-forward-store",
          "type": "call",
          "action": "按新的选择读取展示投影。"
        },
        {
          "id": "OSCN-history-forward-STEP-6",
          "source_ref": "OPAR-history-forward-store",
          "target_ref": "OPAR-history-forward-ui",
          "type": "return",
          "action": "返回匹配列表与完整清单统计。"
        },
        {
          "id": "OSCN-history-forward-STEP-7",
          "source_ref": "OPAR-history-forward-ui",
          "type": "activity",
          "action": "同步唯一选中入口与列表，保留本页清单。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "历史位置、地址、选中项和展示列表一致，待办内容与顺序保持。"
        }
      ]
    },
    {
      "id": "OSCN-show-empty-information",
      "status": "active",
      "description": "空清单仍显示帮助与归属",
      "requirement_refs": [
        "SREQ-display",
        "SREQ-information"
      ],
      "initial_state": "完整清单没有待办。",
      "participants": [
        {
          "id": "OPAR-show-empty-information-ui",
          "type": "module",
          "ref": "OMOD-ui",
          "name": "页面交互"
        },
        {
          "id": "OPAR-show-empty-information-store",
          "type": "module",
          "ref": "OMOD-store",
          "name": "清单状态"
        }
      ],
      "steps": [
        {
          "id": "OSCN-show-empty-information-STEP-1",
          "source_ref": "OPAR-show-empty-information-ui",
          "target_ref": "OPAR-show-empty-information-store",
          "type": "call",
          "action": "读取完整清单派生的空状态。"
        },
        {
          "id": "OSCN-show-empty-information-STEP-2",
          "source_ref": "OPAR-show-empty-information-store",
          "target_ref": "OPAR-show-empty-information-ui",
          "type": "return",
          "action": "返回清单为空的展示快照。"
        },
        {
          "id": "OSCN-show-empty-information-STEP-3",
          "source_ref": "OPAR-show-empty-information-ui",
          "type": "activity",
          "action": "隐藏清单主体与操作页脚，保留标题、新增入口，以及可见性条件之外的编辑提示、作者或团队和项目链接。"
        }
      ],
      "outcomes": [
        {
          "type": "state",
          "description": "完整清单为空时仍可新增并阅读帮助归属信息，布局保持已定义风格。"
        }
      ]
    }
  ],
  "concepts": [
    {
      "id": "OCON-todo-state",
      "name": "清单身份与状态",
      "status": "active",
      "definition": "本页完整清单是待办内容的唯一业务状态；每条由身份、标题、完成状态和加入位置构成。",
      "rules": [
        {
          "id": "OCON-todo-state-RULE-1",
          "description": "新待办由状态模块生成身份，以未完成状态加入末尾。"
        },
        {
          "id": "OCON-todo-state-RULE-2",
          "description": "新增框草稿由页面持有，只有 Enter 形成新增命令。"
        },
        {
          "id": "OCON-todo-state-RULE-3",
          "description": "新增标题在命令边界仅去除首尾空白并保留中间空格；整理后为空则拒绝，拒绝不改变清单。"
        },
        {
          "id": "OCON-todo-state-RULE-4",
          "description": "身份独立于标题和列表下标；同名条目可并存，后续命令按身份定位，不能批量误改同名项。"
        },
        {
          "id": "OCON-todo-state-RULE-5",
          "description": "完成状态只有未完成与已完成，勾选使未完成转为已完成，取消勾选反向转换；转换保留身份、标题和位置。"
        },
        {
          "id": "OCON-todo-state-RULE-6",
          "description": "有效编辑提交空标题时，未完成或已完成待办均可转为已移除；只移除目标身份，其余条目的内容和相对顺序保留。已移除条目不再参与本页展示和统计。"
        },
        {
          "id": "OCON-todo-state-RULE-7",
          "description": "直接删除与空标题提交复用身份移除语义，未完成与已完成都可转为已移除；页面只负责将悬停行的身份交给状态模块。"
        },
        {
          "id": "OCON-todo-state-RULE-8",
          "description": "全选把完整清单所有身份统一设为已完成，全部取消统一设为未完成；批量命令只修改完成状态，保持身份、标题和位置。"
        },
        {
          "id": "OCON-todo-state-RULE-9",
          "description": "清除已完成将完整清单中的已完成条目转为已移除；未完成条目的身份、内容和顺序不变。"
        }
      ],
      "scope_refs": [
        "OMOD-store",
        "OMOD-ui"
      ],
      "requirement_refs": [
        "SREQ-create",
        "SREQ-toggle",
        "SREQ-edit",
        "SREQ-delete",
        "SREQ-toggle-all",
        "SREQ-clear-completed"
      ],
      "record_refs": [
        "RUN-todomvc-spec-02",
        "RUN-todomvc-spec-03",
        "RUN-todomvc-spec-05",
        "RUN-todomvc-spec-10",
        "RUN-todomvc-spec-11",
        "RUN-todomvc-spec-12",
        "RUN-todomvc-spec-13"
      ]
    },
    {
      "id": "OCON-projection",
      "name": "清单展示投影",
      "status": "active",
      "definition": "展示值由完整清单派生，界面只消费一致快照；区域可见性与待办顺序不是另存的一份业务状态。",
      "rules": [
        {
          "id": "OCON-projection-RULE-1",
          "description": "按加入先后读取条目，改名或切换完成状态不改变已有位置。"
        },
        {
          "id": "OCON-projection-RULE-2",
          "description": "完整清单长度为零时隐藏主体、全选及操作页脚，标题和新增入口保留；从零变一或从一变零时同步切换。"
        },
        {
          "id": "OCON-projection-RULE-3",
          "description": "一个有效 Enter 命令只创建一项；命令和界面显示分离，重绘不重新创建待办。"
        },
        {
          "id": "OCON-projection-RULE-4",
          "description": "未完成数量从完整清单的未完成条目计数得出，不单独累计计数器；数字加粗由页面呈现，1 使用 item，其余使用 items。非空且全部完成时仍显示零。"
        },
        {
          "id": "OCON-projection-RULE-5",
          "description": "全选选中值为清单非空且所有条目均完成；从同一快照派生，不另存可漂移的全选布尔值。"
        },
        {
          "id": "OCON-projection-RULE-6",
          "description": "是否显示 Clear completed 从完整清单是否存在已完成项派生；清除后重新计算全选与空状态，空清单不残留选中值。"
        },
        {
          "id": "OCON-projection-RULE-7",
          "description": "完整清单为空与当前筛选可见集合为空是两个不同条件；仅可见集合为空时保留主体中的全选、计数及筛选入口，不误触发整体空清单布局。"
        },
        {
          "id": "OCON-projection-RULE-8",
          "description": "未完成计数、全选选中值与 Clear completed 显隐始终基于完整清单；投影筛选只作用于可见行集合。"
        }
      ],
      "scope_refs": [
        "OMOD-ui",
        "OMOD-store"
      ],
      "requirement_refs": [
        "SREQ-display",
        "SREQ-create",
        "SREQ-count",
        "SREQ-toggle-all",
        "SREQ-clear-completed",
        "SREQ-filter"
      ],
      "record_refs": [
        "RUN-todomvc-spec-04",
        "RUN-todomvc-spec-06",
        "RUN-todomvc-spec-12",
        "RUN-todomvc-spec-13",
        "RUN-todomvc-spec-14",
        "RUN-todomvc-spec-16",
        "RUN-todomvc-spec-17"
      ]
    },
    {
      "id": "OCON-edit-session",
      "name": "编辑会话与已提交内容",
      "status": "active",
      "definition": "编辑会话属于页面临时状态，引用目标待办身份，保存进入编辑前的标题和当前草稿；清单仍保留已提交内容。",
      "rules": [
        {
          "id": "OCON-edit-session-RULE-1",
          "description": "双击任意完成状态的标题，从展示状态进入编辑状态；草稿以已提交标题初始化，编辑框获得焦点。"
        },
        {
          "id": "OCON-edit-session-RULE-2",
          "description": "编辑会话以待办身份绑定该行；页面隐藏该行原展示及完成、删除控件，不影响其他行。"
        },
        {
          "id": "OCON-edit-session-RULE-3",
          "description": "草稿变化不直接写回清单，不改变已提交身份、标题、完成状态或位置。"
        },
        {
          "id": "OCON-edit-session-RULE-4",
          "description": "Enter 与失焦共用一个提交入口；处理事件时先关闭当前会话，再分发一次命令；关闭后来自该会话的失焦或重复 Enter 不再提交。"
        },
        {
          "id": "OCON-edit-session-RULE-5",
          "description": "非空草稿提交时仅去除首尾空白并保留中间空格；按原身份替换标题，保持完成状态和位置，完成后返回展示状态。"
        },
        {
          "id": "OCON-edit-session-RULE-6",
          "description": "Escape 先关闭会话并丢弃草稿，返回展示状态且不发送清单变更；草稿为空也保留原待办，随后失焦因会话已结束而被忽略。"
        },
        {
          "id": "OCON-edit-session-RULE-7",
          "description": "有效会话通过 Enter 或失焦提交整理后为空的标题时，在关闭会话后发送按身份删除命令；此分支进入条目已移除状态。Escape 始终走取消分支。"
        }
      ],
      "scope_refs": [
        "OMOD-ui",
        "OMOD-store"
      ],
      "requirement_refs": [
        "SREQ-edit"
      ],
      "record_refs": [
        "RUN-todomvc-spec-07",
        "RUN-todomvc-spec-08",
        "RUN-todomvc-spec-09",
        "RUN-todomvc-spec-10"
      ]
    },
    {
      "id": "OCON-filter-selection",
      "name": "筛选选择与清单分离",
      "status": "active",
      "definition": "当前筛选是选择 All、Active、Completed 的展示状态，不是独立清单，也不是待办属性。",
      "rules": [
        {
          "id": "OCON-filter-selection-RULE-1",
          "description": "All 选择全部身份，Active 选择未完成身份，Completed 选择已完成身份；匹配逻辑集中在清单状态的展示投影能力。"
        },
        {
          "id": "OCON-filter-selection-RULE-2",
          "description": "切换筛选只改变选择值，不改变待办内容、状态和加入顺序；可见项保留在完整清单中的相对顺序。"
        },
        {
          "id": "OCON-filter-selection-RULE-3",
          "description": "页面显示唯一选中项，把选择值传给投影能力，不自行复制维护三份清单。"
        },
        {
          "id": "OCON-filter-selection-RULE-4",
          "description": "任何有效清单变更后，页面保留当前选择并重新请求投影；完成状态变更可使目标离开当前视图，但不产生移动或复制待办命令。"
        },
        {
          "id": "OCON-filter-selection-RULE-5",
          "description": "Completed 中新增仍创建未完成身份，追加到完整清单；当前投影可以看不到它，完整未完成计数仍增加，选择不变。"
        },
        {
          "id": "OCON-filter-selection-RULE-6",
          "description": "全选和清除命令不接收可见条目集合，而由状态模块从完整清单选择受影响身份；隐藏项同样参与。"
        },
        {
          "id": "OCON-filter-selection-RULE-7",
          "description": "导航模块成为规范筛选选择的来源；页面可以持有展示副本，但必须与地址解析结果同步，清单模块只实现筛选匹配。"
        },
        {
          "id": "OCON-filter-selection-RULE-8",
          "description": "浏览器前进或后退时，只解析历史指向的当前地址并通知页面，不再写入一条新历史；点击切换与外部历史变化必须区分。"
        }
      ],
      "scope_refs": [
        "OMOD-ui",
        "OMOD-store",
        "OMOD-router"
      ],
      "requirement_refs": [
        "SREQ-filter",
        "SREQ-edit",
        "SREQ-toggle",
        "SREQ-count",
        "SREQ-toggle-all",
        "SREQ-clear-completed",
        "SREQ-navigation"
      ],
      "record_refs": [
        "RUN-todomvc-spec-14",
        "RUN-todomvc-spec-15",
        "RUN-todomvc-spec-16",
        "RUN-todomvc-spec-17",
        "RUN-todomvc-spec-18",
        "RUN-todomvc-spec-19"
      ]
    },
    {
      "id": "OCON-commit-boundary",
      "name": "业务提交与保存边界",
      "status": "active",
      "definition": "保存由业务清单的有效变更驱动，保存目标是当前实现的完整已提交快照。",
      "rules": [
        {
          "id": "OCON-commit-boundary-RULE-1",
          "description": "清单命令统一经过保存适配，界面重绘不作为保存触发器。"
        },
        {
          "id": "OCON-commit-boundary-RULE-2",
          "description": "保存适配返回真实成功或失败；失败不能作为已经保存成功继续报告。"
        },
        {
          "id": "OCON-commit-boundary-RULE-3",
          "description": "保存空间的实现名称在当前实现内保持一致，与其他实现隔离。"
        },
        {
          "id": "OCON-commit-boundary-RULE-4",
          "description": "有效命令及快照保存按提交顺序处理，后一次提交的存储结果不得被较早提交的迟到写入覆盖。"
        },
        {
          "id": "OCON-commit-boundary-RULE-5",
          "description": "保存投影保留每条的独立身份、整理后的标题、完成状态和加入顺序；改名更新同一身份，删除以最新快照中不再包含该身份表达，删除最后一项写入空清单。"
        },
        {
          "id": "OCON-commit-boundary-RULE-6",
          "description": "保存投影从完整已提交清单生成，不从可见列表或界面状态生成；隐藏项保留，新增草稿、无效空新增、编辑草稿及编辑状态一律不进入快照。"
        },
        {
          "id": "OCON-commit-boundary-RULE-7",
          "description": "Escape 取消和无效新增不形成提交；其他有效命令触发保存时，也只能取得已提交内容，不能夹带正在编辑的草稿。"
        },
        {
          "id": "OCON-commit-boundary-RULE-8",
          "description": "页面初始化、刷新、地址选择和首次重绘都不是清单有效变更；不因未恢复显示或本页初始清单为空而向存储写空。有效删除最后一项与初始化为空必须区分。"
        }
      ],
      "scope_refs": [
        "OMOD-store",
        "OMOD-storage"
      ],
      "requirement_refs": [
        "SREQ-persist",
        "SREQ-create",
        "SREQ-edit",
        "SREQ-toggle",
        "SREQ-toggle-all",
        "SREQ-delete",
        "SREQ-clear-completed"
      ],
      "constraint_refs": [
        "SCON-local-storage"
      ],
      "record_refs": [
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "OCON-plain-text",
      "name": "标题的文本语义",
      "status": "active",
      "definition": "标题在业务与保存中保持用户文本语义，页面通过文本呈现能力展示，不能把标题作为标记或执行内容。",
      "rules": [
        {
          "id": "OCON-plain-text-RULE-1",
          "description": "新增与编辑提交只做已规定的首尾空白处理；中间内容、标记字符和普通字符保持一致。"
        },
        {
          "id": "OCON-plain-text-RULE-2",
          "description": "页面的标题展示和编辑值绑定使用文本边界，不将标题送入可解释标记或可执行内容的通道。"
        },
        {
          "id": "OCON-plain-text-RULE-3",
          "description": "保存适配序列化用户文本而不做标记展开或内容改写，读写转换不得改变标题语义。"
        }
      ],
      "scope_refs": [
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage"
      ],
      "requirement_refs": [
        "SREQ-display",
        "SREQ-create",
        "SREQ-edit",
        "SREQ-persist"
      ],
      "constraint_refs": [
        "SCON-plain-text"
      ],
      "record_refs": [
        "RUN-todomvc-spec-23"
      ]
    },
    {
      "id": "OCON-presentation",
      "name": "统一呈现规则",
      "status": "active",
      "definition": "页面模块统一维护布局与状态样式；视觉规则消费业务投影，不另建一套改变业务结果的状态。",
      "rules": [
        {
          "id": "OCON-presentation-RULE-1",
          "description": "外层浅灰背景承载居中单列白色卡片，使用受约束的内容宽度，窄屏随可用空间收缩，不产生横向滚动。"
        },
        {
          "id": "OCON-presentation-RULE-2",
          "description": "todos 位于卡片上方居中，以明显较大的细体淡红字建立层级；布局样式与清单是否为空分开处理。"
        },
        {
          "id": "OCON-presentation-RULE-3",
          "description": "新增框置于卡片顶部，与清单共享可用宽度；使用大字、浅灰斜体提示和可见焦点状态，焦点样式不改变数据。"
        },
        {
          "id": "OCON-presentation-RULE-4",
          "description": "待办行使用一致留白与细灰分隔线；标题区域可换行，两侧操作区域预留空间，长标题不能覆盖控件。"
        },
        {
          "id": "OCON-presentation-RULE-5",
          "description": "左侧圆形完成控件与标题样式都由同一完成值驱动：未完成深色标题，完成为绿色勾和浅灰删除线，避免控件与文字状态不一致。"
        },
        {
          "id": "OCON-presentation-RULE-6",
          "description": "右侧删除控件区域固定占位，非悬停隐藏、悬停显示淡红叉号；显隐不挤动标题或其他控件。"
        },
        {
          "id": "OCON-presentation-RULE-7",
          "description": "编辑会话在原标题区域切换为尺寸协调、边框清晰、焦点可见的输入框；编辑态隐藏原展示和两侧完成、删除控件。"
        },
        {
          "id": "OCON-presentation-RULE-8",
          "description": "操作页脚采用稳定的左计数、中筛选、右清除布局；选中项用细淡红圆角边框，按钮显隐和筛选切换不使整排明显跳动。"
        },
        {
          "id": "OCON-presentation-RULE-9",
          "description": "卡片外帮助和归属位于清单主体及操作页脚的可见性条件之外，始终以居中小号浅灰文字显示 Double-click to edit a todo、实现作者或团队，以及 Part of TodoMVC 链接；链接指向 https://todomvc.com/，作者由实现填写。"
        },
        {
          "id": "OCON-presentation-RULE-10",
          "description": "卡片阴影与底部叠纸效果为可选轻量装饰，遵守本轮 Specification 的可选语义，不升级为必需业务能力。"
        }
      ],
      "scope_refs": [
        "OMOD-ui"
      ],
      "requirement_refs": [
        "SREQ-display",
        "SREQ-create",
        "SREQ-toggle",
        "SREQ-delete",
        "SREQ-edit",
        "SREQ-information",
        "SREQ-filter",
        "SREQ-count",
        "SREQ-clear-completed"
      ],
      "constraint_refs": [
        "SCON-visual-layout",
        "SCON-consistent-behavior"
      ],
      "record_refs": [
        "RUN-todomvc-spec-24",
        "RUN-todomvc-spec-25",
        "RUN-todomvc-spec-26",
        "RUN-todomvc-spec-27"
      ]
    }
  ],
  "decisions": [
    {
      "id": "ODEC-browser-boundary",
      "name": "浏览器内单应用边界",
      "status": "active",
      "decision": "采用一个浏览器 Web App，按业务职责逐步引入内部模块；具体语言、框架及版本留给实现选择，不作为当前设计的前置条件。",
      "reason": "首轮只要求浏览器单清单与跨实现行为一致；没有引入服务端或独立共享包的业务依据。",
      "scope_refs": [
        "OAPP-todos"
      ],
      "requirement_refs": [
        "SREQ-display"
      ],
      "constraint_refs": [
        "SCON-consistent-behavior"
      ],
      "record_refs": [
        "RUN-todomvc-spec-01"
      ]
    },
    {
      "id": "ODEC-canonical-route",
      "name": "采用统一的 #/ 路由形式",
      "status": "active",
      "decision": "本方案统一使用 #/、#/active、#/completed；导航层只把地址映射到 All、Active、Completed，由清单投影决定哪些待办可见。",
      "reason": "Specification 明确允许选择一种一致形式；采用给出的 #/ 形式不增加第二套路由，也不复制状态筛选规则。",
      "scope_refs": [
        "OMOD-router",
        "OMOD-store",
        "OCON-filter-selection"
      ],
      "requirement_refs": [
        "SREQ-navigation",
        "SREQ-filter"
      ],
      "record_refs": [
        "RUN-todomvc-spec-18"
      ]
    },
    {
      "id": "ODEC-navigation-refresh",
      "name": "筛选恢复与待办恢复分开",
      "status": "active",
      "decision": "页面启动从地址恢复筛选；本版不将刷新前待办恢复显示作为必须实现的路径。历史导航在同一页会话中不重置清单。",
      "reason": "已确认刷新仅验收地址筛选，不能把页面内导航错误处理为重建清单。",
      "scope_refs": [
        "OMOD-ui",
        "OMOD-router",
        "OMOD-store"
      ],
      "requirement_refs": [
        "SREQ-navigation",
        "SREQ-filter"
      ],
      "record_refs": [
        "RUN-todomvc-spec-19"
      ]
    },
    {
      "id": "ODEC-storage-adapter",
      "name": "统一提交出口与浏览器保存适配",
      "status": "active",
      "decision": "有效清单变更由状态模块统一调用保存适配；适配实现遵守 localStorage 与 todos-[framework] 约束，实现名称由具体实现提供并保持一致，不固定框架和内部文件布局。",
      "reason": "新增、编辑和各删除入口需要一致自动保存；隔离存储细节可避免每个界面动作分别实现保存逻辑。",
      "scope_refs": [
        "OMOD-store",
        "OMOD-storage",
        "ORES-todo-data"
      ],
      "requirement_refs": [
        "SREQ-persist"
      ],
      "constraint_refs": [
        "SCON-local-storage"
      ],
      "record_refs": [
        "RUN-todomvc-spec-20"
      ]
    },
    {
      "id": "ODEC-no-startup-write",
      "name": "初始化与保存触发分离",
      "status": "active",
      "decision": "本版不要求刷新恢复待办显示；初始化只建立页面和地址筛选，不主动保存本页初始空清单。业务保存能力只由有效清单命令调用。",
      "reason": "已确认不恢复显示不意味着删除已保存内容；把保存绑定到有效命令可以排除首次重绘误写空清单。",
      "scope_refs": [
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage",
        "OCON-commit-boundary"
      ],
      "requirement_refs": [
        "SREQ-persist",
        "SREQ-navigation"
      ],
      "constraint_refs": [
        "SCON-local-storage"
      ],
      "record_refs": [
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "ODEC-text-rendering",
      "name": "文字内容与界面结构分离",
      "status": "active",
      "decision": "界面结构由实现定义，待办标题只填入文本内容或输入值；不把包含标记的标题拼接为可解释的页面结构。",
      "reason": "同一标题必须在新增、编辑、显示和保存之间保持文本内容，避免视觉解释或执行改变需求语义。",
      "scope_refs": [
        "OMOD-ui",
        "OCON-plain-text"
      ],
      "requirement_refs": [
        "SREQ-display",
        "SREQ-create",
        "SREQ-edit",
        "SREQ-persist"
      ],
      "constraint_refs": [
        "SCON-plain-text"
      ],
      "record_refs": [
        "RUN-todomvc-spec-23"
      ]
    },
    {
      "id": "ODEC-presentation-owner",
      "name": "样式由页面职责集中维护",
      "status": "active",
      "decision": "页面模块维护统一布局和状态样式，具体 CSS 数值、组件拆分与文件布局留给 Implementation；视觉要求按 Specification 的可观察效果验收。",
      "reason": "现有需求规定视觉关系而非像素级参数，集中维护样式可使空状态与后续交互采用同一呈现规则。",
      "scope_refs": [
        "OMOD-ui",
        "OCON-presentation"
      ],
      "requirement_refs": [
        "SREQ-display"
      ],
      "constraint_refs": [
        "SCON-visual-layout"
      ],
      "record_refs": [
        "RUN-todomvc-spec-24"
      ]
    }
  ],
  "risks": [
    {
      "id": "ORISK-storage-failure",
      "name": "保存失败的恢复体验未定义",
      "status": "active",
      "description": "输入只定义正常保存结果，没有定义保存失败后的用户提示、重试和恢复体验；正常成功路径可继续完成设计。",
      "impact": "异常保存时，后续实现需要明确如何向用户解释未保存状态及如何恢复；本例不能据此声称异常恢复已经覆盖。",
      "mitigation": "保存适配显式返回失败，不把失败结果当成已保存；产品级恢复策略需补充需求后再固化。",
      "scope_refs": [
        "OMOD-storage",
        "OMOD-store",
        "ODEC-storage-adapter"
      ],
      "requirement_refs": [
        "SREQ-persist"
      ],
      "constraint_refs": [
        "SCON-local-storage"
      ],
      "record_refs": [
        "RUN-todomvc-spec-20"
      ]
    },
    {
      "id": "ORISK-post-refresh-write-policy",
      "name": "刷新后新提交与旧存储的衔接边界",
      "status": "active",
      "description": "已确认禁止因刷新未恢复显示而直接清空旧数据，但没有定义新页面开始新增后，旧存储与新会话清单应恢复、合并还是替换。当前方案只明确初始化不得写入，不替用户确定这项后续数据策略。",
      "impact": "若将来验收扩展到跨页面会话继续编辑，需先确定旧数据的保留和冲突规则；当前示例的单页提交场景不足以证明该路径的数据连续性。",
      "mitigation": "保持初始化零写入；将跨页面会话后的首个新提交列为需补充 Specification 的独立路径，不把它宣称为已覆盖场景。",
      "scope_refs": [
        "OMOD-store",
        "OMOD-storage",
        "ODEC-no-startup-write"
      ],
      "requirement_refs": [
        "SREQ-persist"
      ],
      "constraint_refs": [
        "SCON-local-storage"
      ],
      "record_refs": [
        "RUN-todomvc-spec-22"
      ]
    }
  ],
  "diagrams": [
    {
      "id": "ODIAG-overview",
      "name": "TodoMVC 总体架构",
      "status": "active",
      "type": "overview",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OAPP-todos",
        "ORES-navigation",
        "ORES-todo-data",
        "OREL-router-read-location",
        "OREL-router-write-location",
        "OREL-router-history-events",
        "OREL-storage-writes"
      ],
      "d2_code": "direction: right\nOAPP_todos: \"TodoMVC\"\nORES_navigation: \"页面地址与导航历史\"\nORES_todo_data: \"浏览器内待办保存空间\"\nOAPP_todos -> ORES_navigation: \"reads\"\nOAPP_todos -> ORES_navigation: \"writes\"\nOAPP_todos -> ORES_navigation: \"subscribes\"\nOAPP_todos -> ORES_todo_data: \"writes\"",
      "record_refs": [
        "RUN-todomvc-spec-01",
        "RUN-todomvc-spec-18",
        "RUN-todomvc-spec-19",
        "RUN-todomvc-spec-20"
      ]
    },
    {
      "id": "ODIAG-components",
      "name": "TodoMVC 内部职责与资源",
      "status": "active",
      "type": "component",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OAPP-todos",
        "OMOD-ui",
        "OMOD-store",
        "OMOD-router",
        "OMOD-storage",
        "ORES-navigation",
        "ORES-todo-data",
        "OREL-ui-store",
        "OREL-ui-router",
        "OREL-router-read-location",
        "OREL-router-write-location",
        "OREL-ui-router-events",
        "OREL-router-history-events",
        "OREL-store-storage",
        "OREL-storage-writes"
      ],
      "d2_code": "direction: right\nOMOD_ui: \"页面交互\"\nOMOD_store: \"清单状态\"\nOMOD_router: \"筛选导航\"\nOMOD_storage: \"保存适配\"\nORES_navigation: \"页面地址与导航历史\"\nORES_todo_data: \"浏览器内待办保存空间\"\nOMOD_ui -> OMOD_store: \"calls\"\nOMOD_ui -> OMOD_router: \"calls\"\nOMOD_router -> ORES_navigation: \"reads\"\nOMOD_router -> ORES_navigation: \"writes\"\nOMOD_ui -> OMOD_router: \"subscribes\"\nOMOD_router -> ORES_navigation: \"subscribes\"\nOMOD_store -> OMOD_storage: \"calls\"\nOMOD_storage -> ORES_todo_data: \"writes\"",
      "record_refs": [
        "RUN-todomvc-spec-01",
        "RUN-todomvc-spec-02",
        "RUN-todomvc-spec-18",
        "RUN-todomvc-spec-19",
        "RUN-todomvc-spec-20"
      ]
    },
    {
      "id": "ODIAG-scenario-launch",
      "name": "打开页面并建立当前展示状态",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-launch",
        "OMOD-ui",
        "OMOD-router",
        "ORES-navigation",
        "OMOD-store"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_launch_user: \"用户\"\nOPAR_launch_ui: \"页面交互\"\nOPAR_launch_router: \"筛选导航\"\nOPAR_launch_history: \"地址与导航历史\"\nOPAR_launch_store: \"清单状态\"\nOPAR_launch_user -> OPAR_launch_ui: \"1. 打开浏览器中的 TodoMVC 单清单应用。\"\nOPAR_launch_ui -> OPAR_launch_router: \"2. 解析当前合法筛选地址；地址没有指定筛选时选择 All。\"\nOPAR_launch_router -> OPAR_launch_history: \"3. 读取当前页面地址，按已确认的路由映射确定筛选。\"\nOPAR_launch_router -> OPAR_launch_ui: \"4. 返回规范化筛选值，不改变待办数据。\"\nOPAR_launch_ui -> OPAR_launch_store: \"5. 读取本页清单展示结果。\"\nOPAR_launch_store -> OPAR_launch_ui: \"6. 返回当前清单及本轮已经定义的派生展示值。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"7. 呈现当前视图、标题、新增入口和卡片外帮助归属信息，应用统一视觉规则；加载后将焦点交给新增输入框。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"8. 启动与首次呈现不构成待办提交，不触发保存，不因未恢复显示而覆盖原有存储。\"",
      "record_refs": [
        "RUN-todomvc-spec-01",
        "RUN-todomvc-spec-02",
        "RUN-todomvc-spec-04",
        "RUN-todomvc-spec-18",
        "RUN-todomvc-spec-22",
        "RUN-todomvc-spec-27"
      ]
    },
    {
      "id": "ODIAG-scenario-create",
      "name": "有效标题新增一条待办",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-create",
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage",
        "ORES-todo-data"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_create_user: \"用户\"\nOPAR_create_ui: \"页面交互\"\nOPAR_create_store: \"清单状态\"\nOPAR_create_storage: \"保存适配\"\nOPAR_create_saved: \"浏览器内待办数据\"\nOPAR_create_user -> OPAR_create_ui: \"1. 在新增框按 Enter。\"\nOPAR_create_ui -> OPAR_create_store: \"2. 整理标题并验证非空，为本次新增分配独立身份，保留中间空格。\"\nOPAR_create_store -> OPAR_create_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_store -> OPAR_create_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_create_storage -> OPAR_create_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_create_storage -> OPAR_create_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_create_store -> OPAR_create_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_ui -> OPAR_create_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_store -> OPAR_create_ui: \"9. 返回一致的展示快照。\"\nOPAR_create_ui -> OPAR_create_ui: \"10. 只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。\"",
      "record_refs": [
        "RUN-todomvc-spec-02",
        "RUN-todomvc-spec-03",
        "RUN-todomvc-spec-14",
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "ODIAG-todo-state",
      "name": "待办完成与移除状态",
      "status": "active",
      "type": "state",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OCON-todo-state"
      ],
      "d2_code": "direction: right\nactive: 未完成\ncompleted: 已完成\nactive -> completed: 勾选完成\ncompleted -> active: 取消完成\nremoved: 已移除\nactive -> removed: 提交空标题\ncompleted -> removed: 提交空标题\nactive -> removed: 直接删除\ncompleted -> removed: 直接删除\nactive -> completed: 全选\ncompleted -> active: 全部取消\ncompleted -> removed: 清除已完成",
      "record_refs": [
        "RUN-todomvc-spec-02",
        "RUN-todomvc-spec-05",
        "RUN-todomvc-spec-10",
        "RUN-todomvc-spec-11",
        "RUN-todomvc-spec-12",
        "RUN-todomvc-spec-13"
      ]
    },
    {
      "id": "ODIAG-scenario-reject-create",
      "name": "拒绝空标题新增",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-reject-create",
        "OMOD-ui",
        "OMOD-store"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_reject_create_user: \"用户\"\nOPAR_reject_create_ui: \"页面交互\"\nOPAR_reject_create_store: \"清单状态\"\nOPAR_reject_create_user -> OPAR_reject_create_ui: \"1. 按 Enter 提交新增草稿。\"\nOPAR_reject_create_ui -> OPAR_reject_create_store: \"2. 提交新增标题。\"\nOPAR_reject_create_store -> OPAR_reject_create_store: \"3. 去除首尾空白后结果为空，拒绝产生清单变更。\"\nOPAR_reject_create_store -> OPAR_reject_create_ui: \"4. 返回无新增结果；不产生已提交条目。\"",
      "record_refs": [
        "RUN-todomvc-spec-03"
      ]
    },
    {
      "id": "ODIAG-scenario-complete",
      "name": "完成单条待办",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-complete",
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage",
        "ORES-todo-data"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_complete_user: \"用户\"\nOPAR_complete_ui: \"页面交互\"\nOPAR_complete_store: \"清单状态\"\nOPAR_complete_storage: \"保存适配\"\nOPAR_complete_saved: \"浏览器内待办数据\"\nOPAR_complete_user -> OPAR_complete_ui: \"1. 勾选目标待办。\"\nOPAR_complete_ui -> OPAR_complete_store: \"2. 按身份把目标设为已完成。\"\nOPAR_complete_store -> OPAR_complete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_store -> OPAR_complete_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_complete_storage -> OPAR_complete_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_storage -> OPAR_complete_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_store -> OPAR_complete_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_ui -> OPAR_complete_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_store -> OPAR_complete_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_ui -> OPAR_complete_ui: \"10. 目标立即呈现选中与完成删除线，其他待办不变。\"",
      "record_refs": [
        "RUN-todomvc-spec-05",
        "RUN-todomvc-spec-14",
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "ODIAG-scenario-reopen",
      "name": "重新打开单条待办",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-reopen",
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage",
        "ORES-todo-data"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_reopen_user: \"用户\"\nOPAR_reopen_ui: \"页面交互\"\nOPAR_reopen_store: \"清单状态\"\nOPAR_reopen_storage: \"保存适配\"\nOPAR_reopen_saved: \"浏览器内待办数据\"\nOPAR_reopen_user -> OPAR_reopen_ui: \"1. 取消目标勾选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"2. 按身份把目标设为未完成。\"\nOPAR_reopen_store -> OPAR_reopen_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_store -> OPAR_reopen_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_reopen_storage -> OPAR_reopen_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_storage -> OPAR_reopen_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_ui -> OPAR_reopen_ui: \"10. 目标立即恢复未完成样式，其他待办不变。\"",
      "record_refs": [
        "RUN-todomvc-spec-05",
        "RUN-todomvc-spec-14",
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "ODIAG-scenario-begin-edit",
      "name": "开始就地编辑",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-begin-edit",
        "OMOD-ui",
        "OMOD-store"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_begin_edit_user: \"用户\"\nOPAR_begin_edit_ui: \"页面交互\"\nOPAR_begin_edit_store: \"清单状态\"\nOPAR_begin_edit_user -> OPAR_begin_edit_ui: \"1. 双击目标待办的标题。\"\nOPAR_begin_edit_ui -> OPAR_begin_edit_store: \"2. 读取目标身份对应的已提交内容。\"\nOPAR_begin_edit_store -> OPAR_begin_edit_ui: \"3. 返回目标的原标题和完成状态。\"\nOPAR_begin_edit_ui -> OPAR_begin_edit_ui: \"4. 建立绑定该身份的临时编辑会话并预填草稿；在原位置显示编辑框、交付焦点，隐藏该行展示及完成和删除控件。\"",
      "record_refs": [
        "RUN-todomvc-spec-07"
      ]
    },
    {
      "id": "ODIAG-edit-state",
      "name": "编辑会话生命周期",
      "status": "active",
      "type": "state",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OCON-edit-session"
      ],
      "d2_code": "direction: right\nviewing: 展示状态\nediting: 编辑草稿\nviewing -> editing: 双击标题\nediting -> viewing: 提交非空标题\nviewing -> viewing: 忽略已结束会话的失焦\nediting -> viewing: Escape 取消\nremoved: 条目已移除\nediting -> removed: 提交空标题",
      "record_refs": [
        "RUN-todomvc-spec-07",
        "RUN-todomvc-spec-08",
        "RUN-todomvc-spec-09",
        "RUN-todomvc-spec-10"
      ]
    },
    {
      "id": "ODIAG-scenario-submit-edit",
      "name": "提交非空编辑标题",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-submit-edit",
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage",
        "ORES-todo-data"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_submit_edit_user: \"用户\"\nOPAR_submit_edit_ui: \"页面交互\"\nOPAR_submit_edit_store: \"清单状态\"\nOPAR_submit_edit_storage: \"保存适配\"\nOPAR_submit_edit_saved: \"浏览器内待办数据\"\nOPAR_submit_edit_user -> OPAR_submit_edit_ui: \"1. 通过 Enter 或编辑框失焦提交草稿。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"3. 按原身份提交整理后的非空标题，保留完成状态与位置。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_storage: \"5. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_submit_edit_storage -> OPAR_submit_edit_saved: \"6. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_submit_edit_storage -> OPAR_submit_edit_store: \"7. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"8. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"9. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"10. 返回一致的展示快照。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"11. 退出编辑并显示同一待办的新标题，后续失焦不会重复提交。\"",
      "record_refs": [
        "RUN-todomvc-spec-08",
        "RUN-todomvc-spec-14",
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "ODIAG-scenario-cancel-edit",
      "name": "取消编辑并忽略后续失焦",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-cancel-edit",
        "OMOD-ui"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_cancel_edit_user: \"用户\"\nOPAR_cancel_edit_ui: \"页面交互\"\nOPAR_cancel_edit_user -> OPAR_cancel_edit_ui: \"1. 按 Escape。\"\nOPAR_cancel_edit_ui -> OPAR_cancel_edit_ui: \"2. 关闭会话并丢弃草稿，不分发清单变更命令；从已提交快照恢复原标题。\"\nOPAR_cancel_edit_user -> OPAR_cancel_edit_ui: \"3. 随后发生该编辑框的失焦。\"\nOPAR_cancel_edit_ui -> OPAR_cancel_edit_ui: \"4. 识别该会话已经关闭，忽略残留失焦。\"",
      "record_refs": [
        "RUN-todomvc-spec-09"
      ]
    },
    {
      "id": "ODIAG-scenario-delete-by-edit",
      "name": "提交空标题删除待办",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-delete-by-edit",
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage",
        "ORES-todo-data"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_delete_by_edit_user: \"用户\"\nOPAR_delete_by_edit_ui: \"页面交互\"\nOPAR_delete_by_edit_store: \"清单状态\"\nOPAR_delete_by_edit_storage: \"保存适配\"\nOPAR_delete_by_edit_saved: \"浏览器内待办数据\"\nOPAR_delete_by_edit_user -> OPAR_delete_by_edit_ui: \"1. 按 Enter 或使编辑框失焦。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"3. 按编辑会话绑定的身份移除目标待办。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_storage: \"5. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_delete_by_edit_storage -> OPAR_delete_by_edit_saved: \"6. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_delete_by_edit_storage -> OPAR_delete_by_edit_store: \"7. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"8. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"9. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"10. 返回一致的展示快照。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"11. 仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。\"",
      "record_refs": [
        "RUN-todomvc-spec-10",
        "RUN-todomvc-spec-14",
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "ODIAG-scenario-delete",
      "name": "直接删除一条待办",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-delete",
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage",
        "ORES-todo-data"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_delete_user: \"用户\"\nOPAR_delete_ui: \"页面交互\"\nOPAR_delete_store: \"清单状态\"\nOPAR_delete_storage: \"保存适配\"\nOPAR_delete_saved: \"浏览器内待办数据\"\nOPAR_delete_user -> OPAR_delete_ui: \"1. 悬停目标行并点击删除按钮。\"\nOPAR_delete_ui -> OPAR_delete_store: \"2. 按被点击条目的身份执行移除。\"\nOPAR_delete_store -> OPAR_delete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_store -> OPAR_delete_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_delete_storage -> OPAR_delete_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_delete_storage -> OPAR_delete_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_delete_store -> OPAR_delete_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_ui -> OPAR_delete_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_store -> OPAR_delete_ui: \"9. 返回一致的展示快照。\"\nOPAR_delete_ui -> OPAR_delete_ui: \"10. 只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。\"",
      "record_refs": [
        "RUN-todomvc-spec-11",
        "RUN-todomvc-spec-14",
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "ODIAG-scenario-complete-all",
      "name": "完成整份清单",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-complete-all",
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage",
        "ORES-todo-data"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_complete_all_user: \"用户\"\nOPAR_complete_all_ui: \"页面交互\"\nOPAR_complete_all_store: \"清单状态\"\nOPAR_complete_all_storage: \"保存适配\"\nOPAR_complete_all_saved: \"浏览器内待办数据\"\nOPAR_complete_all_user -> OPAR_complete_all_ui: \"1. 把全选控件设为选中。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"2. 把完整清单所有条目标为已完成。\"\nOPAR_complete_all_store -> OPAR_complete_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_all_store -> OPAR_complete_all_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_complete_all_storage -> OPAR_complete_all_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_all_storage -> OPAR_complete_all_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_all_ui -> OPAR_complete_all_ui: \"10. 未完成数量为零，全选选中，所有标题和顺序保持。\"",
      "record_refs": [
        "RUN-todomvc-spec-12",
        "RUN-todomvc-spec-14",
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "ODIAG-scenario-reopen-all",
      "name": "重新打开整份清单",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-reopen-all",
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage",
        "ORES-todo-data"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_reopen_all_user: \"用户\"\nOPAR_reopen_all_ui: \"页面交互\"\nOPAR_reopen_all_store: \"清单状态\"\nOPAR_reopen_all_storage: \"保存适配\"\nOPAR_reopen_all_saved: \"浏览器内待办数据\"\nOPAR_reopen_all_user -> OPAR_reopen_all_ui: \"1. 取消全选控件。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"2. 把完整清单所有条目标为未完成。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_reopen_all_storage -> OPAR_reopen_all_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_all_storage -> OPAR_reopen_all_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_ui: \"10. 未完成数量等于完整清单总数，全选未选中，标题和顺序保持。\"",
      "record_refs": [
        "RUN-todomvc-spec-12",
        "RUN-todomvc-spec-14",
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "ODIAG-scenario-clear-completed",
      "name": "清除整份清单的已完成待办",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-clear-completed",
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage",
        "ORES-todo-data"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_clear_completed_user: \"用户\"\nOPAR_clear_completed_ui: \"页面交互\"\nOPAR_clear_completed_store: \"清单状态\"\nOPAR_clear_completed_storage: \"保存适配\"\nOPAR_clear_completed_saved: \"浏览器内待办数据\"\nOPAR_clear_completed_user -> OPAR_clear_completed_ui: \"1. 点击 Clear completed。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"2. 移除完整清单中全部已完成身份，保留未完成项。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_clear_completed_storage -> OPAR_clear_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_clear_completed_storage -> OPAR_clear_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_ui: \"10. 清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。\"",
      "record_refs": [
        "RUN-todomvc-spec-13",
        "RUN-todomvc-spec-14",
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "ODIAG-scenario-select-filter",
      "name": "切换完成状态筛选",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-select-filter",
        "OMOD-ui",
        "OMOD-router",
        "ORES-navigation",
        "OMOD-store"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_select_filter_user: \"用户\"\nOPAR_select_filter_ui: \"页面交互\"\nOPAR_select_filter_router: \"筛选导航\"\nOPAR_select_filter_history: \"地址与导航历史\"\nOPAR_select_filter_store: \"清单状态\"\nOPAR_select_filter_user -> OPAR_select_filter_ui: \"1. 点击一个筛选入口。\"\nOPAR_select_filter_ui -> OPAR_select_filter_router: \"2. 请求选择 All、Active 或 Completed。\"\nOPAR_select_filter_router -> OPAR_select_filter_history: \"3. 写入该选择对应的规范地址，并形成页面内导航记录。\"\nOPAR_select_filter_router -> OPAR_select_filter_ui: \"4. 返回当前规范筛选值。\"\nOPAR_select_filter_ui -> OPAR_select_filter_store: \"5. 按返回的筛选值读取展示快照。\"\nOPAR_select_filter_store -> OPAR_select_filter_ui: \"6. 返回可见项及完整清单统计。\"\nOPAR_select_filter_ui -> OPAR_select_filter_ui: \"7. 同步选中入口和可见列表，保持待办内容及顺序。\"",
      "record_refs": [
        "RUN-todomvc-spec-14",
        "RUN-todomvc-spec-18"
      ]
    },
    {
      "id": "ODIAG-scenario-complete-in-active",
      "name": "在 Active 中完成待办",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-complete-in-active",
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage",
        "ORES-todo-data"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_complete_in_active_user: \"用户\"\nOPAR_complete_in_active_ui: \"页面交互\"\nOPAR_complete_in_active_store: \"清单状态\"\nOPAR_complete_in_active_storage: \"保存适配\"\nOPAR_complete_in_active_saved: \"浏览器内待办数据\"\nOPAR_complete_in_active_user -> OPAR_complete_in_active_ui: \"1. 勾选当前可见目标。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"2. 按原身份设为已完成，不修改筛选选择。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_complete_in_active_storage -> OPAR_complete_in_active_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_in_active_storage -> OPAR_complete_in_active_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_ui: \"10. 目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。\"",
      "record_refs": [
        "RUN-todomvc-spec-15",
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "ODIAG-scenario-reopen-in-completed",
      "name": "在 Completed 中重新打开待办",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-reopen-in-completed",
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage",
        "ORES-todo-data"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_reopen_in_completed_user: \"用户\"\nOPAR_reopen_in_completed_ui: \"页面交互\"\nOPAR_reopen_in_completed_store: \"清单状态\"\nOPAR_reopen_in_completed_storage: \"保存适配\"\nOPAR_reopen_in_completed_saved: \"浏览器内待办数据\"\nOPAR_reopen_in_completed_user -> OPAR_reopen_in_completed_ui: \"1. 取消当前可见目标的勾选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"2. 按原身份设为未完成，不修改筛选选择。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_reopen_in_completed_storage -> OPAR_reopen_in_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_in_completed_storage -> OPAR_reopen_in_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_ui: \"10. 目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。\"",
      "record_refs": [
        "RUN-todomvc-spec-15",
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "ODIAG-scenario-create-in-completed",
      "name": "在 Completed 中新增未完成待办",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-create-in-completed",
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage",
        "ORES-todo-data"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_create_in_completed_user: \"用户\"\nOPAR_create_in_completed_ui: \"页面交互\"\nOPAR_create_in_completed_store: \"清单状态\"\nOPAR_create_in_completed_storage: \"保存适配\"\nOPAR_create_in_completed_saved: \"浏览器内待办数据\"\nOPAR_create_in_completed_user -> OPAR_create_in_completed_ui: \"1. 按 Enter 提交新增标题。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"2. 创建新的未完成身份并追加到完整清单末尾。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_create_in_completed_storage -> OPAR_create_in_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_create_in_completed_storage -> OPAR_create_in_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_ui: \"10. 新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。\"",
      "record_refs": [
        "RUN-todomvc-spec-16",
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "ODIAG-scenario-clear-hidden-completed",
      "name": "在 Active 中清除隐藏的已完成项",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-clear-hidden-completed",
        "OMOD-ui",
        "OMOD-store",
        "OMOD-storage",
        "ORES-todo-data"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_clear_hidden_completed_user: \"用户\"\nOPAR_clear_hidden_completed_ui: \"页面交互\"\nOPAR_clear_hidden_completed_store: \"清单状态\"\nOPAR_clear_hidden_completed_storage: \"保存适配\"\nOPAR_clear_hidden_completed_saved: \"浏览器内待办数据\"\nOPAR_clear_hidden_completed_user -> OPAR_clear_hidden_completed_ui: \"1. 点击仍然可见的 Clear completed。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"2. 从完整清单选择并移除全部已完成身份，包括当前看不到的项。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_clear_hidden_completed_storage -> OPAR_clear_hidden_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_clear_hidden_completed_storage -> OPAR_clear_hidden_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_ui: \"10. 隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。\"",
      "record_refs": [
        "RUN-todomvc-spec-17",
        "RUN-todomvc-spec-20",
        "RUN-todomvc-spec-21",
        "RUN-todomvc-spec-22"
      ]
    },
    {
      "id": "ODIAG-scenario-history-back",
      "name": "浏览器后退同步筛选",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-history-back",
        "ORES-navigation",
        "OMOD-router",
        "OMOD-ui",
        "OMOD-store"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_history_back_user: \"用户\"\nOPAR_history_back_history: \"地址与导航历史\"\nOPAR_history_back_router: \"筛选导航\"\nOPAR_history_back_ui: \"页面交互\"\nOPAR_history_back_store: \"清单状态\"\nOPAR_history_back_user -> OPAR_history_back_history: \"1. 使用浏览器后退。\"\nOPAR_history_back_history -> OPAR_history_back_router: \"2. 当前地址按已有历史发生变化。\"\nOPAR_history_back_router -> OPAR_history_back_history: \"3. 读取变化后的地址，解析规范筛选，不写入额外历史。\"\nOPAR_history_back_router -> OPAR_history_back_ui: \"4. 发布变化后的规范筛选。\"\nOPAR_history_back_ui -> OPAR_history_back_store: \"5. 按新的选择读取展示投影。\"\nOPAR_history_back_store -> OPAR_history_back_ui: \"6. 返回匹配列表与完整清单统计。\"\nOPAR_history_back_ui -> OPAR_history_back_ui: \"7. 同步唯一选中入口与列表，保留本页清单。\"",
      "record_refs": [
        "RUN-todomvc-spec-19"
      ]
    },
    {
      "id": "ODIAG-scenario-history-forward",
      "name": "浏览器前进同步筛选",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-history-forward",
        "ORES-navigation",
        "OMOD-router",
        "OMOD-ui",
        "OMOD-store"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_history_forward_user: \"用户\"\nOPAR_history_forward_history: \"地址与导航历史\"\nOPAR_history_forward_router: \"筛选导航\"\nOPAR_history_forward_ui: \"页面交互\"\nOPAR_history_forward_store: \"清单状态\"\nOPAR_history_forward_user -> OPAR_history_forward_history: \"1. 使用浏览器前进。\"\nOPAR_history_forward_history -> OPAR_history_forward_router: \"2. 当前地址按已有历史发生变化。\"\nOPAR_history_forward_router -> OPAR_history_forward_history: \"3. 读取变化后的地址，解析规范筛选，不写入额外历史。\"\nOPAR_history_forward_router -> OPAR_history_forward_ui: \"4. 发布变化后的规范筛选。\"\nOPAR_history_forward_ui -> OPAR_history_forward_store: \"5. 按新的选择读取展示投影。\"\nOPAR_history_forward_store -> OPAR_history_forward_ui: \"6. 返回匹配列表与完整清单统计。\"\nOPAR_history_forward_ui -> OPAR_history_forward_ui: \"7. 同步唯一选中入口与列表，保留本页清单。\"",
      "record_refs": [
        "RUN-todomvc-spec-19"
      ]
    },
    {
      "id": "ODIAG-scenario-show-empty-information",
      "name": "空清单仍显示帮助与归属",
      "status": "active",
      "type": "scenario",
      "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
      "refs": [
        "OSCN-show-empty-information",
        "OMOD-ui",
        "OMOD-store"
      ],
      "d2_code": "shape: sequence_diagram\nOPAR_show_empty_information_ui: \"页面交互\"\nOPAR_show_empty_information_store: \"清单状态\"\nOPAR_show_empty_information_ui -> OPAR_show_empty_information_store: \"1. 读取完整清单派生的空状态。\"\nOPAR_show_empty_information_store -> OPAR_show_empty_information_ui: \"2. 返回清单为空的展示快照。\"\nOPAR_show_empty_information_ui -> OPAR_show_empty_information_ui: \"3. 隐藏清单主体与操作页脚，保留标题、新增入口，以及可见性条件之外的编辑提示、作者或团队和项目链接。\"",
      "record_refs": [
        "RUN-todomvc-spec-27"
      ]
    }
  ]
} satisfies SolutionArtifact;
