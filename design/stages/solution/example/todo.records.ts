/**
 * 以 specification/example/todo.records.ts 的 27 条 Record 顺序模拟 Solution。
 * 每轮只读取重建的当轮 Specification 状态；最终状态与 todo.artifact.ts 核对一致。
 * 与上游共用 Workflow Run ID，模拟 design / postHook / clarify（按需）/ confirm / finalize。
 * user 反馈和问答均为明确标注的模拟交互，不是真实对话或已接入 Kernel 的运行日志。
 * 来源中的 Acceptance 映射到所属 Requirement，Specification Relation 映射到两端 Requirement，遵守当前 origin_refs 类型。
 */
import type { SolutionRecord } from '../record.js';

export const todoSolutionRecords = [
  {
    "id": "RUN-todomvc-spec-01",
    "origin_refs": [
      "SDOM-todos",
      "SFEA-display",
      "SREQ-display",
      "SCON-consistent-behavior"
    ],
    "changes": [
      {
        "target_ref": "OAPP-todos",
        "reason": "第 1 轮建立浏览器应用边界，避免无需求依据的服务或共享包。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "modules": []
            }
          }
        ]
      },
      {
        "target_ref": "OMOD-ui",
        "reason": "第 1 轮以展示模块承接首轮页面要求。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OMOD-ui",
              "parent_ref": "OAPP-todos",
              "name": "页面交互",
              "status": "active",
              "description": "负责页面呈现与用户动作接入；当前呈现单清单入口、todos 标题及英文操作文案。",
              "requirement_refs": [
                "SREQ-display"
              ],
              "constraint_refs": [
                "SCON-consistent-behavior"
              ]
            }
          }
        ]
      },
      {
        "target_ref": "ODEC-browser-boundary",
        "reason": "第 1 轮：确认 浏览器内单应用边界。首轮只要求浏览器单清单与跨实现行为一致；没有引入服务端或独立共享包的业务依据。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "OSCN-launch",
        "reason": "第 1 轮：将 打开页面并建立当前展示状态 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-launch",
              "status": "active",
              "description": "打开页面并建立当前展示状态",
              "requirement_refs": [
                "SREQ-display"
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
                  "type": "activity",
                  "action": "呈现浏览器单清单页面，标题为 todos，操作文案使用英文。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "显示浏览器单清单入口及 todos 标题。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-overview",
        "reason": "第 1 轮：同步 TodoMVC 总体架构 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-overview",
              "name": "TodoMVC 总体架构",
              "status": "active",
              "type": "overview",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OAPP-todos"
              ],
              "d2_code": "direction: right\nOAPP_todos: \"TodoMVC\"",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-components",
        "reason": "第 1 轮：同步 TodoMVC 内部职责与资源 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-components",
              "name": "TodoMVC 内部职责与资源",
              "status": "active",
              "type": "component",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OAPP-todos",
                "OMOD-ui"
              ],
              "d2_code": "direction: right\nOMOD_ui: \"页面交互\"",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-launch",
        "reason": "第 1 轮：同步 打开页面并建立当前展示状态 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-launch",
              "name": "打开页面并建立当前展示状态",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-launch",
                "OMOD-ui"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_launch_user: \"用户\"\nOPAR_launch_ui: \"页面交互\"\nOPAR_launch_user -> OPAR_launch_ui: \"1. 打开浏览器中的 TodoMVC 单清单应用。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"2. 呈现浏览器单清单页面，标题为 todos，操作文案使用英文。\"",
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受一个浏览器应用和页面呈现职责；暂不绑定具体框架。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-02",
    "origin_refs": [
      "SFEA-create",
      "SREQ-create"
    ],
    "changes": [
      {
        "target_ref": "OMOD-store",
        "reason": "第 2 轮将待办数据与页面输入分开。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OMOD-store",
              "parent_ref": "OAPP-todos",
              "name": "清单状态",
              "status": "active",
              "description": "拥有本页完整清单；统一接收有效变更并返回只读展示快照，页面不直接改写清单。",
              "requirement_refs": [
                "SREQ-display",
                "SREQ-create"
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OMOD-store-INT-read",
        "reason": "第 2 轮：维护 store 对外提供的 读取展示快照 能力。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OMOD-store-INT-read",
              "name": "读取展示快照",
              "type": "call",
              "description": "返回本页完整清单的只读展示快照。"
            }
          }
        ]
      },
      {
        "target_ref": "OMOD-store-INT-command",
        "reason": "第 2 轮：维护 store 对外提供的 提交清单变更 能力。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OMOD-store-INT-command",
              "name": "提交清单变更",
              "type": "call",
              "description": "接收页面新增标题，生成待办身份并以未完成状态追加到末尾，返回处理结果。"
            }
          }
        ]
      },
      {
        "target_ref": "OMOD-ui",
        "reason": "第 2 轮界面拥有新增草稿，状态拥有已提交清单。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "负责页面呈现与用户动作接入；当前呈现单清单入口、todos 标题及英文操作文案。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "负责页面呈现、输入草稿和用户动作接入；把 Enter 新增交给清单状态，成功后清空新增框，加载时聚焦。清单内容以状态模块的快照为准。"
          }
        ]
      },
      {
        "target_ref": "OMOD-ui",
        "reason": "新增入口由页面承接。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create"
            ]
          }
        ]
      },
      {
        "target_ref": "OREL-ui-store",
        "reason": "第 2 轮：同步 OMOD-ui 到 OMOD-store 的 calls 关系。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OREL-ui-store",
              "source_ref": "OMOD-ui",
              "target_ref": "OMOD-store",
              "type": "calls",
              "description": "页面通过稳定能力提交清单变更并读取展示快照；不绕过状态模块直接改写条目。",
              "requirement_refs": [
                "SREQ-display",
                "SREQ-create"
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OCON-todo-state",
        "reason": "第 2 轮：形成或修订 清单身份与状态，由引用的需求限定设计规则。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
                }
              ],
              "scope_refs": [
                "OMOD-store",
                "OMOD-ui"
              ],
              "requirement_refs": [
                "SREQ-create"
              ],
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "OSCN-create",
        "reason": "第 2 轮：将 有效标题新增一条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-create",
              "status": "active",
              "description": "有效标题新增一条待办",
              "requirement_refs": [
                "SREQ-create",
                "SREQ-display"
              ],
              "initial_state": "新增框中有一个有效标题。",
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
                  "action": "把本次标题作为新增命令提交。"
                },
                {
                  "id": "OSCN-create-STEP-3",
                  "source_ref": "OPAR-create-store",
                  "type": "activity",
                  "action": "为新增项建立身份并以未完成状态追加到本页清单末尾。"
                },
                {
                  "id": "OSCN-create-STEP-4",
                  "source_ref": "OPAR-create-store",
                  "target_ref": "OPAR-create-ui",
                  "type": "return",
                  "action": "返回本次命令结果。"
                },
                {
                  "id": "OSCN-create-STEP-5",
                  "source_ref": "OPAR-create-ui",
                  "target_ref": "OPAR-create-store",
                  "type": "call",
                  "action": "读取操作后的清单展示结果与已经定义的统计。"
                },
                {
                  "id": "OSCN-create-STEP-6",
                  "source_ref": "OPAR-create-store",
                  "target_ref": "OPAR-create-ui",
                  "type": "return",
                  "action": "返回一致的展示快照。"
                },
                {
                  "id": "OSCN-create-STEP-7",
                  "source_ref": "OPAR-create-ui",
                  "type": "activity",
                  "action": "显示新增结果并清空新增框，可继续录入下一条。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "显示新增结果并清空新增框，可继续录入下一条。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OSCN-launch",
        "reason": "第 2 轮：将 打开页面并建立当前展示状态 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create"
            ]
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
                "id": "OPAR-launch-store",
                "type": "module",
                "ref": "OMOD-store",
                "name": "清单状态"
              }
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "type": "activity",
                "action": "呈现浏览器单清单页面，标题为 todos，操作文案使用英文。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-launch-store",
                "type": "call",
                "action": "读取本页清单展示结果。"
              },
              {
                "id": "OSCN-launch-STEP-3",
                "source_ref": "OPAR-launch-store",
                "target_ref": "OPAR-launch-ui",
                "type": "return",
                "action": "返回当前清单及本轮已经定义的派生展示值。"
              },
              {
                "id": "OSCN-launch-STEP-4",
                "source_ref": "OPAR-launch-ui",
                "type": "activity",
                "action": "呈现 todos、新增入口与清单，加载后聚焦新增输入框。"
              }
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "显示浏览器单清单入口及 todos 标题。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "标题、新增入口及已确定的显示区域与当前清单一致，新增框获得焦点。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "ODIAG-components",
        "reason": "第 2 轮：同步 TodoMVC 内部职责与资源 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OAPP-todos",
              "OMOD-ui"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OAPP-todos",
              "OMOD-ui",
              "OMOD-store",
              "OREL-ui-store"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nOMOD_ui: \"页面交互\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nOMOD_ui: \"页面交互\"\nOMOD_store: \"清单状态\"\nOMOD_ui -> OMOD_store: \"calls\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-launch",
        "reason": "第 2 轮：同步 打开页面并建立当前展示状态 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-launch",
              "OMOD-ui"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-launch",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_launch_user: \"用户\"\nOPAR_launch_ui: \"页面交互\"\nOPAR_launch_user -> OPAR_launch_ui: \"1. 打开浏览器中的 TodoMVC 单清单应用。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"2. 呈现浏览器单清单页面，标题为 todos，操作文案使用英文。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_launch_user: \"用户\"\nOPAR_launch_ui: \"页面交互\"\nOPAR_launch_store: \"清单状态\"\nOPAR_launch_user -> OPAR_launch_ui: \"1. 打开浏览器中的 TodoMVC 单清单应用。\"\nOPAR_launch_ui -> OPAR_launch_store: \"2. 读取本页清单展示结果。\"\nOPAR_launch_store -> OPAR_launch_ui: \"3. 返回当前清单及本轮已经定义的派生展示值。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"4. 呈现 todos、新增入口与清单，加载后聚焦新增输入框。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-create",
        "reason": "第 2 轮：同步 有效标题新增一条待办 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-create",
              "name": "有效标题新增一条待办",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-create",
                "OMOD-ui",
                "OMOD-store"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_create_user: \"用户\"\nOPAR_create_ui: \"页面交互\"\nOPAR_create_store: \"清单状态\"\nOPAR_create_user -> OPAR_create_ui: \"1. 在新增框按 Enter。\"\nOPAR_create_ui -> OPAR_create_store: \"2. 把本次标题作为新增命令提交。\"\nOPAR_create_store -> OPAR_create_store: \"3. 为新增项建立身份并以未完成状态追加到本页清单末尾。\"\nOPAR_create_store -> OPAR_create_ui: \"4. 返回本次命令结果。\"\nOPAR_create_ui -> OPAR_create_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_create_store -> OPAR_create_ui: \"6. 返回一致的展示快照。\"\nOPAR_create_ui -> OPAR_create_ui: \"7. 显示新增结果并清空新增框，可继续录入下一条。\"",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-todo-state",
        "reason": "第 2 轮：同步 待办完成与移除状态 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-todo-state",
              "name": "待办完成与移除状态",
              "status": "active",
              "type": "state",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OCON-todo-state"
              ],
              "d2_code": "direction: right\nactive: 未完成",
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受清单状态集中拥有数据，页面只持有新增草稿并提交动作。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-03",
    "origin_refs": [
      "SREQ-create"
    ],
    "changes": [
      {
        "target_ref": "OCON-todo-state",
        "reason": "第 3 轮在业务提交边界统一标题校验。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
              {
                "id": "OCON-todo-state-RULE-1",
                "description": "新待办由状态模块生成身份，以未完成状态加入末尾。"
              },
              {
                "id": "OCON-todo-state-RULE-2",
                "description": "新增框草稿由页面持有，只有 Enter 形成新增命令。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-todo-state",
        "reason": "第 3 轮稳定身份是重复标题隔离的设计依据。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store-INT-command",
        "reason": "第 3 轮：维护 store 对外提供的 提交清单变更 能力。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "接收页面新增标题，生成待办身份并以未完成状态追加到末尾，返回处理结果。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "接收新增标题，仅去除首尾空白并拒绝空结果；为有效新增分配独立于标题的身份并追加到末尾，返回处理结果。"
          }
        ]
      },
      {
        "target_ref": "OSCN-create",
        "reason": "第 3 轮：将 有效标题新增一条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/initial_state",
            "value": "新增框中有一个有效标题。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "新增草稿去除首尾空白后非空，可与已有条目同名。"
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "把本次标题作为新增命令提交。"
              },
              {
                "id": "OSCN-create-STEP-3",
                "source_ref": "OPAR-create-store",
                "type": "activity",
                "action": "为新增项建立身份并以未完成状态追加到本页清单末尾。"
              },
              {
                "id": "OSCN-create-STEP-4",
                "source_ref": "OPAR-create-store",
                "target_ref": "OPAR-create-ui",
                "type": "return",
                "action": "返回本次命令结果。"
              },
              {
                "id": "OSCN-create-STEP-5",
                "source_ref": "OPAR-create-ui",
                "target_ref": "OPAR-create-store",
                "type": "call",
                "action": "读取操作后的清单展示结果与已经定义的统计。"
              },
              {
                "id": "OSCN-create-STEP-6",
                "source_ref": "OPAR-create-store",
                "target_ref": "OPAR-create-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-create-STEP-7",
                "source_ref": "OPAR-create-ui",
                "type": "activity",
                "action": "显示新增结果并清空新增框，可继续录入下一条。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-create-ui",
                "type": "return",
                "action": "返回本次命令结果。"
              },
              {
                "id": "OSCN-create-STEP-5",
                "source_ref": "OPAR-create-ui",
                "target_ref": "OPAR-create-store",
                "type": "call",
                "action": "读取操作后的清单展示结果与已经定义的统计。"
              },
              {
                "id": "OSCN-create-STEP-6",
                "source_ref": "OPAR-create-store",
                "target_ref": "OPAR-create-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-create-STEP-7",
                "source_ref": "OPAR-create-ui",
                "type": "activity",
                "action": "只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。"
              }
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "显示新增结果并清空新增框，可继续录入下一条。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-reject-create",
        "reason": "第 3 轮：将 拒绝空标题新增 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
                  "description": "清单条目和数量保持不变。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-create",
        "reason": "第 3 轮：同步 有效标题新增一条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_user: \"用户\"\nOPAR_create_ui: \"页面交互\"\nOPAR_create_store: \"清单状态\"\nOPAR_create_user -> OPAR_create_ui: \"1. 在新增框按 Enter。\"\nOPAR_create_ui -> OPAR_create_store: \"2. 把本次标题作为新增命令提交。\"\nOPAR_create_store -> OPAR_create_store: \"3. 为新增项建立身份并以未完成状态追加到本页清单末尾。\"\nOPAR_create_store -> OPAR_create_ui: \"4. 返回本次命令结果。\"\nOPAR_create_ui -> OPAR_create_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_create_store -> OPAR_create_ui: \"6. 返回一致的展示快照。\"\nOPAR_create_ui -> OPAR_create_ui: \"7. 显示新增结果并清空新增框，可继续录入下一条。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_user: \"用户\"\nOPAR_create_ui: \"页面交互\"\nOPAR_create_store: \"清单状态\"\nOPAR_create_user -> OPAR_create_ui: \"1. 在新增框按 Enter。\"\nOPAR_create_ui -> OPAR_create_store: \"2. 整理标题并验证非空，为本次新增分配独立身份，保留中间空格。\"\nOPAR_create_store -> OPAR_create_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_store -> OPAR_create_ui: \"4. 返回本次命令结果。\"\nOPAR_create_ui -> OPAR_create_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_create_store -> OPAR_create_ui: \"6. 返回一致的展示快照。\"\nOPAR_create_ui -> OPAR_create_ui: \"7. 只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reject-create",
        "reason": "第 3 轮：同步 拒绝空标题新增 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受提交边界校验和独立身份，同名条目不会共用操作身份。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-04",
    "origin_refs": [
      "SREQ-display",
      "SREQ-create"
    ],
    "changes": [
      {
        "target_ref": "OCON-projection",
        "reason": "第 4 轮：形成或修订 清单展示投影，由引用的需求限定设计规则。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
                }
              ],
              "scope_refs": [
                "OMOD-ui",
                "OMOD-store"
              ],
              "requirement_refs": [
                "SREQ-display",
                "SREQ-create"
              ],
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "OMOD-store-INT-read",
        "reason": "第 4 轮：维护 store 对外提供的 读取展示快照 能力。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "返回本页完整清单的只读展示快照。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "返回按加入顺序排列的清单及完整清单是否为空；空状态由实际清单长度派生。"
          }
        ]
      },
      {
        "target_ref": "OSCN-launch",
        "reason": "第 4 轮：将 打开页面并建立当前展示状态 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-launch-store",
                "type": "call",
                "action": "读取本页清单展示结果。"
              },
              {
                "id": "OSCN-launch-STEP-3",
                "source_ref": "OPAR-launch-store",
                "target_ref": "OPAR-launch-ui",
                "type": "return",
                "action": "返回当前清单及本轮已经定义的派生展示值。"
              },
              {
                "id": "OSCN-launch-STEP-4",
                "source_ref": "OPAR-launch-ui",
                "type": "activity",
                "action": "呈现 todos、新增入口与清单，加载后聚焦新增输入框。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-launch-store",
                "type": "call",
                "action": "读取本页清单展示结果。"
              },
              {
                "id": "OSCN-launch-STEP-3",
                "source_ref": "OPAR-launch-store",
                "target_ref": "OPAR-launch-ui",
                "type": "return",
                "action": "返回当前清单及本轮已经定义的派生展示值。"
              },
              {
                "id": "OSCN-launch-STEP-4",
                "source_ref": "OPAR-launch-ui",
                "type": "activity",
                "action": "呈现 todos 与新增入口，根据完整清单是否为空决定主体和页脚显示，加载后聚焦新增输入框。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-launch",
        "reason": "第 4 轮：同步 打开页面并建立当前展示状态 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_launch_user: \"用户\"\nOPAR_launch_ui: \"页面交互\"\nOPAR_launch_store: \"清单状态\"\nOPAR_launch_user -> OPAR_launch_ui: \"1. 打开浏览器中的 TodoMVC 单清单应用。\"\nOPAR_launch_ui -> OPAR_launch_store: \"2. 读取本页清单展示结果。\"\nOPAR_launch_store -> OPAR_launch_ui: \"3. 返回当前清单及本轮已经定义的派生展示值。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"4. 呈现 todos、新增入口与清单，加载后聚焦新增输入框。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_launch_user: \"用户\"\nOPAR_launch_ui: \"页面交互\"\nOPAR_launch_store: \"清单状态\"\nOPAR_launch_user -> OPAR_launch_ui: \"1. 打开浏览器中的 TodoMVC 单清单应用。\"\nOPAR_launch_ui -> OPAR_launch_store: \"2. 读取本页清单展示结果。\"\nOPAR_launch_store -> OPAR_launch_ui: \"3. 返回当前清单及本轮已经定义的派生展示值。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"4. 呈现 todos 与新增入口，根据完整清单是否为空决定主体和页脚显示，加载后聚焦新增输入框。\""
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受稳定顺序与派生空状态，重绘不会产生重复新增。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-05",
    "origin_refs": [
      "SFEA-completion",
      "SREQ-toggle"
    ],
    "changes": [
      {
        "target_ref": "OMOD-ui",
        "reason": "第 5 轮完成状态动作与呈现由页面和状态共同承接。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle"
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store",
        "reason": "第 5 轮完成状态动作与呈现由页面和状态共同承接。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle"
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store-INT-command",
        "reason": "第 5 轮：维护 store 对外提供的 提交清单变更 能力。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "接收新增标题，仅去除首尾空白并拒绝空结果；为有效新增分配独立于标题的身份并追加到末尾，返回处理结果。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "提供已确认的新增与按身份切换完成状态能力；所有有效变更在完整清单上执行，保持未受影响内容与顺序。"
          }
        ]
      },
      {
        "target_ref": "OCON-todo-state",
        "reason": "单条完成状态关联同一清单身份概念。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-toggle"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-todo-state",
        "reason": "第 5 轮定义状态转换的唯一业务依据。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-complete",
        "reason": "第 5 轮：将 完成单条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-complete",
              "status": "active",
              "description": "完成单条待办",
              "requirement_refs": [
                "SREQ-toggle",
                "SREQ-display"
              ],
              "initial_state": "目标待办存在且未完成。",
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
                  "target_ref": "OPAR-complete-ui",
                  "type": "return",
                  "action": "返回本次命令结果。"
                },
                {
                  "id": "OSCN-complete-STEP-5",
                  "source_ref": "OPAR-complete-ui",
                  "target_ref": "OPAR-complete-store",
                  "type": "call",
                  "action": "读取操作后的清单展示结果与已经定义的统计。"
                },
                {
                  "id": "OSCN-complete-STEP-6",
                  "source_ref": "OPAR-complete-store",
                  "target_ref": "OPAR-complete-ui",
                  "type": "return",
                  "action": "返回一致的展示快照。"
                },
                {
                  "id": "OSCN-complete-STEP-7",
                  "source_ref": "OPAR-complete-ui",
                  "type": "activity",
                  "action": "目标立即呈现选中与完成删除线，其他待办不变。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "目标立即呈现选中与完成删除线，其他待办不变。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen",
        "reason": "第 5 轮：将 重新打开单条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-reopen",
              "status": "active",
              "description": "重新打开单条待办",
              "requirement_refs": [
                "SREQ-toggle",
                "SREQ-display"
              ],
              "initial_state": "目标待办存在且已完成。",
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
                  "target_ref": "OPAR-reopen-ui",
                  "type": "return",
                  "action": "返回本次命令结果。"
                },
                {
                  "id": "OSCN-reopen-STEP-5",
                  "source_ref": "OPAR-reopen-ui",
                  "target_ref": "OPAR-reopen-store",
                  "type": "call",
                  "action": "读取操作后的清单展示结果与已经定义的统计。"
                },
                {
                  "id": "OSCN-reopen-STEP-6",
                  "source_ref": "OPAR-reopen-store",
                  "target_ref": "OPAR-reopen-ui",
                  "type": "return",
                  "action": "返回一致的展示快照。"
                },
                {
                  "id": "OSCN-reopen-STEP-7",
                  "source_ref": "OPAR-reopen-ui",
                  "type": "activity",
                  "action": "目标立即恢复未完成样式，其他待办不变。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "目标立即恢复未完成样式，其他待办不变。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-complete",
        "reason": "第 5 轮：同步 完成单条待办 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-complete",
              "name": "完成单条待办",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-complete",
                "OMOD-ui",
                "OMOD-store"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_complete_user: \"用户\"\nOPAR_complete_ui: \"页面交互\"\nOPAR_complete_store: \"清单状态\"\nOPAR_complete_user -> OPAR_complete_ui: \"1. 勾选目标待办。\"\nOPAR_complete_ui -> OPAR_complete_store: \"2. 按身份把目标设为已完成。\"\nOPAR_complete_store -> OPAR_complete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_store -> OPAR_complete_ui: \"4. 返回本次命令结果。\"\nOPAR_complete_ui -> OPAR_complete_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_complete_store -> OPAR_complete_ui: \"6. 返回一致的展示快照。\"\nOPAR_complete_ui -> OPAR_complete_ui: \"7. 目标立即呈现选中与完成删除线，其他待办不变。\"",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reopen",
        "reason": "第 5 轮：同步 重新打开单条待办 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-reopen",
              "name": "重新打开单条待办",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-reopen",
                "OMOD-ui",
                "OMOD-store"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_reopen_user: \"用户\"\nOPAR_reopen_ui: \"页面交互\"\nOPAR_reopen_store: \"清单状态\"\nOPAR_reopen_user -> OPAR_reopen_ui: \"1. 取消目标勾选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"2. 按身份把目标设为未完成。\"\nOPAR_reopen_store -> OPAR_reopen_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"4. 返回本次命令结果。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"6. 返回一致的展示快照。\"\nOPAR_reopen_ui -> OPAR_reopen_ui: \"7. 目标立即恢复未完成样式，其他待办不变。\"",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-todo-state",
        "reason": "第 5 轮：同步 待办完成与移除状态 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nactive: 未完成"
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nactive: 未完成\ncompleted: 已完成\nactive -> completed: 勾选完成\ncompleted -> active: 取消完成"
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受状态模块按身份处理单条完成，界面立即使用新快照。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-06",
    "origin_refs": [
      "SREQ-count"
    ],
    "changes": [
      {
        "target_ref": "OMOD-ui",
        "reason": "第 6 轮未完成统计与展示共用派生快照。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count"
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store",
        "reason": "第 6 轮未完成统计与展示共用派生快照。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-projection",
        "reason": "第 6 轮未完成统计与展示共用派生快照。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-count"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-projection",
        "reason": "第 6 轮避免多条操作路径各自修改计数而漂移。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store-INT-read",
        "reason": "第 6 轮：维护 store 对外提供的 读取展示快照 能力。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "返回按加入顺序排列的清单及完整清单是否为空；空状态由实际清单长度派生。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "返回有序完整清单、是否为空与未完成数量；所有值基于同一清单状态计算。"
          }
        ]
      },
      {
        "target_ref": "OSCN-create",
        "reason": "第 6 轮：将 有效标题新增一条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-display"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-display",
              "SREQ-count"
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-complete",
        "reason": "第 6 轮：将 完成单条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle",
              "SREQ-display"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle",
              "SREQ-display",
              "SREQ-count"
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen",
        "reason": "第 6 轮：将 重新打开单条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle",
              "SREQ-display"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle",
              "SREQ-display",
              "SREQ-count"
            ]
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受从清单派生计数，状态变化后的列表和计数来自同一快照。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-07",
    "origin_refs": [
      "SFEA-edit",
      "SREQ-edit"
    ],
    "changes": [
      {
        "target_ref": "OMOD-ui",
        "reason": "第 7 轮页面编辑会话与清单已提交内容分工。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit"
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store",
        "reason": "第 7 轮页面编辑会话与清单已提交内容分工。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-edit-session",
        "reason": "第 7 轮：形成或修订 编辑会话与已提交内容，由引用的需求限定设计规则。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
                }
              ],
              "scope_refs": [
                "OMOD-ui",
                "OMOD-store"
              ],
              "requirement_refs": [
                "SREQ-edit"
              ],
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "OSCN-begin-edit",
        "reason": "第 7 轮：将 开始就地编辑 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-begin-edit",
        "reason": "第 7 轮：同步 开始就地编辑 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-edit-state",
        "reason": "第 7 轮：同步 编辑会话生命周期 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-edit-state",
              "name": "编辑会话生命周期",
              "status": "active",
              "type": "state",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OCON-edit-session"
              ],
              "d2_code": "direction: right\nviewing: 展示状态\nediting: 编辑草稿\nviewing -> editing: 双击标题",
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受页面拥有临时编辑会话，草稿不直接改写业务清单。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-08",
    "origin_refs": [
      "SREQ-edit"
    ],
    "changes": [
      {
        "target_ref": "OCON-edit-session",
        "reason": "第 8 轮用会话结束门控保证只提交一次。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-edit-session",
        "reason": "第 8 轮明确非空提交的身份与状态约束。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store-INT-command",
        "reason": "第 8 轮：维护 store 对外提供的 提交清单变更 能力。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "提供已确认的新增与按身份切换完成状态能力；所有有效变更在完整清单上执行，保持未受影响内容与顺序。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "提供已确认的新增、按身份完成切换与非空标题修改；业务边界统一整理标题，命令不得改变非目标身份和顺序。"
          }
        ]
      },
      {
        "target_ref": "OSCN-submit-edit",
        "reason": "第 8 轮：将 提交非空编辑标题 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-submit-edit",
              "status": "active",
              "description": "提交非空编辑标题",
              "requirement_refs": [
                "SREQ-edit",
                "SREQ-display",
                "SREQ-count"
              ],
              "initial_state": "目标的编辑会话有效，草稿整理后非空。",
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
                  "target_ref": "OPAR-submit-edit-ui",
                  "type": "return",
                  "action": "返回本次命令结果。"
                },
                {
                  "id": "OSCN-submit-edit-STEP-6",
                  "source_ref": "OPAR-submit-edit-ui",
                  "target_ref": "OPAR-submit-edit-store",
                  "type": "call",
                  "action": "读取操作后的清单展示结果与已经定义的统计。"
                },
                {
                  "id": "OSCN-submit-edit-STEP-7",
                  "source_ref": "OPAR-submit-edit-store",
                  "target_ref": "OPAR-submit-edit-ui",
                  "type": "return",
                  "action": "返回一致的展示快照。"
                },
                {
                  "id": "OSCN-submit-edit-STEP-8",
                  "source_ref": "OPAR-submit-edit-ui",
                  "type": "activity",
                  "action": "退出编辑并显示同一待办的新标题，后续失焦不会重复提交。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "退出编辑并显示同一待办的新标题，后续失焦不会重复提交。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-submit-edit",
        "reason": "第 8 轮：同步 提交非空编辑标题 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-submit-edit",
              "name": "提交非空编辑标题",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-submit-edit",
                "OMOD-ui",
                "OMOD-store"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_submit_edit_user: \"用户\"\nOPAR_submit_edit_ui: \"页面交互\"\nOPAR_submit_edit_store: \"清单状态\"\nOPAR_submit_edit_user -> OPAR_submit_edit_ui: \"1. 通过 Enter 或编辑框失焦提交草稿。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"3. 按原身份提交整理后的非空标题，保留完成状态与位置。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"5. 返回本次命令结果。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"6. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"7. 返回一致的展示快照。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"8. 退出编辑并显示同一待办的新标题，后续失焦不会重复提交。\"",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-edit-state",
        "reason": "第 8 轮：同步 编辑会话生命周期 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nviewing: 展示状态\nediting: 编辑草稿\nviewing -> editing: 双击标题"
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nviewing: 展示状态\nediting: 编辑草稿\nviewing -> editing: 双击标题\nediting -> viewing: 提交非空标题\nviewing -> viewing: 忽略已结束会话的失焦"
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受统一提交入口与会话结束门控，Enter 后失焦不会重复处理。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-09",
    "origin_refs": [
      "SREQ-edit"
    ],
    "changes": [
      {
        "target_ref": "OCON-edit-session",
        "reason": "第 9 轮取消必须先于后续失焦处理。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-cancel-edit",
        "reason": "第 9 轮：将 取消编辑并忽略后续失焦 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
                  "description": "原待办、原标题和完成状态保留，界面退出编辑。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-cancel-edit",
        "reason": "第 9 轮：同步 取消编辑并忽略后续失焦 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-edit-state",
        "reason": "第 9 轮：同步 编辑会话生命周期 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nviewing: 展示状态\nediting: 编辑草稿\nviewing -> editing: 双击标题\nediting -> viewing: 提交非空标题\nviewing -> viewing: 忽略已结束会话的失焦"
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nviewing: 展示状态\nediting: 编辑草稿\nviewing -> editing: 双击标题\nediting -> viewing: 提交非空标题\nviewing -> viewing: 忽略已结束会话的失焦\nediting -> viewing: Escape 取消"
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受取消仅结束草稿会话，不调用业务变更能力。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-10",
    "origin_refs": [
      "SREQ-edit"
    ],
    "changes": [
      {
        "target_ref": "OCON-edit-session",
        "reason": "第 10 轮将空标题提交与取消分开。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-todo-state",
        "reason": "空标题提交影响待办存在性。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-toggle"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-edit"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-todo-state",
        "reason": "第 10 轮增加移除状态及其作用范围。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store-INT-command",
        "reason": "第 10 轮：维护 store 对外提供的 提交清单变更 能力。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "提供已确认的新增、按身份完成切换与非空标题修改；业务边界统一整理标题，命令不得改变非目标身份和顺序。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "提供新增、单条完成切换和编辑提交；非空编辑仅改标题，空标题编辑按身份移除，所有变更保持其他条目和相对顺序。"
          }
        ]
      },
      {
        "target_ref": "OSCN-delete-by-edit",
        "reason": "第 10 轮：将 提交空标题删除待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-delete-by-edit",
              "status": "active",
              "description": "提交空标题删除待办",
              "requirement_refs": [
                "SREQ-edit",
                "SREQ-display",
                "SREQ-count"
              ],
              "initial_state": "目标编辑会话有效，草稿整理后为空。",
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
                  "target_ref": "OPAR-delete-by-edit-ui",
                  "type": "return",
                  "action": "返回本次命令结果。"
                },
                {
                  "id": "OSCN-delete-by-edit-STEP-6",
                  "source_ref": "OPAR-delete-by-edit-ui",
                  "target_ref": "OPAR-delete-by-edit-store",
                  "type": "call",
                  "action": "读取操作后的清单展示结果与已经定义的统计。"
                },
                {
                  "id": "OSCN-delete-by-edit-STEP-7",
                  "source_ref": "OPAR-delete-by-edit-store",
                  "target_ref": "OPAR-delete-by-edit-ui",
                  "type": "return",
                  "action": "返回一致的展示快照。"
                },
                {
                  "id": "OSCN-delete-by-edit-STEP-8",
                  "source_ref": "OPAR-delete-by-edit-ui",
                  "type": "activity",
                  "action": "仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-delete-by-edit",
        "reason": "第 10 轮：同步 提交空标题删除待办 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-delete-by-edit",
              "name": "提交空标题删除待办",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-delete-by-edit",
                "OMOD-ui",
                "OMOD-store"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_delete_by_edit_user: \"用户\"\nOPAR_delete_by_edit_ui: \"页面交互\"\nOPAR_delete_by_edit_store: \"清单状态\"\nOPAR_delete_by_edit_user -> OPAR_delete_by_edit_ui: \"1. 按 Enter 或使编辑框失焦。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"3. 按编辑会话绑定的身份移除目标待办。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"5. 返回本次命令结果。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"6. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"7. 返回一致的展示快照。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"8. 仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。\"",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-todo-state",
        "reason": "第 10 轮：同步 待办完成与移除状态 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nactive: 未完成\ncompleted: 已完成\nactive -> completed: 勾选完成\ncompleted -> active: 取消完成"
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nactive: 未完成\ncompleted: 已完成\nactive -> completed: 勾选完成\ncompleted -> active: 取消完成\nremoved: 已移除\nactive -> removed: 提交空标题\ncompleted -> removed: 提交空标题"
          }
        ]
      },
      {
        "target_ref": "ODIAG-edit-state",
        "reason": "第 10 轮：同步 编辑会话生命周期 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nviewing: 展示状态\nediting: 编辑草稿\nviewing -> editing: 双击标题\nediting -> viewing: 提交非空标题\nviewing -> viewing: 忽略已结束会话的失焦\nediting -> viewing: Escape 取消"
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nviewing: 展示状态\nediting: 编辑草稿\nviewing -> editing: 双击标题\nediting -> viewing: 提交非空标题\nviewing -> viewing: 忽略已结束会话的失焦\nediting -> viewing: Escape 取消\nremoved: 条目已移除\nediting -> removed: 提交空标题"
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受空标题提交删除原身份，Escape 取消仍保留待办。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-11",
    "origin_refs": [
      "SFEA-remove",
      "SREQ-delete"
    ],
    "changes": [
      {
        "target_ref": "OMOD-ui",
        "reason": "第 11 轮直接删除复用状态模块的身份移除能力。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete"
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store",
        "reason": "第 11 轮直接删除复用状态模块的身份移除能力。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-todo-state",
        "reason": "第 11 轮直接删除复用状态模块的身份移除能力。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-edit"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-edit",
              "SREQ-delete"
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store-INT-command",
        "reason": "第 11 轮：维护 store 对外提供的 提交清单变更 能力。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "提供新增、单条完成切换和编辑提交；非空编辑仅改标题，空标题编辑按身份移除，所有变更保持其他条目和相对顺序。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "提供新增、单条完成切换、编辑提交与按身份直接删除；空标题提交和直接删除复用相同的身份移除规则，保留其他条目及顺序。"
          }
        ]
      },
      {
        "target_ref": "OCON-todo-state",
        "reason": "第 11 轮避免两条删除路径产生不同副作用。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-delete",
        "reason": "第 11 轮：将 直接删除一条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-delete",
              "status": "active",
              "description": "直接删除一条待办",
              "requirement_refs": [
                "SREQ-delete",
                "SREQ-display",
                "SREQ-count"
              ],
              "initial_state": "目标待办存在且不在编辑状态。",
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
                  "target_ref": "OPAR-delete-ui",
                  "type": "return",
                  "action": "返回本次命令结果。"
                },
                {
                  "id": "OSCN-delete-STEP-5",
                  "source_ref": "OPAR-delete-ui",
                  "target_ref": "OPAR-delete-store",
                  "type": "call",
                  "action": "读取操作后的清单展示结果与已经定义的统计。"
                },
                {
                  "id": "OSCN-delete-STEP-6",
                  "source_ref": "OPAR-delete-store",
                  "target_ref": "OPAR-delete-ui",
                  "type": "return",
                  "action": "返回一致的展示快照。"
                },
                {
                  "id": "OSCN-delete-STEP-7",
                  "source_ref": "OPAR-delete-ui",
                  "type": "activity",
                  "action": "只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-delete",
        "reason": "第 11 轮：同步 直接删除一条待办 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-delete",
              "name": "直接删除一条待办",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-delete",
                "OMOD-ui",
                "OMOD-store"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_delete_user: \"用户\"\nOPAR_delete_ui: \"页面交互\"\nOPAR_delete_store: \"清单状态\"\nOPAR_delete_user -> OPAR_delete_ui: \"1. 悬停目标行并点击删除按钮。\"\nOPAR_delete_ui -> OPAR_delete_store: \"2. 按被点击条目的身份执行移除。\"\nOPAR_delete_store -> OPAR_delete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_store -> OPAR_delete_ui: \"4. 返回本次命令结果。\"\nOPAR_delete_ui -> OPAR_delete_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_delete_store -> OPAR_delete_ui: \"6. 返回一致的展示快照。\"\nOPAR_delete_ui -> OPAR_delete_ui: \"7. 只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。\"",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-todo-state",
        "reason": "第 11 轮：同步 待办完成与移除状态 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nactive: 未完成\ncompleted: 已完成\nactive -> completed: 勾选完成\ncompleted -> active: 取消完成\nremoved: 已移除\nactive -> removed: 提交空标题\ncompleted -> removed: 提交空标题"
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nactive: 未完成\ncompleted: 已完成\nactive -> completed: 勾选完成\ncompleted -> active: 取消完成\nremoved: 已移除\nactive -> removed: 提交空标题\ncompleted -> removed: 提交空标题\nactive -> removed: 直接删除\ncompleted -> removed: 直接删除"
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受两个删除入口共用按身份移除规则。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-12",
    "origin_refs": [
      "SFEA-completion",
      "SREQ-toggle-all"
    ],
    "changes": [
      {
        "target_ref": "OMOD-ui",
        "reason": "第 12 轮全选基于完整清单状态与派生统计。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all"
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store",
        "reason": "第 12 轮全选基于完整清单状态与派生统计。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-todo-state",
        "reason": "第 12 轮全选基于完整清单状态与派生统计。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-edit",
              "SREQ-delete"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-projection",
        "reason": "第 12 轮全选基于完整清单状态与派生统计。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-count"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-count",
              "SREQ-toggle-all"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-todo-state",
        "reason": "第 12 轮明确批量状态转换。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-projection",
        "reason": "第 12 轮保证新增、单条切换与全选控件一致。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store-INT-command",
        "reason": "第 12 轮：维护 store 对外提供的 提交清单变更 能力。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "提供新增、单条完成切换、编辑提交与按身份直接删除；空标题提交和直接删除复用相同的身份移除规则，保留其他条目及顺序。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "统一提供新增、单条完成切换、编辑提交、身份移除及全量完成状态设定；批量状态命令处理完整清单。"
          }
        ]
      },
      {
        "target_ref": "OMOD-store-INT-read",
        "reason": "第 12 轮：维护 store 对外提供的 读取展示快照 能力。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "返回有序完整清单、是否为空与未完成数量；所有值基于同一清单状态计算。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "从同一有序完整清单派生条目、是否为空、未完成数和全选选中值。"
          }
        ]
      },
      {
        "target_ref": "OSCN-complete-all",
        "reason": "第 12 轮：将 完成整份清单 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-complete-all",
              "status": "active",
              "description": "完成整份清单",
              "requirement_refs": [
                "SREQ-toggle-all",
                "SREQ-display",
                "SREQ-count"
              ],
              "initial_state": "清单非空，存在未完成待办。",
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
                  "target_ref": "OPAR-complete-all-ui",
                  "type": "return",
                  "action": "返回本次命令结果。"
                },
                {
                  "id": "OSCN-complete-all-STEP-5",
                  "source_ref": "OPAR-complete-all-ui",
                  "target_ref": "OPAR-complete-all-store",
                  "type": "call",
                  "action": "读取操作后的清单展示结果与已经定义的统计。"
                },
                {
                  "id": "OSCN-complete-all-STEP-6",
                  "source_ref": "OPAR-complete-all-store",
                  "target_ref": "OPAR-complete-all-ui",
                  "type": "return",
                  "action": "返回一致的展示快照。"
                },
                {
                  "id": "OSCN-complete-all-STEP-7",
                  "source_ref": "OPAR-complete-all-ui",
                  "type": "activity",
                  "action": "未完成数量为零，全选选中，所有标题和顺序保持。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "未完成数量为零，全选选中，所有标题和顺序保持。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen-all",
        "reason": "第 12 轮：将 重新打开整份清单 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-reopen-all",
              "status": "active",
              "description": "重新打开整份清单",
              "requirement_refs": [
                "SREQ-toggle-all",
                "SREQ-display",
                "SREQ-count"
              ],
              "initial_state": "清单非空且全选已选中。",
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
                  "target_ref": "OPAR-reopen-all-ui",
                  "type": "return",
                  "action": "返回本次命令结果。"
                },
                {
                  "id": "OSCN-reopen-all-STEP-5",
                  "source_ref": "OPAR-reopen-all-ui",
                  "target_ref": "OPAR-reopen-all-store",
                  "type": "call",
                  "action": "读取操作后的清单展示结果与已经定义的统计。"
                },
                {
                  "id": "OSCN-reopen-all-STEP-6",
                  "source_ref": "OPAR-reopen-all-store",
                  "target_ref": "OPAR-reopen-all-ui",
                  "type": "return",
                  "action": "返回一致的展示快照。"
                },
                {
                  "id": "OSCN-reopen-all-STEP-7",
                  "source_ref": "OPAR-reopen-all-ui",
                  "type": "activity",
                  "action": "未完成数量等于完整清单总数，全选未选中，标题和顺序保持。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "未完成数量等于完整清单总数，全选未选中，标题和顺序保持。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-complete-all",
        "reason": "第 12 轮：同步 完成整份清单 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-complete-all",
              "name": "完成整份清单",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-complete-all",
                "OMOD-ui",
                "OMOD-store"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_complete_all_user: \"用户\"\nOPAR_complete_all_ui: \"页面交互\"\nOPAR_complete_all_store: \"清单状态\"\nOPAR_complete_all_user -> OPAR_complete_all_ui: \"1. 把全选控件设为选中。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"2. 把完整清单所有条目标为已完成。\"\nOPAR_complete_all_store -> OPAR_complete_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"4. 返回本次命令结果。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"6. 返回一致的展示快照。\"\nOPAR_complete_all_ui -> OPAR_complete_all_ui: \"7. 未完成数量为零，全选选中，所有标题和顺序保持。\"",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reopen-all",
        "reason": "第 12 轮：同步 重新打开整份清单 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-reopen-all",
              "name": "重新打开整份清单",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-reopen-all",
                "OMOD-ui",
                "OMOD-store"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_reopen_all_user: \"用户\"\nOPAR_reopen_all_ui: \"页面交互\"\nOPAR_reopen_all_store: \"清单状态\"\nOPAR_reopen_all_user -> OPAR_reopen_all_ui: \"1. 取消全选控件。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"2. 把完整清单所有条目标为未完成。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"4. 返回本次命令结果。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"6. 返回一致的展示快照。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_ui: \"7. 未完成数量等于完整清单总数，全选未选中，标题和顺序保持。\"",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-todo-state",
        "reason": "第 12 轮：同步 待办完成与移除状态 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nactive: 未完成\ncompleted: 已完成\nactive -> completed: 勾选完成\ncompleted -> active: 取消完成\nremoved: 已移除\nactive -> removed: 提交空标题\ncompleted -> removed: 提交空标题\nactive -> removed: 直接删除\ncompleted -> removed: 直接删除"
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nactive: 未完成\ncompleted: 已完成\nactive -> completed: 勾选完成\ncompleted -> active: 取消完成\nremoved: 已移除\nactive -> removed: 提交空标题\ncompleted -> removed: 提交空标题\nactive -> removed: 直接删除\ncompleted -> removed: 直接删除\nactive -> completed: 全选\ncompleted -> active: 全部取消"
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受全量批量命令和派生全选状态。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-13",
    "origin_refs": [
      "SFEA-remove",
      "SREQ-clear-completed",
      "SREQ-toggle-all"
    ],
    "changes": [
      {
        "target_ref": "OMOD-ui",
        "reason": "第 13 轮清除入口、全量移除和派生显示联动。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all",
              "SREQ-clear-completed"
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store",
        "reason": "第 13 轮清除入口、全量移除和派生显示联动。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all",
              "SREQ-clear-completed"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-todo-state",
        "reason": "第 13 轮清除入口、全量移除和派生显示联动。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all",
              "SREQ-clear-completed"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-projection",
        "reason": "第 13 轮清除入口、全量移除和派生显示联动。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-count",
              "SREQ-toggle-all"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-count",
              "SREQ-toggle-all",
              "SREQ-clear-completed"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-todo-state",
        "reason": "第 13 轮定义批量移除范围。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-projection",
        "reason": "第 13 轮清除后不遗留旧控件状态。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store-INT-read",
        "reason": "第 13 轮：维护 store 对外提供的 读取展示快照 能力。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "从同一有序完整清单派生条目、是否为空、未完成数和全选选中值。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "从同一有序完整清单派生条目、是否为空、未完成数、全选选中值及是否存在已完成项。"
          }
        ]
      },
      {
        "target_ref": "OMOD-store-INT-command",
        "reason": "第 13 轮：维护 store 对外提供的 提交清单变更 能力。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "统一提供新增、单条完成切换、编辑提交、身份移除及全量完成状态设定；批量状态命令处理完整清单。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "统一提供新增、单条完成切换、编辑提交、身份移除、全量完成状态设定和清除全部已完成项；所有命令基于完整清单执行。"
          }
        ]
      },
      {
        "target_ref": "OSCN-clear-completed",
        "reason": "第 13 轮：将 清除整份清单的已完成待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-clear-completed",
              "status": "active",
              "description": "清除整份清单的已完成待办",
              "requirement_refs": [
                "SREQ-clear-completed",
                "SREQ-toggle-all",
                "SREQ-display",
                "SREQ-count"
              ],
              "initial_state": "完整清单存在已完成待办。",
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
                  "target_ref": "OPAR-clear-completed-ui",
                  "type": "return",
                  "action": "返回本次命令结果。"
                },
                {
                  "id": "OSCN-clear-completed-STEP-5",
                  "source_ref": "OPAR-clear-completed-ui",
                  "target_ref": "OPAR-clear-completed-store",
                  "type": "call",
                  "action": "读取操作后的清单展示结果与已经定义的统计。"
                },
                {
                  "id": "OSCN-clear-completed-STEP-6",
                  "source_ref": "OPAR-clear-completed-store",
                  "target_ref": "OPAR-clear-completed-ui",
                  "type": "return",
                  "action": "返回一致的展示快照。"
                },
                {
                  "id": "OSCN-clear-completed-STEP-7",
                  "source_ref": "OPAR-clear-completed-ui",
                  "type": "activity",
                  "action": "清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-clear-completed",
        "reason": "第 13 轮：同步 清除整份清单的已完成待办 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-clear-completed",
              "name": "清除整份清单的已完成待办",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-clear-completed",
                "OMOD-ui",
                "OMOD-store"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_clear_completed_user: \"用户\"\nOPAR_clear_completed_ui: \"页面交互\"\nOPAR_clear_completed_store: \"清单状态\"\nOPAR_clear_completed_user -> OPAR_clear_completed_ui: \"1. 点击 Clear completed。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"2. 移除完整清单中全部已完成身份，保留未完成项。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"4. 返回本次命令结果。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"6. 返回一致的展示快照。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_ui: \"7. 清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。\"",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-todo-state",
        "reason": "第 13 轮：同步 待办完成与移除状态 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nactive: 未完成\ncompleted: 已完成\nactive -> completed: 勾选完成\ncompleted -> active: 取消完成\nremoved: 已移除\nactive -> removed: 提交空标题\ncompleted -> removed: 提交空标题\nactive -> removed: 直接删除\ncompleted -> removed: 直接删除\nactive -> completed: 全选\ncompleted -> active: 全部取消"
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nactive: 未完成\ncompleted: 已完成\nactive -> completed: 勾选完成\ncompleted -> active: 取消完成\nremoved: 已移除\nactive -> removed: 提交空标题\ncompleted -> removed: 提交空标题\nactive -> removed: 直接删除\ncompleted -> removed: 直接删除\nactive -> completed: 全选\ncompleted -> active: 全部取消\ncompleted -> removed: 清除已完成"
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受派生清除按钮与完整清单批量移除。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-14",
    "origin_refs": [
      "SFEA-filter",
      "SREQ-filter"
    ],
    "changes": [
      {
        "target_ref": "OMOD-ui",
        "reason": "第 14 轮筛选作为同一清单的派生视图。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all",
              "SREQ-clear-completed"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all",
              "SREQ-clear-completed",
              "SREQ-filter"
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store",
        "reason": "第 14 轮筛选作为同一清单的派生视图。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all",
              "SREQ-clear-completed"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all",
              "SREQ-clear-completed",
              "SREQ-filter"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-projection",
        "reason": "第 14 轮筛选作为同一清单的派生视图。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-count",
              "SREQ-toggle-all",
              "SREQ-clear-completed"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-count",
              "SREQ-toggle-all",
              "SREQ-clear-completed",
              "SREQ-filter"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-filter-selection",
        "reason": "第 14 轮：形成或修订 筛选选择与清单分离，由引用的需求限定设计规则。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
                }
              ],
              "scope_refs": [
                "OMOD-ui",
                "OMOD-store"
              ],
              "requirement_refs": [
                "SREQ-filter"
              ],
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "OMOD-store-INT-read",
        "reason": "第 14 轮：维护 store 对外提供的 读取展示快照 能力。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "从同一有序完整清单派生条目、是否为空、未完成数、全选选中值及是否存在已完成项。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "接收当前筛选，返回保留原顺序的可见待办及完整清单派生的空状态、未完成数、全选状态和是否有已完成项。"
          }
        ]
      },
      {
        "target_ref": "OSCN-select-filter",
        "reason": "第 14 轮：将 切换完成状态筛选 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-select-filter",
              "status": "active",
              "description": "切换完成状态筛选",
              "requirement_refs": [
                "SREQ-filter",
                "SREQ-display"
              ],
              "initial_state": "页面中有一份清单，用户选择另一种筛选。",
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
                  "action": "点击 All、Active 或 Completed 中的一个入口。"
                },
                {
                  "id": "OSCN-select-filter-STEP-2",
                  "source_ref": "OPAR-select-filter-ui",
                  "type": "activity",
                  "action": "更新当前唯一筛选选择值。"
                },
                {
                  "id": "OSCN-select-filter-STEP-3",
                  "source_ref": "OPAR-select-filter-ui",
                  "target_ref": "OPAR-select-filter-store",
                  "type": "call",
                  "action": "按新筛选请求展示快照。"
                },
                {
                  "id": "OSCN-select-filter-STEP-4",
                  "source_ref": "OPAR-select-filter-store",
                  "target_ref": "OPAR-select-filter-ui",
                  "type": "return",
                  "action": "返回匹配项，保留它们在完整清单中的相对顺序。"
                },
                {
                  "id": "OSCN-select-filter-STEP-5",
                  "source_ref": "OPAR-select-filter-ui",
                  "type": "activity",
                  "action": "更新可见条目并仅标示所选入口。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "筛选改变，完整清单内容和顺序保持不变。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OSCN-create",
        "reason": "第 14 轮：将 有效标题新增一条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-display",
              "SREQ-count"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-create-ui",
                "type": "return",
                "action": "返回本次命令结果。"
              },
              {
                "id": "OSCN-create-STEP-5",
                "source_ref": "OPAR-create-ui",
                "target_ref": "OPAR-create-store",
                "type": "call",
                "action": "读取操作后的清单展示结果与已经定义的统计。"
              },
              {
                "id": "OSCN-create-STEP-6",
                "source_ref": "OPAR-create-store",
                "target_ref": "OPAR-create-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-create-STEP-7",
                "source_ref": "OPAR-create-ui",
                "type": "activity",
                "action": "只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-create-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-create-STEP-5",
                "source_ref": "OPAR-create-ui",
                "target_ref": "OPAR-create-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-create-STEP-6",
                "source_ref": "OPAR-create-store",
                "target_ref": "OPAR-create-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-create-STEP-7",
                "source_ref": "OPAR-create-ui",
                "type": "activity",
                "action": "只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-complete",
        "reason": "第 14 轮：将 完成单条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle",
              "SREQ-display",
              "SREQ-count"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-complete-ui",
                "type": "return",
                "action": "返回本次命令结果。"
              },
              {
                "id": "OSCN-complete-STEP-5",
                "source_ref": "OPAR-complete-ui",
                "target_ref": "OPAR-complete-store",
                "type": "call",
                "action": "读取操作后的清单展示结果与已经定义的统计。"
              },
              {
                "id": "OSCN-complete-STEP-6",
                "source_ref": "OPAR-complete-store",
                "target_ref": "OPAR-complete-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-complete-STEP-7",
                "source_ref": "OPAR-complete-ui",
                "type": "activity",
                "action": "目标立即呈现选中与完成删除线，其他待办不变。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-complete-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-complete-STEP-5",
                "source_ref": "OPAR-complete-ui",
                "target_ref": "OPAR-complete-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-complete-STEP-6",
                "source_ref": "OPAR-complete-store",
                "target_ref": "OPAR-complete-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-complete-STEP-7",
                "source_ref": "OPAR-complete-ui",
                "type": "activity",
                "action": "目标立即呈现选中与完成删除线，其他待办不变。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen",
        "reason": "第 14 轮：将 重新打开单条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle",
              "SREQ-display",
              "SREQ-count"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-reopen-ui",
                "type": "return",
                "action": "返回本次命令结果。"
              },
              {
                "id": "OSCN-reopen-STEP-5",
                "source_ref": "OPAR-reopen-ui",
                "target_ref": "OPAR-reopen-store",
                "type": "call",
                "action": "读取操作后的清单展示结果与已经定义的统计。"
              },
              {
                "id": "OSCN-reopen-STEP-6",
                "source_ref": "OPAR-reopen-store",
                "target_ref": "OPAR-reopen-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-reopen-STEP-7",
                "source_ref": "OPAR-reopen-ui",
                "type": "activity",
                "action": "目标立即恢复未完成样式，其他待办不变。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-reopen-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-reopen-STEP-5",
                "source_ref": "OPAR-reopen-ui",
                "target_ref": "OPAR-reopen-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-reopen-STEP-6",
                "source_ref": "OPAR-reopen-store",
                "target_ref": "OPAR-reopen-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-reopen-STEP-7",
                "source_ref": "OPAR-reopen-ui",
                "type": "activity",
                "action": "目标立即恢复未完成样式，其他待办不变。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-submit-edit",
        "reason": "第 14 轮：将 提交非空编辑标题 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-edit",
              "SREQ-display",
              "SREQ-count"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-edit",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-submit-edit-ui",
                "type": "return",
                "action": "返回本次命令结果。"
              },
              {
                "id": "OSCN-submit-edit-STEP-6",
                "source_ref": "OPAR-submit-edit-ui",
                "target_ref": "OPAR-submit-edit-store",
                "type": "call",
                "action": "读取操作后的清单展示结果与已经定义的统计。"
              },
              {
                "id": "OSCN-submit-edit-STEP-7",
                "source_ref": "OPAR-submit-edit-store",
                "target_ref": "OPAR-submit-edit-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-submit-edit-STEP-8",
                "source_ref": "OPAR-submit-edit-ui",
                "type": "activity",
                "action": "退出编辑并显示同一待办的新标题，后续失焦不会重复提交。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-submit-edit-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-submit-edit-STEP-6",
                "source_ref": "OPAR-submit-edit-ui",
                "target_ref": "OPAR-submit-edit-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-submit-edit-STEP-7",
                "source_ref": "OPAR-submit-edit-store",
                "target_ref": "OPAR-submit-edit-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-submit-edit-STEP-8",
                "source_ref": "OPAR-submit-edit-ui",
                "type": "activity",
                "action": "退出编辑并显示同一待办的新标题，后续失焦不会重复提交。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-delete-by-edit",
        "reason": "第 14 轮：将 提交空标题删除待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-edit",
              "SREQ-display",
              "SREQ-count"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-edit",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-delete-by-edit-ui",
                "type": "return",
                "action": "返回本次命令结果。"
              },
              {
                "id": "OSCN-delete-by-edit-STEP-6",
                "source_ref": "OPAR-delete-by-edit-ui",
                "target_ref": "OPAR-delete-by-edit-store",
                "type": "call",
                "action": "读取操作后的清单展示结果与已经定义的统计。"
              },
              {
                "id": "OSCN-delete-by-edit-STEP-7",
                "source_ref": "OPAR-delete-by-edit-store",
                "target_ref": "OPAR-delete-by-edit-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-delete-by-edit-STEP-8",
                "source_ref": "OPAR-delete-by-edit-ui",
                "type": "activity",
                "action": "仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-delete-by-edit-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-delete-by-edit-STEP-6",
                "source_ref": "OPAR-delete-by-edit-ui",
                "target_ref": "OPAR-delete-by-edit-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-delete-by-edit-STEP-7",
                "source_ref": "OPAR-delete-by-edit-store",
                "target_ref": "OPAR-delete-by-edit-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-delete-by-edit-STEP-8",
                "source_ref": "OPAR-delete-by-edit-ui",
                "type": "activity",
                "action": "仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-delete",
        "reason": "第 14 轮：将 直接删除一条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-delete",
              "SREQ-display",
              "SREQ-count"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-delete",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-delete-ui",
                "type": "return",
                "action": "返回本次命令结果。"
              },
              {
                "id": "OSCN-delete-STEP-5",
                "source_ref": "OPAR-delete-ui",
                "target_ref": "OPAR-delete-store",
                "type": "call",
                "action": "读取操作后的清单展示结果与已经定义的统计。"
              },
              {
                "id": "OSCN-delete-STEP-6",
                "source_ref": "OPAR-delete-store",
                "target_ref": "OPAR-delete-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-delete-STEP-7",
                "source_ref": "OPAR-delete-ui",
                "type": "activity",
                "action": "只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-delete-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-delete-STEP-5",
                "source_ref": "OPAR-delete-ui",
                "target_ref": "OPAR-delete-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-delete-STEP-6",
                "source_ref": "OPAR-delete-store",
                "target_ref": "OPAR-delete-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-delete-STEP-7",
                "source_ref": "OPAR-delete-ui",
                "type": "activity",
                "action": "只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-complete-all",
        "reason": "第 14 轮：将 完成整份清单 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle-all",
              "SREQ-display",
              "SREQ-count"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle-all",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-complete-all-ui",
                "type": "return",
                "action": "返回本次命令结果。"
              },
              {
                "id": "OSCN-complete-all-STEP-5",
                "source_ref": "OPAR-complete-all-ui",
                "target_ref": "OPAR-complete-all-store",
                "type": "call",
                "action": "读取操作后的清单展示结果与已经定义的统计。"
              },
              {
                "id": "OSCN-complete-all-STEP-6",
                "source_ref": "OPAR-complete-all-store",
                "target_ref": "OPAR-complete-all-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-complete-all-STEP-7",
                "source_ref": "OPAR-complete-all-ui",
                "type": "activity",
                "action": "未完成数量为零，全选选中，所有标题和顺序保持。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-complete-all-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-complete-all-STEP-5",
                "source_ref": "OPAR-complete-all-ui",
                "target_ref": "OPAR-complete-all-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-complete-all-STEP-6",
                "source_ref": "OPAR-complete-all-store",
                "target_ref": "OPAR-complete-all-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-complete-all-STEP-7",
                "source_ref": "OPAR-complete-all-ui",
                "type": "activity",
                "action": "未完成数量为零，全选选中，所有标题和顺序保持。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen-all",
        "reason": "第 14 轮：将 重新打开整份清单 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle-all",
              "SREQ-display",
              "SREQ-count"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle-all",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-reopen-all-ui",
                "type": "return",
                "action": "返回本次命令结果。"
              },
              {
                "id": "OSCN-reopen-all-STEP-5",
                "source_ref": "OPAR-reopen-all-ui",
                "target_ref": "OPAR-reopen-all-store",
                "type": "call",
                "action": "读取操作后的清单展示结果与已经定义的统计。"
              },
              {
                "id": "OSCN-reopen-all-STEP-6",
                "source_ref": "OPAR-reopen-all-store",
                "target_ref": "OPAR-reopen-all-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-reopen-all-STEP-7",
                "source_ref": "OPAR-reopen-all-ui",
                "type": "activity",
                "action": "未完成数量等于完整清单总数，全选未选中，标题和顺序保持。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-reopen-all-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-reopen-all-STEP-5",
                "source_ref": "OPAR-reopen-all-ui",
                "target_ref": "OPAR-reopen-all-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-reopen-all-STEP-6",
                "source_ref": "OPAR-reopen-all-store",
                "target_ref": "OPAR-reopen-all-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-reopen-all-STEP-7",
                "source_ref": "OPAR-reopen-all-ui",
                "type": "activity",
                "action": "未完成数量等于完整清单总数，全选未选中，标题和顺序保持。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-clear-completed",
        "reason": "第 14 轮：将 清除整份清单的已完成待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-clear-completed",
              "SREQ-toggle-all",
              "SREQ-display",
              "SREQ-count"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-clear-completed",
              "SREQ-toggle-all",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-clear-completed-ui",
                "type": "return",
                "action": "返回本次命令结果。"
              },
              {
                "id": "OSCN-clear-completed-STEP-5",
                "source_ref": "OPAR-clear-completed-ui",
                "target_ref": "OPAR-clear-completed-store",
                "type": "call",
                "action": "读取操作后的清单展示结果与已经定义的统计。"
              },
              {
                "id": "OSCN-clear-completed-STEP-6",
                "source_ref": "OPAR-clear-completed-store",
                "target_ref": "OPAR-clear-completed-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-clear-completed-STEP-7",
                "source_ref": "OPAR-clear-completed-ui",
                "type": "activity",
                "action": "清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-clear-completed-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-clear-completed-STEP-5",
                "source_ref": "OPAR-clear-completed-ui",
                "target_ref": "OPAR-clear-completed-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-clear-completed-STEP-6",
                "source_ref": "OPAR-clear-completed-store",
                "target_ref": "OPAR-clear-completed-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-clear-completed-STEP-7",
                "source_ref": "OPAR-clear-completed-ui",
                "type": "activity",
                "action": "清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-create",
        "reason": "第 14 轮：同步 有效标题新增一条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_user: \"用户\"\nOPAR_create_ui: \"页面交互\"\nOPAR_create_store: \"清单状态\"\nOPAR_create_user -> OPAR_create_ui: \"1. 在新增框按 Enter。\"\nOPAR_create_ui -> OPAR_create_store: \"2. 整理标题并验证非空，为本次新增分配独立身份，保留中间空格。\"\nOPAR_create_store -> OPAR_create_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_store -> OPAR_create_ui: \"4. 返回本次命令结果。\"\nOPAR_create_ui -> OPAR_create_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_create_store -> OPAR_create_ui: \"6. 返回一致的展示快照。\"\nOPAR_create_ui -> OPAR_create_ui: \"7. 只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_user: \"用户\"\nOPAR_create_ui: \"页面交互\"\nOPAR_create_store: \"清单状态\"\nOPAR_create_user -> OPAR_create_ui: \"1. 在新增框按 Enter。\"\nOPAR_create_ui -> OPAR_create_store: \"2. 整理标题并验证非空，为本次新增分配独立身份，保留中间空格。\"\nOPAR_create_store -> OPAR_create_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_store -> OPAR_create_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_ui -> OPAR_create_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_store -> OPAR_create_ui: \"6. 返回一致的展示快照。\"\nOPAR_create_ui -> OPAR_create_ui: \"7. 只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-complete",
        "reason": "第 14 轮：同步 完成单条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_user: \"用户\"\nOPAR_complete_ui: \"页面交互\"\nOPAR_complete_store: \"清单状态\"\nOPAR_complete_user -> OPAR_complete_ui: \"1. 勾选目标待办。\"\nOPAR_complete_ui -> OPAR_complete_store: \"2. 按身份把目标设为已完成。\"\nOPAR_complete_store -> OPAR_complete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_store -> OPAR_complete_ui: \"4. 返回本次命令结果。\"\nOPAR_complete_ui -> OPAR_complete_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_complete_store -> OPAR_complete_ui: \"6. 返回一致的展示快照。\"\nOPAR_complete_ui -> OPAR_complete_ui: \"7. 目标立即呈现选中与完成删除线，其他待办不变。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_user: \"用户\"\nOPAR_complete_ui: \"页面交互\"\nOPAR_complete_store: \"清单状态\"\nOPAR_complete_user -> OPAR_complete_ui: \"1. 勾选目标待办。\"\nOPAR_complete_ui -> OPAR_complete_store: \"2. 按身份把目标设为已完成。\"\nOPAR_complete_store -> OPAR_complete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_store -> OPAR_complete_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_ui -> OPAR_complete_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_store -> OPAR_complete_ui: \"6. 返回一致的展示快照。\"\nOPAR_complete_ui -> OPAR_complete_ui: \"7. 目标立即呈现选中与完成删除线，其他待办不变。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reopen",
        "reason": "第 14 轮：同步 重新打开单条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_user: \"用户\"\nOPAR_reopen_ui: \"页面交互\"\nOPAR_reopen_store: \"清单状态\"\nOPAR_reopen_user -> OPAR_reopen_ui: \"1. 取消目标勾选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"2. 按身份把目标设为未完成。\"\nOPAR_reopen_store -> OPAR_reopen_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"4. 返回本次命令结果。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"6. 返回一致的展示快照。\"\nOPAR_reopen_ui -> OPAR_reopen_ui: \"7. 目标立即恢复未完成样式，其他待办不变。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_user: \"用户\"\nOPAR_reopen_ui: \"页面交互\"\nOPAR_reopen_store: \"清单状态\"\nOPAR_reopen_user -> OPAR_reopen_ui: \"1. 取消目标勾选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"2. 按身份把目标设为未完成。\"\nOPAR_reopen_store -> OPAR_reopen_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"6. 返回一致的展示快照。\"\nOPAR_reopen_ui -> OPAR_reopen_ui: \"7. 目标立即恢复未完成样式，其他待办不变。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-submit-edit",
        "reason": "第 14 轮：同步 提交非空编辑标题 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_submit_edit_user: \"用户\"\nOPAR_submit_edit_ui: \"页面交互\"\nOPAR_submit_edit_store: \"清单状态\"\nOPAR_submit_edit_user -> OPAR_submit_edit_ui: \"1. 通过 Enter 或编辑框失焦提交草稿。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"3. 按原身份提交整理后的非空标题，保留完成状态与位置。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"5. 返回本次命令结果。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"6. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"7. 返回一致的展示快照。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"8. 退出编辑并显示同一待办的新标题，后续失焦不会重复提交。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_submit_edit_user: \"用户\"\nOPAR_submit_edit_ui: \"页面交互\"\nOPAR_submit_edit_store: \"清单状态\"\nOPAR_submit_edit_user -> OPAR_submit_edit_ui: \"1. 通过 Enter 或编辑框失焦提交草稿。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"3. 按原身份提交整理后的非空标题，保留完成状态与位置。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"5. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"6. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"7. 返回一致的展示快照。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"8. 退出编辑并显示同一待办的新标题，后续失焦不会重复提交。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-delete-by-edit",
        "reason": "第 14 轮：同步 提交空标题删除待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_by_edit_user: \"用户\"\nOPAR_delete_by_edit_ui: \"页面交互\"\nOPAR_delete_by_edit_store: \"清单状态\"\nOPAR_delete_by_edit_user -> OPAR_delete_by_edit_ui: \"1. 按 Enter 或使编辑框失焦。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"3. 按编辑会话绑定的身份移除目标待办。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"5. 返回本次命令结果。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"6. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"7. 返回一致的展示快照。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"8. 仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_by_edit_user: \"用户\"\nOPAR_delete_by_edit_ui: \"页面交互\"\nOPAR_delete_by_edit_store: \"清单状态\"\nOPAR_delete_by_edit_user -> OPAR_delete_by_edit_ui: \"1. 按 Enter 或使编辑框失焦。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"3. 按编辑会话绑定的身份移除目标待办。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"5. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"6. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"7. 返回一致的展示快照。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"8. 仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-delete",
        "reason": "第 14 轮：同步 直接删除一条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_user: \"用户\"\nOPAR_delete_ui: \"页面交互\"\nOPAR_delete_store: \"清单状态\"\nOPAR_delete_user -> OPAR_delete_ui: \"1. 悬停目标行并点击删除按钮。\"\nOPAR_delete_ui -> OPAR_delete_store: \"2. 按被点击条目的身份执行移除。\"\nOPAR_delete_store -> OPAR_delete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_store -> OPAR_delete_ui: \"4. 返回本次命令结果。\"\nOPAR_delete_ui -> OPAR_delete_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_delete_store -> OPAR_delete_ui: \"6. 返回一致的展示快照。\"\nOPAR_delete_ui -> OPAR_delete_ui: \"7. 只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_user: \"用户\"\nOPAR_delete_ui: \"页面交互\"\nOPAR_delete_store: \"清单状态\"\nOPAR_delete_user -> OPAR_delete_ui: \"1. 悬停目标行并点击删除按钮。\"\nOPAR_delete_ui -> OPAR_delete_store: \"2. 按被点击条目的身份执行移除。\"\nOPAR_delete_store -> OPAR_delete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_store -> OPAR_delete_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_ui -> OPAR_delete_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_store -> OPAR_delete_ui: \"6. 返回一致的展示快照。\"\nOPAR_delete_ui -> OPAR_delete_ui: \"7. 只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-complete-all",
        "reason": "第 14 轮：同步 完成整份清单 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_all_user: \"用户\"\nOPAR_complete_all_ui: \"页面交互\"\nOPAR_complete_all_store: \"清单状态\"\nOPAR_complete_all_user -> OPAR_complete_all_ui: \"1. 把全选控件设为选中。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"2. 把完整清单所有条目标为已完成。\"\nOPAR_complete_all_store -> OPAR_complete_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"4. 返回本次命令结果。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"6. 返回一致的展示快照。\"\nOPAR_complete_all_ui -> OPAR_complete_all_ui: \"7. 未完成数量为零，全选选中，所有标题和顺序保持。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_all_user: \"用户\"\nOPAR_complete_all_ui: \"页面交互\"\nOPAR_complete_all_store: \"清单状态\"\nOPAR_complete_all_user -> OPAR_complete_all_ui: \"1. 把全选控件设为选中。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"2. 把完整清单所有条目标为已完成。\"\nOPAR_complete_all_store -> OPAR_complete_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"6. 返回一致的展示快照。\"\nOPAR_complete_all_ui -> OPAR_complete_all_ui: \"7. 未完成数量为零，全选选中，所有标题和顺序保持。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reopen-all",
        "reason": "第 14 轮：同步 重新打开整份清单 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_all_user: \"用户\"\nOPAR_reopen_all_ui: \"页面交互\"\nOPAR_reopen_all_store: \"清单状态\"\nOPAR_reopen_all_user -> OPAR_reopen_all_ui: \"1. 取消全选控件。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"2. 把完整清单所有条目标为未完成。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"4. 返回本次命令结果。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"6. 返回一致的展示快照。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_ui: \"7. 未完成数量等于完整清单总数，全选未选中，标题和顺序保持。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_all_user: \"用户\"\nOPAR_reopen_all_ui: \"页面交互\"\nOPAR_reopen_all_store: \"清单状态\"\nOPAR_reopen_all_user -> OPAR_reopen_all_ui: \"1. 取消全选控件。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"2. 把完整清单所有条目标为未完成。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"6. 返回一致的展示快照。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_ui: \"7. 未完成数量等于完整清单总数，全选未选中，标题和顺序保持。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-clear-completed",
        "reason": "第 14 轮：同步 清除整份清单的已完成待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_clear_completed_user: \"用户\"\nOPAR_clear_completed_ui: \"页面交互\"\nOPAR_clear_completed_store: \"清单状态\"\nOPAR_clear_completed_user -> OPAR_clear_completed_ui: \"1. 点击 Clear completed。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"2. 移除完整清单中全部已完成身份，保留未完成项。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"4. 返回本次命令结果。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"5. 读取操作后的清单展示结果与已经定义的统计。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"6. 返回一致的展示快照。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_ui: \"7. 清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_clear_completed_user: \"用户\"\nOPAR_clear_completed_ui: \"页面交互\"\nOPAR_clear_completed_store: \"清单状态\"\nOPAR_clear_completed_user -> OPAR_clear_completed_ui: \"1. 点击 Clear completed。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"2. 移除完整清单中全部已完成身份，保留未完成项。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"6. 返回一致的展示快照。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_ui: \"7. 清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-select-filter",
        "reason": "第 14 轮：同步 切换完成状态筛选 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-select-filter",
              "name": "切换完成状态筛选",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-select-filter",
                "OMOD-ui",
                "OMOD-store"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_select_filter_user: \"用户\"\nOPAR_select_filter_ui: \"页面交互\"\nOPAR_select_filter_store: \"清单状态\"\nOPAR_select_filter_user -> OPAR_select_filter_ui: \"1. 点击 All、Active 或 Completed 中的一个入口。\"\nOPAR_select_filter_ui -> OPAR_select_filter_ui: \"2. 更新当前唯一筛选选择值。\"\nOPAR_select_filter_ui -> OPAR_select_filter_store: \"3. 按新筛选请求展示快照。\"\nOPAR_select_filter_store -> OPAR_select_filter_ui: \"4. 返回匹配项，保留它们在完整清单中的相对顺序。\"\nOPAR_select_filter_ui -> OPAR_select_filter_ui: \"5. 更新可见条目并仅标示所选入口。\"",
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受单份清单与派生视图，避免为三个分类分别维护数据。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-15",
    "origin_refs": [
      "SREQ-filter",
      "SREQ-edit"
    ],
    "changes": [
      {
        "target_ref": "OCON-filter-selection",
        "reason": "第 15 轮跨视图操作仍按同一身份执行。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-filter-selection",
        "reason": "第 15 轮编辑和完成状态交互受同一筛选语义约束。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-filter"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-filter",
              "SREQ-edit",
              "SREQ-toggle"
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-complete-in-active",
        "reason": "第 15 轮：将 在 Active 中完成待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-complete-in-active",
              "status": "active",
              "description": "在 Active 中完成待办",
              "requirement_refs": [
                "SREQ-filter",
                "SREQ-toggle",
                "SREQ-display",
                "SREQ-count"
              ],
              "initial_state": "当前为 Active，目标待办未完成。",
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
                  "target_ref": "OPAR-complete-in-active-ui",
                  "type": "return",
                  "action": "返回本次命令结果，界面保留当前筛选。"
                },
                {
                  "id": "OSCN-complete-in-active-STEP-5",
                  "source_ref": "OPAR-complete-in-active-ui",
                  "target_ref": "OPAR-complete-in-active-store",
                  "type": "call",
                  "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
                },
                {
                  "id": "OSCN-complete-in-active-STEP-6",
                  "source_ref": "OPAR-complete-in-active-store",
                  "target_ref": "OPAR-complete-in-active-ui",
                  "type": "return",
                  "action": "返回一致的展示快照。"
                },
                {
                  "id": "OSCN-complete-in-active-STEP-7",
                  "source_ref": "OPAR-complete-in-active-ui",
                  "type": "activity",
                  "action": "目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen-in-completed",
        "reason": "第 15 轮：将 在 Completed 中重新打开待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-reopen-in-completed",
              "status": "active",
              "description": "在 Completed 中重新打开待办",
              "requirement_refs": [
                "SREQ-filter",
                "SREQ-toggle",
                "SREQ-display",
                "SREQ-count"
              ],
              "initial_state": "当前为 Completed，目标待办已完成。",
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
                  "target_ref": "OPAR-reopen-in-completed-ui",
                  "type": "return",
                  "action": "返回本次命令结果，界面保留当前筛选。"
                },
                {
                  "id": "OSCN-reopen-in-completed-STEP-5",
                  "source_ref": "OPAR-reopen-in-completed-ui",
                  "target_ref": "OPAR-reopen-in-completed-store",
                  "type": "call",
                  "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
                },
                {
                  "id": "OSCN-reopen-in-completed-STEP-6",
                  "source_ref": "OPAR-reopen-in-completed-store",
                  "target_ref": "OPAR-reopen-in-completed-ui",
                  "type": "return",
                  "action": "返回一致的展示快照。"
                },
                {
                  "id": "OSCN-reopen-in-completed-STEP-7",
                  "source_ref": "OPAR-reopen-in-completed-ui",
                  "type": "activity",
                  "action": "目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-complete-in-active",
        "reason": "第 15 轮：同步 在 Active 中完成待办 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-complete-in-active",
              "name": "在 Active 中完成待办",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-complete-in-active",
                "OMOD-ui",
                "OMOD-store"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_complete_in_active_user: \"用户\"\nOPAR_complete_in_active_ui: \"页面交互\"\nOPAR_complete_in_active_store: \"清单状态\"\nOPAR_complete_in_active_user -> OPAR_complete_in_active_ui: \"1. 勾选当前可见目标。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"2. 按原身份设为已完成，不修改筛选选择。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"6. 返回一致的展示快照。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_ui: \"7. 目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。\"",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reopen-in-completed",
        "reason": "第 15 轮：同步 在 Completed 中重新打开待办 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-reopen-in-completed",
              "name": "在 Completed 中重新打开待办",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-reopen-in-completed",
                "OMOD-ui",
                "OMOD-store"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_reopen_in_completed_user: \"用户\"\nOPAR_reopen_in_completed_ui: \"页面交互\"\nOPAR_reopen_in_completed_store: \"清单状态\"\nOPAR_reopen_in_completed_user -> OPAR_reopen_in_completed_ui: \"1. 取消当前可见目标的勾选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"2. 按原身份设为未完成，不修改筛选选择。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"6. 返回一致的展示快照。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_ui: \"7. 目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。\"",
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受变更后重新投影，身份保持且不自动切换分类。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-16",
    "origin_refs": [
      "SREQ-create",
      "SREQ-display"
    ],
    "changes": [
      {
        "target_ref": "OCON-projection",
        "reason": "第 16 轮区分两种空状态。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-filter-selection",
        "reason": "第 16 轮新增与筛选选择相互独立。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-create-in-completed",
        "reason": "第 16 轮：将 在 Completed 中新增未完成待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-create-in-completed",
              "status": "active",
              "description": "在 Completed 中新增未完成待办",
              "requirement_refs": [
                "SREQ-create",
                "SREQ-filter",
                "SREQ-count",
                "SREQ-display"
              ],
              "initial_state": "当前为 Completed，新增草稿有效。",
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
                  "target_ref": "OPAR-create-in-completed-ui",
                  "type": "return",
                  "action": "返回本次命令结果，界面保留当前筛选。"
                },
                {
                  "id": "OSCN-create-in-completed-STEP-5",
                  "source_ref": "OPAR-create-in-completed-ui",
                  "target_ref": "OPAR-create-in-completed-store",
                  "type": "call",
                  "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
                },
                {
                  "id": "OSCN-create-in-completed-STEP-6",
                  "source_ref": "OPAR-create-in-completed-store",
                  "target_ref": "OPAR-create-in-completed-ui",
                  "type": "return",
                  "action": "返回一致的展示快照。"
                },
                {
                  "id": "OSCN-create-in-completed-STEP-7",
                  "source_ref": "OPAR-create-in-completed-ui",
                  "type": "activity",
                  "action": "新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-create-in-completed",
        "reason": "第 16 轮：同步 在 Completed 中新增未完成待办 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-create-in-completed",
              "name": "在 Completed 中新增未完成待办",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-create-in-completed",
                "OMOD-ui",
                "OMOD-store"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_create_in_completed_user: \"用户\"\nOPAR_create_in_completed_ui: \"页面交互\"\nOPAR_create_in_completed_store: \"清单状态\"\nOPAR_create_in_completed_user -> OPAR_create_in_completed_ui: \"1. 按 Enter 提交新增标题。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"2. 创建新的未完成身份并追加到完整清单末尾。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"6. 返回一致的展示快照。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_ui: \"7. 新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。\"",
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受完整清单与可见集合分别判断为空，Completed 中也可正常新增。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-17",
    "origin_refs": [
      "SREQ-count",
      "SREQ-toggle-all",
      "SREQ-clear-completed",
      "SREQ-edit"
    ],
    "changes": [
      {
        "target_ref": "OCON-projection",
        "reason": "第 17 轮把所有全局控件的范围明确归一。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-filter-selection",
        "reason": "第 17 轮从能力边界防止批量操作遗漏隐藏项。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-filter-selection",
        "reason": "第 17 轮承接筛选下的全量计数与操作。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-filter",
              "SREQ-edit",
              "SREQ-toggle"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-filter",
              "SREQ-edit",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-toggle-all",
              "SREQ-clear-completed"
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-clear-hidden-completed",
        "reason": "第 17 轮：将 在 Active 中清除隐藏的已完成项 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OSCN-clear-hidden-completed",
              "status": "active",
              "description": "在 Active 中清除隐藏的已完成项",
              "requirement_refs": [
                "SREQ-filter",
                "SREQ-clear-completed",
                "SREQ-count",
                "SREQ-display"
              ],
              "initial_state": "当前为 Active，完整清单有已完成项。",
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
                  "target_ref": "OPAR-clear-hidden-completed-ui",
                  "type": "return",
                  "action": "返回本次命令结果，界面保留当前筛选。"
                },
                {
                  "id": "OSCN-clear-hidden-completed-STEP-5",
                  "source_ref": "OPAR-clear-hidden-completed-ui",
                  "target_ref": "OPAR-clear-hidden-completed-store",
                  "type": "call",
                  "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
                },
                {
                  "id": "OSCN-clear-hidden-completed-STEP-6",
                  "source_ref": "OPAR-clear-hidden-completed-store",
                  "target_ref": "OPAR-clear-hidden-completed-ui",
                  "type": "return",
                  "action": "返回一致的展示快照。"
                },
                {
                  "id": "OSCN-clear-hidden-completed-STEP-7",
                  "source_ref": "OPAR-clear-hidden-completed-ui",
                  "type": "activity",
                  "action": "隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。"
                }
              ],
              "outcomes": [
                {
                  "type": "state",
                  "description": "隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。"
                }
              ]
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-clear-hidden-completed",
        "reason": "第 17 轮：同步 在 Active 中清除隐藏的已完成项 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "ODIAG-scenario-clear-hidden-completed",
              "name": "在 Active 中清除隐藏的已完成项",
              "status": "active",
              "type": "scenario",
              "description": "从同一轮已确认的设计正文派生；图不定义额外需求或协作。",
              "refs": [
                "OSCN-clear-hidden-completed",
                "OMOD-ui",
                "OMOD-store"
              ],
              "d2_code": "shape: sequence_diagram\nOPAR_clear_hidden_completed_user: \"用户\"\nOPAR_clear_hidden_completed_ui: \"页面交互\"\nOPAR_clear_hidden_completed_store: \"清单状态\"\nOPAR_clear_hidden_completed_user -> OPAR_clear_hidden_completed_ui: \"1. 点击仍然可见的 Clear completed。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"2. 从完整清单选择并移除全部已完成身份，包括当前看不到的项。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"6. 返回一致的展示快照。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_ui: \"7. 隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。\"",
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受批量命令基于完整清单，计数和按钮不受当前可见项限制。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-18",
    "origin_refs": [
      "SFEA-filter",
      "SREQ-navigation",
      "SREQ-filter"
    ],
    "changes": [
      {
        "target_ref": "OMOD-router",
        "reason": "第 18 轮引入独立导航职责，避免地址模块复制业务匹配逻辑。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OMOD-router",
              "parent_ref": "OAPP-todos",
              "name": "筛选导航",
              "status": "active",
              "description": "拥有地址与规范筛选值之间的映射，提供当前选择读取与页面内选择切换；不持有待办、不实现完成状态匹配规则。",
              "requirement_refs": [
                "SREQ-navigation",
                "SREQ-filter"
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OMOD-router-INT-current",
        "reason": "第 18 轮：维护 router 对外提供的 读取当前筛选 能力。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OMOD-router-INT-current",
              "name": "读取当前筛选",
              "type": "call",
              "description": "将当前地址解析为唯一规范筛选值，地址未指定时返回 All。"
            }
          }
        ]
      },
      {
        "target_ref": "OMOD-router-INT-select",
        "reason": "第 18 轮：维护 router 对外提供的 切换筛选地址 能力。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OMOD-router-INT-select",
              "name": "切换筛选地址",
              "type": "call",
              "description": "接收规范筛选选择，更新对应地址并返回当前筛选，不修改清单。"
            }
          }
        ]
      },
      {
        "target_ref": "ORES-navigation",
        "reason": "第 18 轮以逻辑资源表达页面地址，不记录具体 API。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
            }
          }
        ]
      },
      {
        "target_ref": "OREL-ui-router",
        "reason": "第 18 轮：同步 OMOD-ui 到 OMOD-router 的 calls 关系。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OREL-ui-router",
              "source_ref": "OMOD-ui",
              "target_ref": "OMOD-router",
              "type": "calls",
              "description": "页面读取规范筛选或请求切换地址，实际匹配仍委托清单状态。",
              "requirement_refs": [
                "SREQ-navigation",
                "SREQ-filter"
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OREL-router-read-location",
        "reason": "第 18 轮：同步 OMOD-router 到 ORES-navigation 的 reads 关系。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OREL-router-read-location",
              "source_ref": "OMOD-router",
              "target_ref": "ORES-navigation",
              "type": "reads",
              "description": "导航模块读取当前页面地址并解析选择。",
              "requirement_refs": [
                "SREQ-navigation"
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OREL-router-write-location",
        "reason": "第 18 轮：同步 OMOD-router 到 ORES-navigation 的 writes 关系。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OREL-router-write-location",
              "source_ref": "OMOD-router",
              "target_ref": "ORES-navigation",
              "type": "writes",
              "description": "导航模块把明确选择写为规范地址并记录页面内导航。",
              "requirement_refs": [
                "SREQ-navigation"
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OMOD-ui",
        "reason": "第 18 轮页面将筛选选择交给导航模块。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all",
              "SREQ-clear-completed",
              "SREQ-filter"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all",
              "SREQ-clear-completed",
              "SREQ-filter",
              "SREQ-navigation"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-filter-selection",
        "reason": "地址表达的选择仍使用同一筛选概念。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-filter",
              "SREQ-edit",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-toggle-all",
              "SREQ-clear-completed"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-filter",
              "SREQ-edit",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-toggle-all",
              "SREQ-clear-completed",
              "SREQ-navigation"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-filter-selection",
        "reason": "第 18 轮将导航纳入筛选选择边界。",
        "patch": [
          {
            "op": "test",
            "path": "/scope_refs",
            "value": [
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/scope_refs",
            "value": [
              "OMOD-ui",
              "OMOD-store",
              "OMOD-router"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-filter-selection",
        "reason": "第 18 轮单独管理选择与匹配，避免两个真值来源。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "ODEC-canonical-route",
        "reason": "第 18 轮：确认 采用统一的 #/ 路由形式。Specification 明确允许选择一种一致形式；采用给出的 #/ 形式不增加第二套路由，也不复制状态筛选规则。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "OSCN-select-filter",
        "reason": "第 18 轮：将 切换完成状态筛选 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-filter",
              "SREQ-display"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-filter",
              "SREQ-navigation",
              "SREQ-display"
            ]
          },
          {
            "op": "test",
            "path": "/initial_state",
            "value": "页面中有一份清单，用户选择另一种筛选。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "用户在当前页面选择另一种筛选，已有清单保持。"
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
                "id": "OPAR-select-filter-store",
                "type": "module",
                "ref": "OMOD-store",
                "name": "清单状态"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
              {
                "id": "OSCN-select-filter-STEP-1",
                "source_ref": "OPAR-select-filter-user",
                "target_ref": "OPAR-select-filter-ui",
                "type": "call",
                "action": "点击 All、Active 或 Completed 中的一个入口。"
              },
              {
                "id": "OSCN-select-filter-STEP-2",
                "source_ref": "OPAR-select-filter-ui",
                "type": "activity",
                "action": "更新当前唯一筛选选择值。"
              },
              {
                "id": "OSCN-select-filter-STEP-3",
                "source_ref": "OPAR-select-filter-ui",
                "target_ref": "OPAR-select-filter-store",
                "type": "call",
                "action": "按新筛选请求展示快照。"
              },
              {
                "id": "OSCN-select-filter-STEP-4",
                "source_ref": "OPAR-select-filter-store",
                "target_ref": "OPAR-select-filter-ui",
                "type": "return",
                "action": "返回匹配项，保留它们在完整清单中的相对顺序。"
              },
              {
                "id": "OSCN-select-filter-STEP-5",
                "source_ref": "OPAR-select-filter-ui",
                "type": "activity",
                "action": "更新可见条目并仅标示所选入口。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "筛选改变，完整清单内容和顺序保持不变。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "地址、选中入口和可见列表表达同一种筛选，完整清单保持不变。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-launch",
        "reason": "第 18 轮：将 打开页面并建立当前展示状态 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-navigation"
            ]
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
                "id": "OPAR-launch-store",
                "type": "module",
                "ref": "OMOD-store",
                "name": "清单状态"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-launch-store",
                "type": "call",
                "action": "读取本页清单展示结果。"
              },
              {
                "id": "OSCN-launch-STEP-3",
                "source_ref": "OPAR-launch-store",
                "target_ref": "OPAR-launch-ui",
                "type": "return",
                "action": "返回当前清单及本轮已经定义的派生展示值。"
              },
              {
                "id": "OSCN-launch-STEP-4",
                "source_ref": "OPAR-launch-ui",
                "type": "activity",
                "action": "呈现 todos 与新增入口，根据完整清单是否为空决定主体和页脚显示，加载后聚焦新增输入框。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "呈现 todos 与新增入口，根据完整清单是否为空决定主体和页脚显示，加载后聚焦新增输入框。"
              }
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "标题、新增入口及已确定的显示区域与当前清单一致，新增框获得焦点。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "标题、新增入口及已确定的显示区域与当前清单一致，新增框获得焦点。"
              },
              {
                "type": "state",
                "description": "筛选由当前地址确定。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "ODIAG-overview",
        "reason": "第 18 轮：同步 TodoMVC 总体架构 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OAPP-todos"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OAPP-todos",
              "ORES-navigation",
              "OREL-router-read-location",
              "OREL-router-write-location"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nOAPP_todos: \"TodoMVC\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nOAPP_todos: \"TodoMVC\"\nORES_navigation: \"页面地址与导航历史\"\nOAPP_todos -> ORES_navigation: \"reads\"\nOAPP_todos -> ORES_navigation: \"writes\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-components",
        "reason": "第 18 轮：同步 TodoMVC 内部职责与资源 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OAPP-todos",
              "OMOD-ui",
              "OMOD-store",
              "OREL-ui-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OAPP-todos",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-router",
              "ORES-navigation",
              "OREL-ui-store",
              "OREL-ui-router",
              "OREL-router-read-location",
              "OREL-router-write-location"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nOMOD_ui: \"页面交互\"\nOMOD_store: \"清单状态\"\nOMOD_ui -> OMOD_store: \"calls\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nOMOD_ui: \"页面交互\"\nOMOD_store: \"清单状态\"\nOMOD_router: \"筛选导航\"\nORES_navigation: \"页面地址与导航历史\"\nOMOD_ui -> OMOD_store: \"calls\"\nOMOD_ui -> OMOD_router: \"calls\"\nOMOD_router -> ORES_navigation: \"reads\"\nOMOD_router -> ORES_navigation: \"writes\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-launch",
        "reason": "第 18 轮：同步 打开页面并建立当前展示状态 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-launch",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-launch",
              "OMOD-ui",
              "OMOD-router",
              "ORES-navigation",
              "OMOD-store"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_launch_user: \"用户\"\nOPAR_launch_ui: \"页面交互\"\nOPAR_launch_store: \"清单状态\"\nOPAR_launch_user -> OPAR_launch_ui: \"1. 打开浏览器中的 TodoMVC 单清单应用。\"\nOPAR_launch_ui -> OPAR_launch_store: \"2. 读取本页清单展示结果。\"\nOPAR_launch_store -> OPAR_launch_ui: \"3. 返回当前清单及本轮已经定义的派生展示值。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"4. 呈现 todos 与新增入口，根据完整清单是否为空决定主体和页脚显示，加载后聚焦新增输入框。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_launch_user: \"用户\"\nOPAR_launch_ui: \"页面交互\"\nOPAR_launch_router: \"筛选导航\"\nOPAR_launch_history: \"地址与导航历史\"\nOPAR_launch_store: \"清单状态\"\nOPAR_launch_user -> OPAR_launch_ui: \"1. 打开浏览器中的 TodoMVC 单清单应用。\"\nOPAR_launch_ui -> OPAR_launch_router: \"2. 解析当前合法筛选地址；地址没有指定筛选时选择 All。\"\nOPAR_launch_router -> OPAR_launch_history: \"3. 读取当前页面地址，按已确认的路由映射确定筛选。\"\nOPAR_launch_router -> OPAR_launch_ui: \"4. 返回规范化筛选值，不改变待办数据。\"\nOPAR_launch_ui -> OPAR_launch_store: \"5. 读取本页清单展示结果。\"\nOPAR_launch_store -> OPAR_launch_ui: \"6. 返回当前清单及本轮已经定义的派生展示值。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"7. 呈现 todos 与新增入口，根据完整清单是否为空决定主体和页脚显示，加载后聚焦新增输入框。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-select-filter",
        "reason": "第 18 轮：同步 切换完成状态筛选 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-select-filter",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-select-filter",
              "OMOD-ui",
              "OMOD-router",
              "ORES-navigation",
              "OMOD-store"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_select_filter_user: \"用户\"\nOPAR_select_filter_ui: \"页面交互\"\nOPAR_select_filter_store: \"清单状态\"\nOPAR_select_filter_user -> OPAR_select_filter_ui: \"1. 点击 All、Active 或 Completed 中的一个入口。\"\nOPAR_select_filter_ui -> OPAR_select_filter_ui: \"2. 更新当前唯一筛选选择值。\"\nOPAR_select_filter_ui -> OPAR_select_filter_store: \"3. 按新筛选请求展示快照。\"\nOPAR_select_filter_store -> OPAR_select_filter_ui: \"4. 返回匹配项，保留它们在完整清单中的相对顺序。\"\nOPAR_select_filter_ui -> OPAR_select_filter_ui: \"5. 更新可见条目并仅标示所选入口。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_select_filter_user: \"用户\"\nOPAR_select_filter_ui: \"页面交互\"\nOPAR_select_filter_router: \"筛选导航\"\nOPAR_select_filter_history: \"地址与导航历史\"\nOPAR_select_filter_store: \"清单状态\"\nOPAR_select_filter_user -> OPAR_select_filter_ui: \"1. 点击一个筛选入口。\"\nOPAR_select_filter_ui -> OPAR_select_filter_router: \"2. 请求选择 All、Active 或 Completed。\"\nOPAR_select_filter_router -> OPAR_select_filter_history: \"3. 写入该选择对应的规范地址，并形成页面内导航记录。\"\nOPAR_select_filter_router -> OPAR_select_filter_ui: \"4. 返回当前规范筛选值。\"\nOPAR_select_filter_ui -> OPAR_select_filter_store: \"5. 按返回的筛选值读取展示快照。\"\nOPAR_select_filter_store -> OPAR_select_filter_ui: \"6. 返回可见项及完整清单统计。\"\nOPAR_select_filter_ui -> OPAR_select_filter_ui: \"7. 同步选中入口和可见列表，保持待办内容及顺序。\""
          }
        ]
      }
    ],
    "questions": [
      {
        "id": "QST-18",
        "question": "方案统一使用 #/、#/active、#/completed，不同时支持 #!/，是否符合已确认的地址需求？",
        "description": "模拟 Clarify；仅依据本轮已确认的 Specification：本轮 Record 的 QST-2 与 SREQ-navigation。",
        "answer": "符合。已确认可以统一采用 #/，只需三个入口和导航一致，不要求两套形式同时支持。"
      }
    ],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受统一 #/ 地址形式，导航只管理选择、清单负责匹配。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-19",
    "origin_refs": [
      "SFEA-filter",
      "SREQ-navigation",
      "SREQ-filter"
    ],
    "changes": [
      {
        "target_ref": "OMOD-router",
        "reason": "第 19 轮扩展到外部历史导航。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "拥有地址与规范筛选值之间的映射，提供当前选择读取与页面内选择切换；不持有待办、不实现完成状态匹配规则。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "拥有地址与规范筛选值的映射，处理首次读取、点击切换和浏览器历史变化；地址变化后通知页面规范选择，不持有待办或复制匹配规则。"
          }
        ]
      },
      {
        "target_ref": "OMOD-router-INT-changed",
        "reason": "第 19 轮：维护 router 对外提供的 筛选已变化 能力。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OMOD-router-INT-changed",
              "name": "筛选已变化",
              "type": "event",
              "description": "当浏览器历史导航引起地址变化时发布规范筛选值，通知页面同步选中项和展示投影。"
            }
          }
        ]
      },
      {
        "target_ref": "OREL-ui-router-events",
        "reason": "第 19 轮：同步 OMOD-ui 到 OMOD-router 的 subscribes 关系。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OREL-ui-router-events",
              "source_ref": "OMOD-ui",
              "target_ref": "OMOD-router",
              "type": "subscribes",
              "description": "页面订阅导航模块发布的筛选变化，重新读取清单投影而不修改清单。",
              "requirement_refs": [
                "SREQ-navigation",
                "SREQ-filter"
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OREL-router-history-events",
        "reason": "第 19 轮：同步 OMOD-router 到 ORES-navigation 的 subscribes 关系。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OREL-router-history-events",
              "source_ref": "OMOD-router",
              "target_ref": "ORES-navigation",
              "type": "subscribes",
              "description": "导航模块接收地址与历史的外部变化，再解析当前规范筛选。",
              "requirement_refs": [
                "SREQ-navigation"
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OCON-filter-selection",
        "reason": "第 19 轮防止监听地址变化时反复追加历史。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "ODEC-navigation-refresh",
        "reason": "第 19 轮：确认 筛选恢复与待办恢复分开。已确认刷新仅验收地址筛选，不能把页面内导航错误处理为重建清单。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "OSCN-history-back",
        "reason": "第 19 轮：将 浏览器后退同步筛选 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
            }
          }
        ]
      },
      {
        "target_ref": "OSCN-history-forward",
        "reason": "第 19 轮：将 浏览器前进同步筛选 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-overview",
        "reason": "第 19 轮：同步 TodoMVC 总体架构 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OAPP-todos",
              "ORES-navigation",
              "OREL-router-read-location",
              "OREL-router-write-location"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OAPP-todos",
              "ORES-navigation",
              "OREL-router-read-location",
              "OREL-router-write-location",
              "OREL-router-history-events"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nOAPP_todos: \"TodoMVC\"\nORES_navigation: \"页面地址与导航历史\"\nOAPP_todos -> ORES_navigation: \"reads\"\nOAPP_todos -> ORES_navigation: \"writes\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nOAPP_todos: \"TodoMVC\"\nORES_navigation: \"页面地址与导航历史\"\nOAPP_todos -> ORES_navigation: \"reads\"\nOAPP_todos -> ORES_navigation: \"writes\"\nOAPP_todos -> ORES_navigation: \"subscribes\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-components",
        "reason": "第 19 轮：同步 TodoMVC 内部职责与资源 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OAPP-todos",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-router",
              "ORES-navigation",
              "OREL-ui-store",
              "OREL-ui-router",
              "OREL-router-read-location",
              "OREL-router-write-location"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OAPP-todos",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-router",
              "ORES-navigation",
              "OREL-ui-store",
              "OREL-ui-router",
              "OREL-router-read-location",
              "OREL-router-write-location",
              "OREL-ui-router-events",
              "OREL-router-history-events"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nOMOD_ui: \"页面交互\"\nOMOD_store: \"清单状态\"\nOMOD_router: \"筛选导航\"\nORES_navigation: \"页面地址与导航历史\"\nOMOD_ui -> OMOD_store: \"calls\"\nOMOD_ui -> OMOD_router: \"calls\"\nOMOD_router -> ORES_navigation: \"reads\"\nOMOD_router -> ORES_navigation: \"writes\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nOMOD_ui: \"页面交互\"\nOMOD_store: \"清单状态\"\nOMOD_router: \"筛选导航\"\nORES_navigation: \"页面地址与导航历史\"\nOMOD_ui -> OMOD_store: \"calls\"\nOMOD_ui -> OMOD_router: \"calls\"\nOMOD_router -> ORES_navigation: \"reads\"\nOMOD_router -> ORES_navigation: \"writes\"\nOMOD_ui -> OMOD_router: \"subscribes\"\nOMOD_router -> ORES_navigation: \"subscribes\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-history-back",
        "reason": "第 19 轮：同步 浏览器后退同步筛选 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-history-forward",
        "reason": "第 19 轮：同步 浏览器前进同步筛选 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受历史变化只读当前地址、不重复写历史，刷新只恢复地址筛选。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-20",
    "origin_refs": [
      "SFEA-persistence",
      "SREQ-persist",
      "SCON-local-storage"
    ],
    "changes": [
      {
        "target_ref": "OMOD-storage",
        "reason": "第 20 轮引入保存适配职责。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OMOD-storage",
              "parent_ref": "OAPP-todos",
              "name": "保存适配",
              "status": "active",
              "description": "把状态模块提交的完整清单写入当前实现隔离的浏览器保存空间；封装保存边界和结果，不接收界面草稿，不承担筛选和清单业务修改。",
              "requirement_refs": [
                "SREQ-persist"
              ],
              "constraint_refs": [
                "SCON-local-storage"
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OMOD-storage-INT-save",
        "reason": "第 20 轮：维护 storage 对外提供的 保存已提交清单 能力。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OMOD-storage-INT-save",
              "name": "保存已提交清单",
              "type": "call",
              "description": "接收当前完整清单快照，写入当前实现的保存空间并返回成功或失败，不覆盖其他实现的数据。"
            }
          }
        ]
      },
      {
        "target_ref": "ORES-todo-data",
        "reason": "第 20 轮声明保存能力和隔离约束，具体存储选择通过 Decision 对应 Specification。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
          }
        ]
      },
      {
        "target_ref": "OREL-store-storage",
        "reason": "第 20 轮：同步 OMOD-store 到 OMOD-storage 的 calls 关系。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "OREL-store-storage",
              "source_ref": "OMOD-store",
              "target_ref": "OMOD-storage",
              "type": "calls",
              "description": "清单状态在有效变更后提交完整快照给保存适配，并读取保存结果；保存不由界面重绘触发。",
              "requirement_refs": [
                "SREQ-persist"
              ]
            }
          }
        ]
      },
      {
        "target_ref": "OREL-storage-writes",
        "reason": "第 20 轮：同步 OMOD-storage 到 ORES-todo-data 的 writes 关系。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
          }
        ]
      },
      {
        "target_ref": "OMOD-store",
        "reason": "第 20 轮所有有效变更必须经过统一保存出口。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all",
              "SREQ-clear-completed",
              "SREQ-filter"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store",
        "reason": "第 20 轮让保存接入统一命令出口而非分散到控件。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "拥有本页完整清单；统一接收有效变更并返回只读展示快照，页面不直接改写清单。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "拥有本页完整清单，统一处理用户命令并派生展示快照；有效变更通过保存适配提交最新清单，界面重绘不能触发额外写入。"
          }
        ]
      },
      {
        "target_ref": "ODEC-storage-adapter",
        "reason": "第 20 轮：确认 统一提交出口与浏览器保存适配。新增、编辑和各删除入口需要一致自动保存；隔离存储细节可避免每个界面动作分别实现保存逻辑。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "OCON-commit-boundary",
        "reason": "第 20 轮：形成或修订 业务提交与保存边界，由引用的需求限定设计规则。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
                }
              ],
              "scope_refs": [
                "OMOD-store",
                "OMOD-storage"
              ],
              "requirement_refs": [
                "SREQ-persist"
              ],
              "constraint_refs": [
                "SCON-local-storage"
              ],
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ORISK-storage-failure",
        "reason": "第 20 轮记录输入未定义的异常恢复边界，不伪造用户答案或扩大正常路径验收。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "OSCN-create",
        "reason": "第 20 轮：将 有效标题新增一条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/initial_state",
            "value": "新增草稿去除首尾空白后非空，可与已有条目同名。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "新增草稿去除首尾空白后非空，可与已有条目同名。 本场景保存资源可用。"
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-create-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-create-STEP-5",
                "source_ref": "OPAR-create-ui",
                "target_ref": "OPAR-create-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-create-STEP-6",
                "source_ref": "OPAR-create-store",
                "target_ref": "OPAR-create-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-create-STEP-7",
                "source_ref": "OPAR-create-ui",
                "type": "activity",
                "action": "只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。"
              },
              {
                "type": "state",
                "description": "存储中该实现的最新清单与本次已提交结果一致。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-complete",
        "reason": "第 20 轮：将 完成单条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/initial_state",
            "value": "目标待办存在且未完成。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "目标待办存在且未完成。 本场景保存资源可用。"
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-complete-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-complete-STEP-5",
                "source_ref": "OPAR-complete-ui",
                "target_ref": "OPAR-complete-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-complete-STEP-6",
                "source_ref": "OPAR-complete-store",
                "target_ref": "OPAR-complete-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-complete-STEP-7",
                "source_ref": "OPAR-complete-ui",
                "type": "activity",
                "action": "目标立即呈现选中与完成删除线，其他待办不变。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "目标立即呈现选中与完成删除线，其他待办不变。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "目标立即呈现选中与完成删除线，其他待办不变。"
              },
              {
                "type": "state",
                "description": "存储中该实现的最新清单与本次已提交结果一致。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen",
        "reason": "第 20 轮：将 重新打开单条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/initial_state",
            "value": "目标待办存在且已完成。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "目标待办存在且已完成。 本场景保存资源可用。"
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-reopen-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-reopen-STEP-5",
                "source_ref": "OPAR-reopen-ui",
                "target_ref": "OPAR-reopen-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-reopen-STEP-6",
                "source_ref": "OPAR-reopen-store",
                "target_ref": "OPAR-reopen-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-reopen-STEP-7",
                "source_ref": "OPAR-reopen-ui",
                "type": "activity",
                "action": "目标立即恢复未完成样式，其他待办不变。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "目标立即恢复未完成样式，其他待办不变。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "目标立即恢复未完成样式，其他待办不变。"
              },
              {
                "type": "state",
                "description": "存储中该实现的最新清单与本次已提交结果一致。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-submit-edit",
        "reason": "第 20 轮：将 提交非空编辑标题 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-edit",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-edit",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/initial_state",
            "value": "目标的编辑会话有效，草稿整理后非空。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "目标的编辑会话有效，草稿整理后非空。 本场景保存资源可用。"
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-submit-edit-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-submit-edit-STEP-6",
                "source_ref": "OPAR-submit-edit-ui",
                "target_ref": "OPAR-submit-edit-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-submit-edit-STEP-7",
                "source_ref": "OPAR-submit-edit-store",
                "target_ref": "OPAR-submit-edit-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-submit-edit-STEP-8",
                "source_ref": "OPAR-submit-edit-ui",
                "type": "activity",
                "action": "退出编辑并显示同一待办的新标题，后续失焦不会重复提交。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "退出编辑并显示同一待办的新标题，后续失焦不会重复提交。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "退出编辑并显示同一待办的新标题，后续失焦不会重复提交。"
              },
              {
                "type": "state",
                "description": "存储中该实现的最新清单与本次已提交结果一致。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-delete-by-edit",
        "reason": "第 20 轮：将 提交空标题删除待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-edit",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-edit",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/initial_state",
            "value": "目标编辑会话有效，草稿整理后为空。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "目标编辑会话有效，草稿整理后为空。 本场景保存资源可用。"
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-delete-by-edit-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-delete-by-edit-STEP-6",
                "source_ref": "OPAR-delete-by-edit-ui",
                "target_ref": "OPAR-delete-by-edit-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-delete-by-edit-STEP-7",
                "source_ref": "OPAR-delete-by-edit-store",
                "target_ref": "OPAR-delete-by-edit-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-delete-by-edit-STEP-8",
                "source_ref": "OPAR-delete-by-edit-ui",
                "type": "activity",
                "action": "仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。"
              },
              {
                "type": "state",
                "description": "存储中该实现的最新清单与本次已提交结果一致。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-delete",
        "reason": "第 20 轮：将 直接删除一条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-delete",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-delete",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/initial_state",
            "value": "目标待办存在且不在编辑状态。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "目标待办存在且不在编辑状态。 本场景保存资源可用。"
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-delete-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-delete-STEP-5",
                "source_ref": "OPAR-delete-ui",
                "target_ref": "OPAR-delete-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-delete-STEP-6",
                "source_ref": "OPAR-delete-store",
                "target_ref": "OPAR-delete-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-delete-STEP-7",
                "source_ref": "OPAR-delete-ui",
                "type": "activity",
                "action": "只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。"
              },
              {
                "type": "state",
                "description": "存储中该实现的最新清单与本次已提交结果一致。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-complete-all",
        "reason": "第 20 轮：将 完成整份清单 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle-all",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle-all",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/initial_state",
            "value": "清单非空，存在未完成待办。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "清单非空，存在未完成待办。 本场景保存资源可用。"
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-complete-all-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-complete-all-STEP-5",
                "source_ref": "OPAR-complete-all-ui",
                "target_ref": "OPAR-complete-all-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-complete-all-STEP-6",
                "source_ref": "OPAR-complete-all-store",
                "target_ref": "OPAR-complete-all-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-complete-all-STEP-7",
                "source_ref": "OPAR-complete-all-ui",
                "type": "activity",
                "action": "未完成数量为零，全选选中，所有标题和顺序保持。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "未完成数量为零，全选选中，所有标题和顺序保持。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "未完成数量为零，全选选中，所有标题和顺序保持。"
              },
              {
                "type": "state",
                "description": "存储中该实现的最新清单与本次已提交结果一致。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen-all",
        "reason": "第 20 轮：将 重新打开整份清单 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle-all",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-toggle-all",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/initial_state",
            "value": "清单非空且全选已选中。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "清单非空且全选已选中。 本场景保存资源可用。"
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-reopen-all-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-reopen-all-STEP-5",
                "source_ref": "OPAR-reopen-all-ui",
                "target_ref": "OPAR-reopen-all-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-reopen-all-STEP-6",
                "source_ref": "OPAR-reopen-all-store",
                "target_ref": "OPAR-reopen-all-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-reopen-all-STEP-7",
                "source_ref": "OPAR-reopen-all-ui",
                "type": "activity",
                "action": "未完成数量等于完整清单总数，全选未选中，标题和顺序保持。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "未完成数量等于完整清单总数，全选未选中，标题和顺序保持。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "未完成数量等于完整清单总数，全选未选中，标题和顺序保持。"
              },
              {
                "type": "state",
                "description": "存储中该实现的最新清单与本次已提交结果一致。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-clear-completed",
        "reason": "第 20 轮：将 清除整份清单的已完成待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-clear-completed",
              "SREQ-toggle-all",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-clear-completed",
              "SREQ-toggle-all",
              "SREQ-display",
              "SREQ-count",
              "SREQ-filter",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/initial_state",
            "value": "完整清单存在已完成待办。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "完整清单存在已完成待办。 本场景保存资源可用。"
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-clear-completed-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-clear-completed-STEP-5",
                "source_ref": "OPAR-clear-completed-ui",
                "target_ref": "OPAR-clear-completed-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-clear-completed-STEP-6",
                "source_ref": "OPAR-clear-completed-store",
                "target_ref": "OPAR-clear-completed-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-clear-completed-STEP-7",
                "source_ref": "OPAR-clear-completed-ui",
                "type": "activity",
                "action": "清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。"
              },
              {
                "type": "state",
                "description": "存储中该实现的最新清单与本次已提交结果一致。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-complete-in-active",
        "reason": "第 20 轮：将 在 Active 中完成待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-filter",
              "SREQ-toggle",
              "SREQ-display",
              "SREQ-count"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-filter",
              "SREQ-toggle",
              "SREQ-display",
              "SREQ-count",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/initial_state",
            "value": "当前为 Active，目标待办未完成。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "当前为 Active，目标待办未完成。 本场景保存资源可用。"
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-complete-in-active-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-complete-in-active-STEP-5",
                "source_ref": "OPAR-complete-in-active-ui",
                "target_ref": "OPAR-complete-in-active-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-complete-in-active-STEP-6",
                "source_ref": "OPAR-complete-in-active-store",
                "target_ref": "OPAR-complete-in-active-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-complete-in-active-STEP-7",
                "source_ref": "OPAR-complete-in-active-ui",
                "type": "activity",
                "action": "目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。"
              },
              {
                "type": "state",
                "description": "存储中该实现的最新清单与本次已提交结果一致。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen-in-completed",
        "reason": "第 20 轮：将 在 Completed 中重新打开待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-filter",
              "SREQ-toggle",
              "SREQ-display",
              "SREQ-count"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-filter",
              "SREQ-toggle",
              "SREQ-display",
              "SREQ-count",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/initial_state",
            "value": "当前为 Completed，目标待办已完成。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "当前为 Completed，目标待办已完成。 本场景保存资源可用。"
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-reopen-in-completed-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-reopen-in-completed-STEP-5",
                "source_ref": "OPAR-reopen-in-completed-ui",
                "target_ref": "OPAR-reopen-in-completed-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-reopen-in-completed-STEP-6",
                "source_ref": "OPAR-reopen-in-completed-store",
                "target_ref": "OPAR-reopen-in-completed-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-reopen-in-completed-STEP-7",
                "source_ref": "OPAR-reopen-in-completed-ui",
                "type": "activity",
                "action": "目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。"
              },
              {
                "type": "state",
                "description": "存储中该实现的最新清单与本次已提交结果一致。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-create-in-completed",
        "reason": "第 20 轮：将 在 Completed 中新增未完成待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-filter",
              "SREQ-count",
              "SREQ-display"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-create",
              "SREQ-filter",
              "SREQ-count",
              "SREQ-display",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/initial_state",
            "value": "当前为 Completed，新增草稿有效。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "当前为 Completed，新增草稿有效。 本场景保存资源可用。"
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-create-in-completed-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-create-in-completed-STEP-5",
                "source_ref": "OPAR-create-in-completed-ui",
                "target_ref": "OPAR-create-in-completed-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-create-in-completed-STEP-6",
                "source_ref": "OPAR-create-in-completed-store",
                "target_ref": "OPAR-create-in-completed-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-create-in-completed-STEP-7",
                "source_ref": "OPAR-create-in-completed-ui",
                "type": "activity",
                "action": "新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。"
              },
              {
                "type": "state",
                "description": "存储中该实现的最新清单与本次已提交结果一致。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-clear-hidden-completed",
        "reason": "第 20 轮：将 在 Active 中清除隐藏的已完成项 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-filter",
              "SREQ-clear-completed",
              "SREQ-count",
              "SREQ-display"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-filter",
              "SREQ-clear-completed",
              "SREQ-count",
              "SREQ-display",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/initial_state",
            "value": "当前为 Active，完整清单有已完成项。"
          },
          {
            "op": "replace",
            "path": "/initial_state",
            "value": "当前为 Active，完整清单有已完成项。 本场景保存资源可用。"
          },
          {
            "op": "test",
            "path": "/participants",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/participants",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "target_ref": "OPAR-clear-hidden-completed-ui",
                "type": "return",
                "action": "返回本次命令结果，界面保留当前筛选。"
              },
              {
                "id": "OSCN-clear-hidden-completed-STEP-5",
                "source_ref": "OPAR-clear-hidden-completed-ui",
                "target_ref": "OPAR-clear-hidden-completed-store",
                "type": "call",
                "action": "按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。"
              },
              {
                "id": "OSCN-clear-hidden-completed-STEP-6",
                "source_ref": "OPAR-clear-hidden-completed-store",
                "target_ref": "OPAR-clear-hidden-completed-ui",
                "type": "return",
                "action": "返回一致的展示快照。"
              },
              {
                "id": "OSCN-clear-hidden-completed-STEP-7",
                "source_ref": "OPAR-clear-hidden-completed-ui",
                "type": "activity",
                "action": "隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。"
              },
              {
                "type": "state",
                "description": "存储中该实现的最新清单与本次已提交结果一致。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "ODIAG-overview",
        "reason": "第 20 轮：同步 TodoMVC 总体架构 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OAPP-todos",
              "ORES-navigation",
              "OREL-router-read-location",
              "OREL-router-write-location",
              "OREL-router-history-events"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OAPP-todos",
              "ORES-navigation",
              "ORES-todo-data",
              "OREL-router-read-location",
              "OREL-router-write-location",
              "OREL-router-history-events",
              "OREL-storage-writes"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nOAPP_todos: \"TodoMVC\"\nORES_navigation: \"页面地址与导航历史\"\nOAPP_todos -> ORES_navigation: \"reads\"\nOAPP_todos -> ORES_navigation: \"writes\"\nOAPP_todos -> ORES_navigation: \"subscribes\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nOAPP_todos: \"TodoMVC\"\nORES_navigation: \"页面地址与导航历史\"\nORES_todo_data: \"浏览器内待办保存空间\"\nOAPP_todos -> ORES_navigation: \"reads\"\nOAPP_todos -> ORES_navigation: \"writes\"\nOAPP_todos -> ORES_navigation: \"subscribes\"\nOAPP_todos -> ORES_todo_data: \"writes\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-components",
        "reason": "第 20 轮：同步 TodoMVC 内部职责与资源 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OAPP-todos",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-router",
              "ORES-navigation",
              "OREL-ui-store",
              "OREL-ui-router",
              "OREL-router-read-location",
              "OREL-router-write-location",
              "OREL-ui-router-events",
              "OREL-router-history-events"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
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
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "direction: right\nOMOD_ui: \"页面交互\"\nOMOD_store: \"清单状态\"\nOMOD_router: \"筛选导航\"\nORES_navigation: \"页面地址与导航历史\"\nOMOD_ui -> OMOD_store: \"calls\"\nOMOD_ui -> OMOD_router: \"calls\"\nOMOD_router -> ORES_navigation: \"reads\"\nOMOD_router -> ORES_navigation: \"writes\"\nOMOD_ui -> OMOD_router: \"subscribes\"\nOMOD_router -> ORES_navigation: \"subscribes\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "direction: right\nOMOD_ui: \"页面交互\"\nOMOD_store: \"清单状态\"\nOMOD_router: \"筛选导航\"\nOMOD_storage: \"保存适配\"\nORES_navigation: \"页面地址与导航历史\"\nORES_todo_data: \"浏览器内待办保存空间\"\nOMOD_ui -> OMOD_store: \"calls\"\nOMOD_ui -> OMOD_router: \"calls\"\nOMOD_router -> ORES_navigation: \"reads\"\nOMOD_router -> ORES_navigation: \"writes\"\nOMOD_ui -> OMOD_router: \"subscribes\"\nOMOD_router -> ORES_navigation: \"subscribes\"\nOMOD_store -> OMOD_storage: \"calls\"\nOMOD_storage -> ORES_todo_data: \"writes\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-create",
        "reason": "第 20 轮：同步 有效标题新增一条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-create",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-create",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-storage",
              "ORES-todo-data"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_user: \"用户\"\nOPAR_create_ui: \"页面交互\"\nOPAR_create_store: \"清单状态\"\nOPAR_create_user -> OPAR_create_ui: \"1. 在新增框按 Enter。\"\nOPAR_create_ui -> OPAR_create_store: \"2. 整理标题并验证非空，为本次新增分配独立身份，保留中间空格。\"\nOPAR_create_store -> OPAR_create_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_store -> OPAR_create_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_ui -> OPAR_create_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_store -> OPAR_create_ui: \"6. 返回一致的展示快照。\"\nOPAR_create_ui -> OPAR_create_ui: \"7. 只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_user: \"用户\"\nOPAR_create_ui: \"页面交互\"\nOPAR_create_store: \"清单状态\"\nOPAR_create_storage: \"保存适配\"\nOPAR_create_saved: \"浏览器内待办数据\"\nOPAR_create_user -> OPAR_create_ui: \"1. 在新增框按 Enter。\"\nOPAR_create_ui -> OPAR_create_store: \"2. 整理标题并验证非空，为本次新增分配独立身份，保留中间空格。\"\nOPAR_create_store -> OPAR_create_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_store -> OPAR_create_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_create_storage -> OPAR_create_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_create_storage -> OPAR_create_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_create_store -> OPAR_create_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_ui -> OPAR_create_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_store -> OPAR_create_ui: \"9. 返回一致的展示快照。\"\nOPAR_create_ui -> OPAR_create_ui: \"10. 只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-complete",
        "reason": "第 20 轮：同步 完成单条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-complete",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-complete",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-storage",
              "ORES-todo-data"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_user: \"用户\"\nOPAR_complete_ui: \"页面交互\"\nOPAR_complete_store: \"清单状态\"\nOPAR_complete_user -> OPAR_complete_ui: \"1. 勾选目标待办。\"\nOPAR_complete_ui -> OPAR_complete_store: \"2. 按身份把目标设为已完成。\"\nOPAR_complete_store -> OPAR_complete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_store -> OPAR_complete_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_ui -> OPAR_complete_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_store -> OPAR_complete_ui: \"6. 返回一致的展示快照。\"\nOPAR_complete_ui -> OPAR_complete_ui: \"7. 目标立即呈现选中与完成删除线，其他待办不变。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_user: \"用户\"\nOPAR_complete_ui: \"页面交互\"\nOPAR_complete_store: \"清单状态\"\nOPAR_complete_storage: \"保存适配\"\nOPAR_complete_saved: \"浏览器内待办数据\"\nOPAR_complete_user -> OPAR_complete_ui: \"1. 勾选目标待办。\"\nOPAR_complete_ui -> OPAR_complete_store: \"2. 按身份把目标设为已完成。\"\nOPAR_complete_store -> OPAR_complete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_store -> OPAR_complete_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_complete_storage -> OPAR_complete_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_storage -> OPAR_complete_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_store -> OPAR_complete_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_ui -> OPAR_complete_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_store -> OPAR_complete_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_ui -> OPAR_complete_ui: \"10. 目标立即呈现选中与完成删除线，其他待办不变。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reopen",
        "reason": "第 20 轮：同步 重新打开单条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-reopen",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-reopen",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-storage",
              "ORES-todo-data"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_user: \"用户\"\nOPAR_reopen_ui: \"页面交互\"\nOPAR_reopen_store: \"清单状态\"\nOPAR_reopen_user -> OPAR_reopen_ui: \"1. 取消目标勾选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"2. 按身份把目标设为未完成。\"\nOPAR_reopen_store -> OPAR_reopen_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"6. 返回一致的展示快照。\"\nOPAR_reopen_ui -> OPAR_reopen_ui: \"7. 目标立即恢复未完成样式，其他待办不变。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_user: \"用户\"\nOPAR_reopen_ui: \"页面交互\"\nOPAR_reopen_store: \"清单状态\"\nOPAR_reopen_storage: \"保存适配\"\nOPAR_reopen_saved: \"浏览器内待办数据\"\nOPAR_reopen_user -> OPAR_reopen_ui: \"1. 取消目标勾选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"2. 按身份把目标设为未完成。\"\nOPAR_reopen_store -> OPAR_reopen_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_store -> OPAR_reopen_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_reopen_storage -> OPAR_reopen_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_storage -> OPAR_reopen_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_ui -> OPAR_reopen_ui: \"10. 目标立即恢复未完成样式，其他待办不变。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-submit-edit",
        "reason": "第 20 轮：同步 提交非空编辑标题 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-submit-edit",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-submit-edit",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-storage",
              "ORES-todo-data"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_submit_edit_user: \"用户\"\nOPAR_submit_edit_ui: \"页面交互\"\nOPAR_submit_edit_store: \"清单状态\"\nOPAR_submit_edit_user -> OPAR_submit_edit_ui: \"1. 通过 Enter 或编辑框失焦提交草稿。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"3. 按原身份提交整理后的非空标题，保留完成状态与位置。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"5. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"6. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"7. 返回一致的展示快照。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"8. 退出编辑并显示同一待办的新标题，后续失焦不会重复提交。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_submit_edit_user: \"用户\"\nOPAR_submit_edit_ui: \"页面交互\"\nOPAR_submit_edit_store: \"清单状态\"\nOPAR_submit_edit_storage: \"保存适配\"\nOPAR_submit_edit_saved: \"浏览器内待办数据\"\nOPAR_submit_edit_user -> OPAR_submit_edit_ui: \"1. 通过 Enter 或编辑框失焦提交草稿。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"3. 按原身份提交整理后的非空标题，保留完成状态与位置。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_storage: \"5. 提交本次有效变化后的最新待办清单。\"\nOPAR_submit_edit_storage -> OPAR_submit_edit_saved: \"6. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_submit_edit_storage -> OPAR_submit_edit_store: \"7. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"8. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"9. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"10. 返回一致的展示快照。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"11. 退出编辑并显示同一待办的新标题，后续失焦不会重复提交。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-delete-by-edit",
        "reason": "第 20 轮：同步 提交空标题删除待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-delete-by-edit",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-delete-by-edit",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-storage",
              "ORES-todo-data"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_by_edit_user: \"用户\"\nOPAR_delete_by_edit_ui: \"页面交互\"\nOPAR_delete_by_edit_store: \"清单状态\"\nOPAR_delete_by_edit_user -> OPAR_delete_by_edit_ui: \"1. 按 Enter 或使编辑框失焦。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"3. 按编辑会话绑定的身份移除目标待办。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"5. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"6. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"7. 返回一致的展示快照。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"8. 仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_by_edit_user: \"用户\"\nOPAR_delete_by_edit_ui: \"页面交互\"\nOPAR_delete_by_edit_store: \"清单状态\"\nOPAR_delete_by_edit_storage: \"保存适配\"\nOPAR_delete_by_edit_saved: \"浏览器内待办数据\"\nOPAR_delete_by_edit_user -> OPAR_delete_by_edit_ui: \"1. 按 Enter 或使编辑框失焦。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"3. 按编辑会话绑定的身份移除目标待办。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_storage: \"5. 提交本次有效变化后的最新待办清单。\"\nOPAR_delete_by_edit_storage -> OPAR_delete_by_edit_saved: \"6. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_delete_by_edit_storage -> OPAR_delete_by_edit_store: \"7. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"8. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"9. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"10. 返回一致的展示快照。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"11. 仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-delete",
        "reason": "第 20 轮：同步 直接删除一条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-delete",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-delete",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-storage",
              "ORES-todo-data"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_user: \"用户\"\nOPAR_delete_ui: \"页面交互\"\nOPAR_delete_store: \"清单状态\"\nOPAR_delete_user -> OPAR_delete_ui: \"1. 悬停目标行并点击删除按钮。\"\nOPAR_delete_ui -> OPAR_delete_store: \"2. 按被点击条目的身份执行移除。\"\nOPAR_delete_store -> OPAR_delete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_store -> OPAR_delete_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_ui -> OPAR_delete_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_store -> OPAR_delete_ui: \"6. 返回一致的展示快照。\"\nOPAR_delete_ui -> OPAR_delete_ui: \"7. 只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_user: \"用户\"\nOPAR_delete_ui: \"页面交互\"\nOPAR_delete_store: \"清单状态\"\nOPAR_delete_storage: \"保存适配\"\nOPAR_delete_saved: \"浏览器内待办数据\"\nOPAR_delete_user -> OPAR_delete_ui: \"1. 悬停目标行并点击删除按钮。\"\nOPAR_delete_ui -> OPAR_delete_store: \"2. 按被点击条目的身份执行移除。\"\nOPAR_delete_store -> OPAR_delete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_store -> OPAR_delete_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_delete_storage -> OPAR_delete_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_delete_storage -> OPAR_delete_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_delete_store -> OPAR_delete_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_ui -> OPAR_delete_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_store -> OPAR_delete_ui: \"9. 返回一致的展示快照。\"\nOPAR_delete_ui -> OPAR_delete_ui: \"10. 只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-complete-all",
        "reason": "第 20 轮：同步 完成整份清单 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-complete-all",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-complete-all",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-storage",
              "ORES-todo-data"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_all_user: \"用户\"\nOPAR_complete_all_ui: \"页面交互\"\nOPAR_complete_all_store: \"清单状态\"\nOPAR_complete_all_user -> OPAR_complete_all_ui: \"1. 把全选控件设为选中。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"2. 把完整清单所有条目标为已完成。\"\nOPAR_complete_all_store -> OPAR_complete_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"6. 返回一致的展示快照。\"\nOPAR_complete_all_ui -> OPAR_complete_all_ui: \"7. 未完成数量为零，全选选中，所有标题和顺序保持。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_all_user: \"用户\"\nOPAR_complete_all_ui: \"页面交互\"\nOPAR_complete_all_store: \"清单状态\"\nOPAR_complete_all_storage: \"保存适配\"\nOPAR_complete_all_saved: \"浏览器内待办数据\"\nOPAR_complete_all_user -> OPAR_complete_all_ui: \"1. 把全选控件设为选中。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"2. 把完整清单所有条目标为已完成。\"\nOPAR_complete_all_store -> OPAR_complete_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_all_store -> OPAR_complete_all_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_complete_all_storage -> OPAR_complete_all_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_all_storage -> OPAR_complete_all_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_all_ui -> OPAR_complete_all_ui: \"10. 未完成数量为零，全选选中，所有标题和顺序保持。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reopen-all",
        "reason": "第 20 轮：同步 重新打开整份清单 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-reopen-all",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-reopen-all",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-storage",
              "ORES-todo-data"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_all_user: \"用户\"\nOPAR_reopen_all_ui: \"页面交互\"\nOPAR_reopen_all_store: \"清单状态\"\nOPAR_reopen_all_user -> OPAR_reopen_all_ui: \"1. 取消全选控件。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"2. 把完整清单所有条目标为未完成。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"6. 返回一致的展示快照。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_ui: \"7. 未完成数量等于完整清单总数，全选未选中，标题和顺序保持。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_all_user: \"用户\"\nOPAR_reopen_all_ui: \"页面交互\"\nOPAR_reopen_all_store: \"清单状态\"\nOPAR_reopen_all_storage: \"保存适配\"\nOPAR_reopen_all_saved: \"浏览器内待办数据\"\nOPAR_reopen_all_user -> OPAR_reopen_all_ui: \"1. 取消全选控件。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"2. 把完整清单所有条目标为未完成。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_reopen_all_storage -> OPAR_reopen_all_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_all_storage -> OPAR_reopen_all_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_ui: \"10. 未完成数量等于完整清单总数，全选未选中，标题和顺序保持。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-clear-completed",
        "reason": "第 20 轮：同步 清除整份清单的已完成待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-clear-completed",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-clear-completed",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-storage",
              "ORES-todo-data"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_clear_completed_user: \"用户\"\nOPAR_clear_completed_ui: \"页面交互\"\nOPAR_clear_completed_store: \"清单状态\"\nOPAR_clear_completed_user -> OPAR_clear_completed_ui: \"1. 点击 Clear completed。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"2. 移除完整清单中全部已完成身份，保留未完成项。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"6. 返回一致的展示快照。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_ui: \"7. 清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_clear_completed_user: \"用户\"\nOPAR_clear_completed_ui: \"页面交互\"\nOPAR_clear_completed_store: \"清单状态\"\nOPAR_clear_completed_storage: \"保存适配\"\nOPAR_clear_completed_saved: \"浏览器内待办数据\"\nOPAR_clear_completed_user -> OPAR_clear_completed_ui: \"1. 点击 Clear completed。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"2. 移除完整清单中全部已完成身份，保留未完成项。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_clear_completed_storage -> OPAR_clear_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_clear_completed_storage -> OPAR_clear_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_ui: \"10. 清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-complete-in-active",
        "reason": "第 20 轮：同步 在 Active 中完成待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-complete-in-active",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-complete-in-active",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-storage",
              "ORES-todo-data"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_in_active_user: \"用户\"\nOPAR_complete_in_active_ui: \"页面交互\"\nOPAR_complete_in_active_store: \"清单状态\"\nOPAR_complete_in_active_user -> OPAR_complete_in_active_ui: \"1. 勾选当前可见目标。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"2. 按原身份设为已完成，不修改筛选选择。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"6. 返回一致的展示快照。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_ui: \"7. 目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_in_active_user: \"用户\"\nOPAR_complete_in_active_ui: \"页面交互\"\nOPAR_complete_in_active_store: \"清单状态\"\nOPAR_complete_in_active_storage: \"保存适配\"\nOPAR_complete_in_active_saved: \"浏览器内待办数据\"\nOPAR_complete_in_active_user -> OPAR_complete_in_active_ui: \"1. 勾选当前可见目标。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"2. 按原身份设为已完成，不修改筛选选择。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_complete_in_active_storage -> OPAR_complete_in_active_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_in_active_storage -> OPAR_complete_in_active_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_ui: \"10. 目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reopen-in-completed",
        "reason": "第 20 轮：同步 在 Completed 中重新打开待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-reopen-in-completed",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-reopen-in-completed",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-storage",
              "ORES-todo-data"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_in_completed_user: \"用户\"\nOPAR_reopen_in_completed_ui: \"页面交互\"\nOPAR_reopen_in_completed_store: \"清单状态\"\nOPAR_reopen_in_completed_user -> OPAR_reopen_in_completed_ui: \"1. 取消当前可见目标的勾选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"2. 按原身份设为未完成，不修改筛选选择。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"6. 返回一致的展示快照。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_ui: \"7. 目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_in_completed_user: \"用户\"\nOPAR_reopen_in_completed_ui: \"页面交互\"\nOPAR_reopen_in_completed_store: \"清单状态\"\nOPAR_reopen_in_completed_storage: \"保存适配\"\nOPAR_reopen_in_completed_saved: \"浏览器内待办数据\"\nOPAR_reopen_in_completed_user -> OPAR_reopen_in_completed_ui: \"1. 取消当前可见目标的勾选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"2. 按原身份设为未完成，不修改筛选选择。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_reopen_in_completed_storage -> OPAR_reopen_in_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_in_completed_storage -> OPAR_reopen_in_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_ui: \"10. 目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-create-in-completed",
        "reason": "第 20 轮：同步 在 Completed 中新增未完成待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-create-in-completed",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-create-in-completed",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-storage",
              "ORES-todo-data"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_in_completed_user: \"用户\"\nOPAR_create_in_completed_ui: \"页面交互\"\nOPAR_create_in_completed_store: \"清单状态\"\nOPAR_create_in_completed_user -> OPAR_create_in_completed_ui: \"1. 按 Enter 提交新增标题。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"2. 创建新的未完成身份并追加到完整清单末尾。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"6. 返回一致的展示快照。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_ui: \"7. 新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_in_completed_user: \"用户\"\nOPAR_create_in_completed_ui: \"页面交互\"\nOPAR_create_in_completed_store: \"清单状态\"\nOPAR_create_in_completed_storage: \"保存适配\"\nOPAR_create_in_completed_saved: \"浏览器内待办数据\"\nOPAR_create_in_completed_user -> OPAR_create_in_completed_ui: \"1. 按 Enter 提交新增标题。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"2. 创建新的未完成身份并追加到完整清单末尾。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_create_in_completed_storage -> OPAR_create_in_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_create_in_completed_storage -> OPAR_create_in_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_ui: \"10. 新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-clear-hidden-completed",
        "reason": "第 20 轮：同步 在 Active 中清除隐藏的已完成项 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/refs",
            "value": [
              "OSCN-clear-hidden-completed",
              "OMOD-ui",
              "OMOD-store"
            ]
          },
          {
            "op": "replace",
            "path": "/refs",
            "value": [
              "OSCN-clear-hidden-completed",
              "OMOD-ui",
              "OMOD-store",
              "OMOD-storage",
              "ORES-todo-data"
            ]
          },
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_clear_hidden_completed_user: \"用户\"\nOPAR_clear_hidden_completed_ui: \"页面交互\"\nOPAR_clear_hidden_completed_store: \"清单状态\"\nOPAR_clear_hidden_completed_user -> OPAR_clear_hidden_completed_ui: \"1. 点击仍然可见的 Clear completed。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"2. 从完整清单选择并移除全部已完成身份，包括当前看不到的项。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"4. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"5. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"6. 返回一致的展示快照。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_ui: \"7. 隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_clear_hidden_completed_user: \"用户\"\nOPAR_clear_hidden_completed_ui: \"页面交互\"\nOPAR_clear_hidden_completed_store: \"清单状态\"\nOPAR_clear_hidden_completed_storage: \"保存适配\"\nOPAR_clear_hidden_completed_saved: \"浏览器内待办数据\"\nOPAR_clear_hidden_completed_user -> OPAR_clear_hidden_completed_ui: \"1. 点击仍然可见的 Clear completed。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"2. 从完整清单选择并移除全部已完成身份，包括当前看不到的项。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_clear_hidden_completed_storage -> OPAR_clear_hidden_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_clear_hidden_completed_storage -> OPAR_clear_hidden_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_ui: \"10. 隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。\""
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受统一保存适配和 localStorage 命名隔离；保存失败恢复体验作为非阻塞风险保留。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-21",
    "origin_refs": [
      "SFEA-persistence",
      "SREQ-persist"
    ],
    "changes": [
      {
        "target_ref": "OCON-commit-boundary",
        "reason": "第 21 轮把所有提交结果统一映射为完整保存快照。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-commit-boundary",
        "reason": "第 21 轮关联所有会产生保存效果的业务入口。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-persist"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-persist",
              "SREQ-create",
              "SREQ-edit",
              "SREQ-toggle",
              "SREQ-toggle-all",
              "SREQ-delete",
              "SREQ-clear-completed"
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-storage-INT-save",
        "reason": "第 21 轮：维护 storage 对外提供的 保存已提交清单 能力。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "接收当前完整清单快照，写入当前实现的保存空间并返回成功或失败，不覆盖其他实现的数据。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "接收包含独立身份、整理后标题、完成状态和顺序的完整清单，保存最新快照；空清单表示有效删光结果，返回真实保存结果。"
          }
        ]
      },
      {
        "target_ref": "OSCN-create",
        "reason": "第 21 轮：将 有效标题新增一条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-complete",
        "reason": "第 21 轮：将 完成单条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen",
        "reason": "第 21 轮：将 重新打开单条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-submit-edit",
        "reason": "第 21 轮：将 提交非空编辑标题 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-delete-by-edit",
        "reason": "第 21 轮：将 提交空标题删除待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-delete",
        "reason": "第 21 轮：将 直接删除一条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-complete-all",
        "reason": "第 21 轮：将 完成整份清单 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen-all",
        "reason": "第 21 轮：将 重新打开整份清单 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-clear-completed",
        "reason": "第 21 轮：将 清除整份清单的已完成待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-complete-in-active",
        "reason": "第 21 轮：将 在 Active 中完成待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen-in-completed",
        "reason": "第 21 轮：将 在 Completed 中重新打开待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-create-in-completed",
        "reason": "第 21 轮：将 在 Completed 中新增未完成待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-clear-hidden-completed",
        "reason": "第 21 轮：将 在 Active 中清除隐藏的已完成项 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交本次有效变化后的最新待办清单。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-create",
        "reason": "第 21 轮：同步 有效标题新增一条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_user: \"用户\"\nOPAR_create_ui: \"页面交互\"\nOPAR_create_store: \"清单状态\"\nOPAR_create_storage: \"保存适配\"\nOPAR_create_saved: \"浏览器内待办数据\"\nOPAR_create_user -> OPAR_create_ui: \"1. 在新增框按 Enter。\"\nOPAR_create_ui -> OPAR_create_store: \"2. 整理标题并验证非空，为本次新增分配独立身份，保留中间空格。\"\nOPAR_create_store -> OPAR_create_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_store -> OPAR_create_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_create_storage -> OPAR_create_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_create_storage -> OPAR_create_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_create_store -> OPAR_create_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_ui -> OPAR_create_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_store -> OPAR_create_ui: \"9. 返回一致的展示快照。\"\nOPAR_create_ui -> OPAR_create_ui: \"10. 只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_user: \"用户\"\nOPAR_create_ui: \"页面交互\"\nOPAR_create_store: \"清单状态\"\nOPAR_create_storage: \"保存适配\"\nOPAR_create_saved: \"浏览器内待办数据\"\nOPAR_create_user -> OPAR_create_ui: \"1. 在新增框按 Enter。\"\nOPAR_create_ui -> OPAR_create_store: \"2. 整理标题并验证非空，为本次新增分配独立身份，保留中间空格。\"\nOPAR_create_store -> OPAR_create_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_store -> OPAR_create_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_create_storage -> OPAR_create_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_create_storage -> OPAR_create_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_create_store -> OPAR_create_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_ui -> OPAR_create_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_store -> OPAR_create_ui: \"9. 返回一致的展示快照。\"\nOPAR_create_ui -> OPAR_create_ui: \"10. 只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-complete",
        "reason": "第 21 轮：同步 完成单条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_user: \"用户\"\nOPAR_complete_ui: \"页面交互\"\nOPAR_complete_store: \"清单状态\"\nOPAR_complete_storage: \"保存适配\"\nOPAR_complete_saved: \"浏览器内待办数据\"\nOPAR_complete_user -> OPAR_complete_ui: \"1. 勾选目标待办。\"\nOPAR_complete_ui -> OPAR_complete_store: \"2. 按身份把目标设为已完成。\"\nOPAR_complete_store -> OPAR_complete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_store -> OPAR_complete_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_complete_storage -> OPAR_complete_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_storage -> OPAR_complete_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_store -> OPAR_complete_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_ui -> OPAR_complete_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_store -> OPAR_complete_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_ui -> OPAR_complete_ui: \"10. 目标立即呈现选中与完成删除线，其他待办不变。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_user: \"用户\"\nOPAR_complete_ui: \"页面交互\"\nOPAR_complete_store: \"清单状态\"\nOPAR_complete_storage: \"保存适配\"\nOPAR_complete_saved: \"浏览器内待办数据\"\nOPAR_complete_user -> OPAR_complete_ui: \"1. 勾选目标待办。\"\nOPAR_complete_ui -> OPAR_complete_store: \"2. 按身份把目标设为已完成。\"\nOPAR_complete_store -> OPAR_complete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_store -> OPAR_complete_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_complete_storage -> OPAR_complete_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_storage -> OPAR_complete_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_store -> OPAR_complete_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_ui -> OPAR_complete_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_store -> OPAR_complete_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_ui -> OPAR_complete_ui: \"10. 目标立即呈现选中与完成删除线，其他待办不变。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reopen",
        "reason": "第 21 轮：同步 重新打开单条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_user: \"用户\"\nOPAR_reopen_ui: \"页面交互\"\nOPAR_reopen_store: \"清单状态\"\nOPAR_reopen_storage: \"保存适配\"\nOPAR_reopen_saved: \"浏览器内待办数据\"\nOPAR_reopen_user -> OPAR_reopen_ui: \"1. 取消目标勾选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"2. 按身份把目标设为未完成。\"\nOPAR_reopen_store -> OPAR_reopen_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_store -> OPAR_reopen_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_reopen_storage -> OPAR_reopen_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_storage -> OPAR_reopen_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_ui -> OPAR_reopen_ui: \"10. 目标立即恢复未完成样式，其他待办不变。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_user: \"用户\"\nOPAR_reopen_ui: \"页面交互\"\nOPAR_reopen_store: \"清单状态\"\nOPAR_reopen_storage: \"保存适配\"\nOPAR_reopen_saved: \"浏览器内待办数据\"\nOPAR_reopen_user -> OPAR_reopen_ui: \"1. 取消目标勾选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"2. 按身份把目标设为未完成。\"\nOPAR_reopen_store -> OPAR_reopen_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_store -> OPAR_reopen_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_reopen_storage -> OPAR_reopen_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_storage -> OPAR_reopen_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_ui -> OPAR_reopen_ui: \"10. 目标立即恢复未完成样式，其他待办不变。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-submit-edit",
        "reason": "第 21 轮：同步 提交非空编辑标题 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_submit_edit_user: \"用户\"\nOPAR_submit_edit_ui: \"页面交互\"\nOPAR_submit_edit_store: \"清单状态\"\nOPAR_submit_edit_storage: \"保存适配\"\nOPAR_submit_edit_saved: \"浏览器内待办数据\"\nOPAR_submit_edit_user -> OPAR_submit_edit_ui: \"1. 通过 Enter 或编辑框失焦提交草稿。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"3. 按原身份提交整理后的非空标题，保留完成状态与位置。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_storage: \"5. 提交本次有效变化后的最新待办清单。\"\nOPAR_submit_edit_storage -> OPAR_submit_edit_saved: \"6. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_submit_edit_storage -> OPAR_submit_edit_store: \"7. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"8. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"9. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"10. 返回一致的展示快照。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"11. 退出编辑并显示同一待办的新标题，后续失焦不会重复提交。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_submit_edit_user: \"用户\"\nOPAR_submit_edit_ui: \"页面交互\"\nOPAR_submit_edit_store: \"清单状态\"\nOPAR_submit_edit_storage: \"保存适配\"\nOPAR_submit_edit_saved: \"浏览器内待办数据\"\nOPAR_submit_edit_user -> OPAR_submit_edit_ui: \"1. 通过 Enter 或编辑框失焦提交草稿。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"3. 按原身份提交整理后的非空标题，保留完成状态与位置。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_storage: \"5. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_submit_edit_storage -> OPAR_submit_edit_saved: \"6. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_submit_edit_storage -> OPAR_submit_edit_store: \"7. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"8. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"9. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"10. 返回一致的展示快照。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"11. 退出编辑并显示同一待办的新标题，后续失焦不会重复提交。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-delete-by-edit",
        "reason": "第 21 轮：同步 提交空标题删除待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_by_edit_user: \"用户\"\nOPAR_delete_by_edit_ui: \"页面交互\"\nOPAR_delete_by_edit_store: \"清单状态\"\nOPAR_delete_by_edit_storage: \"保存适配\"\nOPAR_delete_by_edit_saved: \"浏览器内待办数据\"\nOPAR_delete_by_edit_user -> OPAR_delete_by_edit_ui: \"1. 按 Enter 或使编辑框失焦。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"3. 按编辑会话绑定的身份移除目标待办。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_storage: \"5. 提交本次有效变化后的最新待办清单。\"\nOPAR_delete_by_edit_storage -> OPAR_delete_by_edit_saved: \"6. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_delete_by_edit_storage -> OPAR_delete_by_edit_store: \"7. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"8. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"9. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"10. 返回一致的展示快照。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"11. 仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_by_edit_user: \"用户\"\nOPAR_delete_by_edit_ui: \"页面交互\"\nOPAR_delete_by_edit_store: \"清单状态\"\nOPAR_delete_by_edit_storage: \"保存适配\"\nOPAR_delete_by_edit_saved: \"浏览器内待办数据\"\nOPAR_delete_by_edit_user -> OPAR_delete_by_edit_ui: \"1. 按 Enter 或使编辑框失焦。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"3. 按编辑会话绑定的身份移除目标待办。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_storage: \"5. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_delete_by_edit_storage -> OPAR_delete_by_edit_saved: \"6. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_delete_by_edit_storage -> OPAR_delete_by_edit_store: \"7. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"8. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"9. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"10. 返回一致的展示快照。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"11. 仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-delete",
        "reason": "第 21 轮：同步 直接删除一条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_user: \"用户\"\nOPAR_delete_ui: \"页面交互\"\nOPAR_delete_store: \"清单状态\"\nOPAR_delete_storage: \"保存适配\"\nOPAR_delete_saved: \"浏览器内待办数据\"\nOPAR_delete_user -> OPAR_delete_ui: \"1. 悬停目标行并点击删除按钮。\"\nOPAR_delete_ui -> OPAR_delete_store: \"2. 按被点击条目的身份执行移除。\"\nOPAR_delete_store -> OPAR_delete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_store -> OPAR_delete_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_delete_storage -> OPAR_delete_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_delete_storage -> OPAR_delete_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_delete_store -> OPAR_delete_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_ui -> OPAR_delete_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_store -> OPAR_delete_ui: \"9. 返回一致的展示快照。\"\nOPAR_delete_ui -> OPAR_delete_ui: \"10. 只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_user: \"用户\"\nOPAR_delete_ui: \"页面交互\"\nOPAR_delete_store: \"清单状态\"\nOPAR_delete_storage: \"保存适配\"\nOPAR_delete_saved: \"浏览器内待办数据\"\nOPAR_delete_user -> OPAR_delete_ui: \"1. 悬停目标行并点击删除按钮。\"\nOPAR_delete_ui -> OPAR_delete_store: \"2. 按被点击条目的身份执行移除。\"\nOPAR_delete_store -> OPAR_delete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_store -> OPAR_delete_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_delete_storage -> OPAR_delete_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_delete_storage -> OPAR_delete_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_delete_store -> OPAR_delete_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_ui -> OPAR_delete_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_store -> OPAR_delete_ui: \"9. 返回一致的展示快照。\"\nOPAR_delete_ui -> OPAR_delete_ui: \"10. 只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-complete-all",
        "reason": "第 21 轮：同步 完成整份清单 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_all_user: \"用户\"\nOPAR_complete_all_ui: \"页面交互\"\nOPAR_complete_all_store: \"清单状态\"\nOPAR_complete_all_storage: \"保存适配\"\nOPAR_complete_all_saved: \"浏览器内待办数据\"\nOPAR_complete_all_user -> OPAR_complete_all_ui: \"1. 把全选控件设为选中。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"2. 把完整清单所有条目标为已完成。\"\nOPAR_complete_all_store -> OPAR_complete_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_all_store -> OPAR_complete_all_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_complete_all_storage -> OPAR_complete_all_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_all_storage -> OPAR_complete_all_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_all_ui -> OPAR_complete_all_ui: \"10. 未完成数量为零，全选选中，所有标题和顺序保持。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_all_user: \"用户\"\nOPAR_complete_all_ui: \"页面交互\"\nOPAR_complete_all_store: \"清单状态\"\nOPAR_complete_all_storage: \"保存适配\"\nOPAR_complete_all_saved: \"浏览器内待办数据\"\nOPAR_complete_all_user -> OPAR_complete_all_ui: \"1. 把全选控件设为选中。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"2. 把完整清单所有条目标为已完成。\"\nOPAR_complete_all_store -> OPAR_complete_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_all_store -> OPAR_complete_all_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_complete_all_storage -> OPAR_complete_all_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_all_storage -> OPAR_complete_all_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_all_ui -> OPAR_complete_all_ui: \"10. 未完成数量为零，全选选中，所有标题和顺序保持。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reopen-all",
        "reason": "第 21 轮：同步 重新打开整份清单 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_all_user: \"用户\"\nOPAR_reopen_all_ui: \"页面交互\"\nOPAR_reopen_all_store: \"清单状态\"\nOPAR_reopen_all_storage: \"保存适配\"\nOPAR_reopen_all_saved: \"浏览器内待办数据\"\nOPAR_reopen_all_user -> OPAR_reopen_all_ui: \"1. 取消全选控件。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"2. 把完整清单所有条目标为未完成。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_reopen_all_storage -> OPAR_reopen_all_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_all_storage -> OPAR_reopen_all_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_ui: \"10. 未完成数量等于完整清单总数，全选未选中，标题和顺序保持。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_all_user: \"用户\"\nOPAR_reopen_all_ui: \"页面交互\"\nOPAR_reopen_all_store: \"清单状态\"\nOPAR_reopen_all_storage: \"保存适配\"\nOPAR_reopen_all_saved: \"浏览器内待办数据\"\nOPAR_reopen_all_user -> OPAR_reopen_all_ui: \"1. 取消全选控件。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"2. 把完整清单所有条目标为未完成。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_reopen_all_storage -> OPAR_reopen_all_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_all_storage -> OPAR_reopen_all_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_ui: \"10. 未完成数量等于完整清单总数，全选未选中，标题和顺序保持。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-clear-completed",
        "reason": "第 21 轮：同步 清除整份清单的已完成待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_clear_completed_user: \"用户\"\nOPAR_clear_completed_ui: \"页面交互\"\nOPAR_clear_completed_store: \"清单状态\"\nOPAR_clear_completed_storage: \"保存适配\"\nOPAR_clear_completed_saved: \"浏览器内待办数据\"\nOPAR_clear_completed_user -> OPAR_clear_completed_ui: \"1. 点击 Clear completed。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"2. 移除完整清单中全部已完成身份，保留未完成项。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_clear_completed_storage -> OPAR_clear_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_clear_completed_storage -> OPAR_clear_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_ui: \"10. 清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_clear_completed_user: \"用户\"\nOPAR_clear_completed_ui: \"页面交互\"\nOPAR_clear_completed_store: \"清单状态\"\nOPAR_clear_completed_storage: \"保存适配\"\nOPAR_clear_completed_saved: \"浏览器内待办数据\"\nOPAR_clear_completed_user -> OPAR_clear_completed_ui: \"1. 点击 Clear completed。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"2. 移除完整清单中全部已完成身份，保留未完成项。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_clear_completed_storage -> OPAR_clear_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_clear_completed_storage -> OPAR_clear_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_ui: \"10. 清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-complete-in-active",
        "reason": "第 21 轮：同步 在 Active 中完成待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_in_active_user: \"用户\"\nOPAR_complete_in_active_ui: \"页面交互\"\nOPAR_complete_in_active_store: \"清单状态\"\nOPAR_complete_in_active_storage: \"保存适配\"\nOPAR_complete_in_active_saved: \"浏览器内待办数据\"\nOPAR_complete_in_active_user -> OPAR_complete_in_active_ui: \"1. 勾选当前可见目标。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"2. 按原身份设为已完成，不修改筛选选择。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_complete_in_active_storage -> OPAR_complete_in_active_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_in_active_storage -> OPAR_complete_in_active_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_ui: \"10. 目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_in_active_user: \"用户\"\nOPAR_complete_in_active_ui: \"页面交互\"\nOPAR_complete_in_active_store: \"清单状态\"\nOPAR_complete_in_active_storage: \"保存适配\"\nOPAR_complete_in_active_saved: \"浏览器内待办数据\"\nOPAR_complete_in_active_user -> OPAR_complete_in_active_ui: \"1. 勾选当前可见目标。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"2. 按原身份设为已完成，不修改筛选选择。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_complete_in_active_storage -> OPAR_complete_in_active_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_in_active_storage -> OPAR_complete_in_active_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_ui: \"10. 目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reopen-in-completed",
        "reason": "第 21 轮：同步 在 Completed 中重新打开待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_in_completed_user: \"用户\"\nOPAR_reopen_in_completed_ui: \"页面交互\"\nOPAR_reopen_in_completed_store: \"清单状态\"\nOPAR_reopen_in_completed_storage: \"保存适配\"\nOPAR_reopen_in_completed_saved: \"浏览器内待办数据\"\nOPAR_reopen_in_completed_user -> OPAR_reopen_in_completed_ui: \"1. 取消当前可见目标的勾选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"2. 按原身份设为未完成，不修改筛选选择。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_reopen_in_completed_storage -> OPAR_reopen_in_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_in_completed_storage -> OPAR_reopen_in_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_ui: \"10. 目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_in_completed_user: \"用户\"\nOPAR_reopen_in_completed_ui: \"页面交互\"\nOPAR_reopen_in_completed_store: \"清单状态\"\nOPAR_reopen_in_completed_storage: \"保存适配\"\nOPAR_reopen_in_completed_saved: \"浏览器内待办数据\"\nOPAR_reopen_in_completed_user -> OPAR_reopen_in_completed_ui: \"1. 取消当前可见目标的勾选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"2. 按原身份设为未完成，不修改筛选选择。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_reopen_in_completed_storage -> OPAR_reopen_in_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_in_completed_storage -> OPAR_reopen_in_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_ui: \"10. 目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-create-in-completed",
        "reason": "第 21 轮：同步 在 Completed 中新增未完成待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_in_completed_user: \"用户\"\nOPAR_create_in_completed_ui: \"页面交互\"\nOPAR_create_in_completed_store: \"清单状态\"\nOPAR_create_in_completed_storage: \"保存适配\"\nOPAR_create_in_completed_saved: \"浏览器内待办数据\"\nOPAR_create_in_completed_user -> OPAR_create_in_completed_ui: \"1. 按 Enter 提交新增标题。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"2. 创建新的未完成身份并追加到完整清单末尾。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_create_in_completed_storage -> OPAR_create_in_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_create_in_completed_storage -> OPAR_create_in_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_ui: \"10. 新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_in_completed_user: \"用户\"\nOPAR_create_in_completed_ui: \"页面交互\"\nOPAR_create_in_completed_store: \"清单状态\"\nOPAR_create_in_completed_storage: \"保存适配\"\nOPAR_create_in_completed_saved: \"浏览器内待办数据\"\nOPAR_create_in_completed_user -> OPAR_create_in_completed_ui: \"1. 按 Enter 提交新增标题。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"2. 创建新的未完成身份并追加到完整清单末尾。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_create_in_completed_storage -> OPAR_create_in_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_create_in_completed_storage -> OPAR_create_in_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_ui: \"10. 新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-clear-hidden-completed",
        "reason": "第 21 轮：同步 在 Active 中清除隐藏的已完成项 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_clear_hidden_completed_user: \"用户\"\nOPAR_clear_hidden_completed_ui: \"页面交互\"\nOPAR_clear_hidden_completed_store: \"清单状态\"\nOPAR_clear_hidden_completed_storage: \"保存适配\"\nOPAR_clear_hidden_completed_saved: \"浏览器内待办数据\"\nOPAR_clear_hidden_completed_user -> OPAR_clear_hidden_completed_ui: \"1. 点击仍然可见的 Clear completed。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"2. 从完整清单选择并移除全部已完成身份，包括当前看不到的项。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_storage: \"4. 提交本次有效变化后的最新待办清单。\"\nOPAR_clear_hidden_completed_storage -> OPAR_clear_hidden_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_clear_hidden_completed_storage -> OPAR_clear_hidden_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_ui: \"10. 隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_clear_hidden_completed_user: \"用户\"\nOPAR_clear_hidden_completed_ui: \"页面交互\"\nOPAR_clear_hidden_completed_store: \"清单状态\"\nOPAR_clear_hidden_completed_storage: \"保存适配\"\nOPAR_clear_hidden_completed_saved: \"浏览器内待办数据\"\nOPAR_clear_hidden_completed_user -> OPAR_clear_hidden_completed_ui: \"1. 点击仍然可见的 Clear completed。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"2. 从完整清单选择并移除全部已完成身份，包括当前看不到的项。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_clear_hidden_completed_storage -> OPAR_clear_hidden_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_clear_hidden_completed_storage -> OPAR_clear_hidden_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_ui: \"10. 隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。\""
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受完整快照表达身份、顺序和全部删除结果，同名待办在保存后仍可区分。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-22",
    "origin_refs": [
      "SREQ-persist"
    ],
    "changes": [
      {
        "target_ref": "OCON-commit-boundary",
        "reason": "第 22 轮把草稿与筛选排除在持久化输入之外。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-commit-boundary",
        "reason": "第 22 轮明确交错动作仍遵守提交边界。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-commit-boundary",
        "reason": "第 22 轮防止默认空状态覆盖历史数据。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "ODEC-no-startup-write",
        "reason": "第 22 轮：确认 初始化与保存触发分离。已确认不恢复显示不意味着删除已保存内容；把保存绑定到有效命令可以排除首次重绘误写空清单。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ORISK-post-refresh-write-policy",
        "reason": "第 22 轮区分已确认的刷新保护与未定义的后续跨会话策略，保留为非阻塞范围风险。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "OSCN-cancel-edit",
        "reason": "第 22 轮在已有取消路径补充保存边界。",
        "patch": [
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "原待办、原标题和完成状态保留，界面退出编辑。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "编辑会话结束，原待办和原标题保留；取消不分发保存，其他有效命令保存时仍使用原已提交标题。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-reject-create",
        "reason": "第 22 轮在已有拒绝路径补充保存边界。",
        "patch": [
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "清单条目和数量保持不变。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "无效新增不改变清单或数量，不调用保存；拒绝的空标题不会进入存储。"
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-create",
        "reason": "第 22 轮：将 有效标题新增一条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-complete",
        "reason": "第 22 轮：将 完成单条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen",
        "reason": "第 22 轮：将 重新打开单条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-submit-edit",
        "reason": "第 22 轮：将 提交非空编辑标题 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-delete-by-edit",
        "reason": "第 22 轮：将 提交空标题删除待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-delete",
        "reason": "第 22 轮：将 直接删除一条待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-complete-all",
        "reason": "第 22 轮：将 完成整份清单 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen-all",
        "reason": "第 22 轮：将 重新打开整份清单 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-clear-completed",
        "reason": "第 22 轮：将 清除整份清单的已完成待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-complete-in-active",
        "reason": "第 22 轮：将 在 Active 中完成待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-reopen-in-completed",
        "reason": "第 22 轮：将 在 Completed 中重新打开待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-create-in-completed",
        "reason": "第 22 轮：将 在 Completed 中新增未完成待办 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-clear-hidden-completed",
        "reason": "第 22 轮：将 在 Active 中清除隐藏的已完成项 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。"
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
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OSCN-launch",
        "reason": "第 22 轮：将 打开页面并建立当前展示状态 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-navigation"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-navigation",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "呈现 todos 与新增入口，根据完整清单是否为空决定主体和页脚显示，加载后聚焦新增输入框。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
                "action": "呈现 todos 与新增入口，根据完整清单是否为空决定主体和页脚显示，加载后聚焦新增输入框。"
              },
              {
                "id": "OSCN-launch-STEP-8",
                "source_ref": "OPAR-launch-ui",
                "type": "activity",
                "action": "启动与首次呈现不构成待办提交，不触发保存，不因未恢复显示而覆盖原有存储。"
              }
            ]
          },
          {
            "op": "test",
            "path": "/outcomes",
            "value": [
              {
                "type": "state",
                "description": "标题、新增入口及已确定的显示区域与当前清单一致，新增框获得焦点。"
              },
              {
                "type": "state",
                "description": "筛选由当前地址确定。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/outcomes",
            "value": [
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
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-launch",
        "reason": "第 22 轮：同步 打开页面并建立当前展示状态 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_launch_user: \"用户\"\nOPAR_launch_ui: \"页面交互\"\nOPAR_launch_router: \"筛选导航\"\nOPAR_launch_history: \"地址与导航历史\"\nOPAR_launch_store: \"清单状态\"\nOPAR_launch_user -> OPAR_launch_ui: \"1. 打开浏览器中的 TodoMVC 单清单应用。\"\nOPAR_launch_ui -> OPAR_launch_router: \"2. 解析当前合法筛选地址；地址没有指定筛选时选择 All。\"\nOPAR_launch_router -> OPAR_launch_history: \"3. 读取当前页面地址，按已确认的路由映射确定筛选。\"\nOPAR_launch_router -> OPAR_launch_ui: \"4. 返回规范化筛选值，不改变待办数据。\"\nOPAR_launch_ui -> OPAR_launch_store: \"5. 读取本页清单展示结果。\"\nOPAR_launch_store -> OPAR_launch_ui: \"6. 返回当前清单及本轮已经定义的派生展示值。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"7. 呈现 todos 与新增入口，根据完整清单是否为空决定主体和页脚显示，加载后聚焦新增输入框。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_launch_user: \"用户\"\nOPAR_launch_ui: \"页面交互\"\nOPAR_launch_router: \"筛选导航\"\nOPAR_launch_history: \"地址与导航历史\"\nOPAR_launch_store: \"清单状态\"\nOPAR_launch_user -> OPAR_launch_ui: \"1. 打开浏览器中的 TodoMVC 单清单应用。\"\nOPAR_launch_ui -> OPAR_launch_router: \"2. 解析当前合法筛选地址；地址没有指定筛选时选择 All。\"\nOPAR_launch_router -> OPAR_launch_history: \"3. 读取当前页面地址，按已确认的路由映射确定筛选。\"\nOPAR_launch_router -> OPAR_launch_ui: \"4. 返回规范化筛选值，不改变待办数据。\"\nOPAR_launch_ui -> OPAR_launch_store: \"5. 读取本页清单展示结果。\"\nOPAR_launch_store -> OPAR_launch_ui: \"6. 返回当前清单及本轮已经定义的派生展示值。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"7. 呈现 todos 与新增入口，根据完整清单是否为空决定主体和页脚显示，加载后聚焦新增输入框。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"8. 启动与首次呈现不构成待办提交，不触发保存，不因未恢复显示而覆盖原有存储。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-create",
        "reason": "第 22 轮：同步 有效标题新增一条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_user: \"用户\"\nOPAR_create_ui: \"页面交互\"\nOPAR_create_store: \"清单状态\"\nOPAR_create_storage: \"保存适配\"\nOPAR_create_saved: \"浏览器内待办数据\"\nOPAR_create_user -> OPAR_create_ui: \"1. 在新增框按 Enter。\"\nOPAR_create_ui -> OPAR_create_store: \"2. 整理标题并验证非空，为本次新增分配独立身份，保留中间空格。\"\nOPAR_create_store -> OPAR_create_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_store -> OPAR_create_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_create_storage -> OPAR_create_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_create_storage -> OPAR_create_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_create_store -> OPAR_create_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_ui -> OPAR_create_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_store -> OPAR_create_ui: \"9. 返回一致的展示快照。\"\nOPAR_create_ui -> OPAR_create_ui: \"10. 只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_user: \"用户\"\nOPAR_create_ui: \"页面交互\"\nOPAR_create_store: \"清单状态\"\nOPAR_create_storage: \"保存适配\"\nOPAR_create_saved: \"浏览器内待办数据\"\nOPAR_create_user -> OPAR_create_ui: \"1. 在新增框按 Enter。\"\nOPAR_create_ui -> OPAR_create_store: \"2. 整理标题并验证非空，为本次新增分配独立身份，保留中间空格。\"\nOPAR_create_store -> OPAR_create_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_store -> OPAR_create_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_create_storage -> OPAR_create_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_create_storage -> OPAR_create_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_create_store -> OPAR_create_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_ui -> OPAR_create_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_store -> OPAR_create_ui: \"9. 返回一致的展示快照。\"\nOPAR_create_ui -> OPAR_create_ui: \"10. 只新增一条未完成待办到末尾，其他条目不变；成功后清空新增框。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-complete",
        "reason": "第 22 轮：同步 完成单条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_user: \"用户\"\nOPAR_complete_ui: \"页面交互\"\nOPAR_complete_store: \"清单状态\"\nOPAR_complete_storage: \"保存适配\"\nOPAR_complete_saved: \"浏览器内待办数据\"\nOPAR_complete_user -> OPAR_complete_ui: \"1. 勾选目标待办。\"\nOPAR_complete_ui -> OPAR_complete_store: \"2. 按身份把目标设为已完成。\"\nOPAR_complete_store -> OPAR_complete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_store -> OPAR_complete_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_complete_storage -> OPAR_complete_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_storage -> OPAR_complete_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_store -> OPAR_complete_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_ui -> OPAR_complete_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_store -> OPAR_complete_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_ui -> OPAR_complete_ui: \"10. 目标立即呈现选中与完成删除线，其他待办不变。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_user: \"用户\"\nOPAR_complete_ui: \"页面交互\"\nOPAR_complete_store: \"清单状态\"\nOPAR_complete_storage: \"保存适配\"\nOPAR_complete_saved: \"浏览器内待办数据\"\nOPAR_complete_user -> OPAR_complete_ui: \"1. 勾选目标待办。\"\nOPAR_complete_ui -> OPAR_complete_store: \"2. 按身份把目标设为已完成。\"\nOPAR_complete_store -> OPAR_complete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_store -> OPAR_complete_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_complete_storage -> OPAR_complete_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_storage -> OPAR_complete_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_store -> OPAR_complete_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_ui -> OPAR_complete_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_store -> OPAR_complete_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_ui -> OPAR_complete_ui: \"10. 目标立即呈现选中与完成删除线，其他待办不变。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reopen",
        "reason": "第 22 轮：同步 重新打开单条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_user: \"用户\"\nOPAR_reopen_ui: \"页面交互\"\nOPAR_reopen_store: \"清单状态\"\nOPAR_reopen_storage: \"保存适配\"\nOPAR_reopen_saved: \"浏览器内待办数据\"\nOPAR_reopen_user -> OPAR_reopen_ui: \"1. 取消目标勾选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"2. 按身份把目标设为未完成。\"\nOPAR_reopen_store -> OPAR_reopen_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_store -> OPAR_reopen_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_reopen_storage -> OPAR_reopen_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_storage -> OPAR_reopen_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_ui -> OPAR_reopen_ui: \"10. 目标立即恢复未完成样式，其他待办不变。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_user: \"用户\"\nOPAR_reopen_ui: \"页面交互\"\nOPAR_reopen_store: \"清单状态\"\nOPAR_reopen_storage: \"保存适配\"\nOPAR_reopen_saved: \"浏览器内待办数据\"\nOPAR_reopen_user -> OPAR_reopen_ui: \"1. 取消目标勾选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"2. 按身份把目标设为未完成。\"\nOPAR_reopen_store -> OPAR_reopen_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_store -> OPAR_reopen_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_reopen_storage -> OPAR_reopen_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_storage -> OPAR_reopen_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_ui -> OPAR_reopen_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_store -> OPAR_reopen_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_ui -> OPAR_reopen_ui: \"10. 目标立即恢复未完成样式，其他待办不变。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-submit-edit",
        "reason": "第 22 轮：同步 提交非空编辑标题 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_submit_edit_user: \"用户\"\nOPAR_submit_edit_ui: \"页面交互\"\nOPAR_submit_edit_store: \"清单状态\"\nOPAR_submit_edit_storage: \"保存适配\"\nOPAR_submit_edit_saved: \"浏览器内待办数据\"\nOPAR_submit_edit_user -> OPAR_submit_edit_ui: \"1. 通过 Enter 或编辑框失焦提交草稿。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"3. 按原身份提交整理后的非空标题，保留完成状态与位置。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_storage: \"5. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_submit_edit_storage -> OPAR_submit_edit_saved: \"6. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_submit_edit_storage -> OPAR_submit_edit_store: \"7. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"8. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"9. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"10. 返回一致的展示快照。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"11. 退出编辑并显示同一待办的新标题，后续失焦不会重复提交。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_submit_edit_user: \"用户\"\nOPAR_submit_edit_ui: \"页面交互\"\nOPAR_submit_edit_store: \"清单状态\"\nOPAR_submit_edit_storage: \"保存适配\"\nOPAR_submit_edit_saved: \"浏览器内待办数据\"\nOPAR_submit_edit_user -> OPAR_submit_edit_ui: \"1. 通过 Enter 或编辑框失焦提交草稿。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"3. 按原身份提交整理后的非空标题，保留完成状态与位置。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_storage: \"5. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_submit_edit_storage -> OPAR_submit_edit_saved: \"6. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_submit_edit_storage -> OPAR_submit_edit_store: \"7. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"8. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_store: \"9. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_submit_edit_store -> OPAR_submit_edit_ui: \"10. 返回一致的展示快照。\"\nOPAR_submit_edit_ui -> OPAR_submit_edit_ui: \"11. 退出编辑并显示同一待办的新标题，后续失焦不会重复提交。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-delete-by-edit",
        "reason": "第 22 轮：同步 提交空标题删除待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_by_edit_user: \"用户\"\nOPAR_delete_by_edit_ui: \"页面交互\"\nOPAR_delete_by_edit_store: \"清单状态\"\nOPAR_delete_by_edit_storage: \"保存适配\"\nOPAR_delete_by_edit_saved: \"浏览器内待办数据\"\nOPAR_delete_by_edit_user -> OPAR_delete_by_edit_ui: \"1. 按 Enter 或使编辑框失焦。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"3. 按编辑会话绑定的身份移除目标待办。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_storage: \"5. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_delete_by_edit_storage -> OPAR_delete_by_edit_saved: \"6. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_delete_by_edit_storage -> OPAR_delete_by_edit_store: \"7. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"8. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"9. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"10. 返回一致的展示快照。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"11. 仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_by_edit_user: \"用户\"\nOPAR_delete_by_edit_ui: \"页面交互\"\nOPAR_delete_by_edit_store: \"清单状态\"\nOPAR_delete_by_edit_storage: \"保存适配\"\nOPAR_delete_by_edit_saved: \"浏览器内待办数据\"\nOPAR_delete_by_edit_user -> OPAR_delete_by_edit_ui: \"1. 按 Enter 或使编辑框失焦。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"2. 校验当前编辑会话仍有效，先结束该会话；把后续重复 Enter 或失焦视为同一已处理会话，禁止再次分发命令。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"3. 按编辑会话绑定的身份移除目标待办。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_store: \"4. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_storage: \"5. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_delete_by_edit_storage -> OPAR_delete_by_edit_saved: \"6. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_delete_by_edit_storage -> OPAR_delete_by_edit_store: \"7. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"8. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_store: \"9. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_by_edit_store -> OPAR_delete_by_edit_ui: \"10. 返回一致的展示快照。\"\nOPAR_delete_by_edit_ui -> OPAR_delete_by_edit_ui: \"11. 仅目标条目消失，计数及空状态按剩余清单更新；后续失焦不能误删其他条目。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-delete",
        "reason": "第 22 轮：同步 直接删除一条待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_user: \"用户\"\nOPAR_delete_ui: \"页面交互\"\nOPAR_delete_store: \"清单状态\"\nOPAR_delete_storage: \"保存适配\"\nOPAR_delete_saved: \"浏览器内待办数据\"\nOPAR_delete_user -> OPAR_delete_ui: \"1. 悬停目标行并点击删除按钮。\"\nOPAR_delete_ui -> OPAR_delete_store: \"2. 按被点击条目的身份执行移除。\"\nOPAR_delete_store -> OPAR_delete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_store -> OPAR_delete_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_delete_storage -> OPAR_delete_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_delete_storage -> OPAR_delete_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_delete_store -> OPAR_delete_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_ui -> OPAR_delete_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_store -> OPAR_delete_ui: \"9. 返回一致的展示快照。\"\nOPAR_delete_ui -> OPAR_delete_ui: \"10. 只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_delete_user: \"用户\"\nOPAR_delete_ui: \"页面交互\"\nOPAR_delete_store: \"清单状态\"\nOPAR_delete_storage: \"保存适配\"\nOPAR_delete_saved: \"浏览器内待办数据\"\nOPAR_delete_user -> OPAR_delete_ui: \"1. 悬停目标行并点击删除按钮。\"\nOPAR_delete_ui -> OPAR_delete_store: \"2. 按被点击条目的身份执行移除。\"\nOPAR_delete_store -> OPAR_delete_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_delete_store -> OPAR_delete_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_delete_storage -> OPAR_delete_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_delete_storage -> OPAR_delete_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_delete_store -> OPAR_delete_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_delete_ui -> OPAR_delete_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_delete_store -> OPAR_delete_ui: \"9. 返回一致的展示快照。\"\nOPAR_delete_ui -> OPAR_delete_ui: \"10. 只移除指定条目，其余内容和顺序不变，重新呈现统计与空状态。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-complete-all",
        "reason": "第 22 轮：同步 完成整份清单 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_all_user: \"用户\"\nOPAR_complete_all_ui: \"页面交互\"\nOPAR_complete_all_store: \"清单状态\"\nOPAR_complete_all_storage: \"保存适配\"\nOPAR_complete_all_saved: \"浏览器内待办数据\"\nOPAR_complete_all_user -> OPAR_complete_all_ui: \"1. 把全选控件设为选中。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"2. 把完整清单所有条目标为已完成。\"\nOPAR_complete_all_store -> OPAR_complete_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_all_store -> OPAR_complete_all_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_complete_all_storage -> OPAR_complete_all_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_all_storage -> OPAR_complete_all_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_all_ui -> OPAR_complete_all_ui: \"10. 未完成数量为零，全选选中，所有标题和顺序保持。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_all_user: \"用户\"\nOPAR_complete_all_ui: \"页面交互\"\nOPAR_complete_all_store: \"清单状态\"\nOPAR_complete_all_storage: \"保存适配\"\nOPAR_complete_all_saved: \"浏览器内待办数据\"\nOPAR_complete_all_user -> OPAR_complete_all_ui: \"1. 把全选控件设为选中。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"2. 把完整清单所有条目标为已完成。\"\nOPAR_complete_all_store -> OPAR_complete_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_all_store -> OPAR_complete_all_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_complete_all_storage -> OPAR_complete_all_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_all_storage -> OPAR_complete_all_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_all_ui -> OPAR_complete_all_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_all_store -> OPAR_complete_all_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_all_ui -> OPAR_complete_all_ui: \"10. 未完成数量为零，全选选中，所有标题和顺序保持。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reopen-all",
        "reason": "第 22 轮：同步 重新打开整份清单 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_all_user: \"用户\"\nOPAR_reopen_all_ui: \"页面交互\"\nOPAR_reopen_all_store: \"清单状态\"\nOPAR_reopen_all_storage: \"保存适配\"\nOPAR_reopen_all_saved: \"浏览器内待办数据\"\nOPAR_reopen_all_user -> OPAR_reopen_all_ui: \"1. 取消全选控件。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"2. 把完整清单所有条目标为未完成。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_reopen_all_storage -> OPAR_reopen_all_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_all_storage -> OPAR_reopen_all_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_ui: \"10. 未完成数量等于完整清单总数，全选未选中，标题和顺序保持。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_all_user: \"用户\"\nOPAR_reopen_all_ui: \"页面交互\"\nOPAR_reopen_all_store: \"清单状态\"\nOPAR_reopen_all_storage: \"保存适配\"\nOPAR_reopen_all_saved: \"浏览器内待办数据\"\nOPAR_reopen_all_user -> OPAR_reopen_all_ui: \"1. 取消全选控件。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"2. 把完整清单所有条目标为未完成。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_reopen_all_storage -> OPAR_reopen_all_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_all_storage -> OPAR_reopen_all_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_all_store -> OPAR_reopen_all_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_all_ui -> OPAR_reopen_all_ui: \"10. 未完成数量等于完整清单总数，全选未选中，标题和顺序保持。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-clear-completed",
        "reason": "第 22 轮：同步 清除整份清单的已完成待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_clear_completed_user: \"用户\"\nOPAR_clear_completed_ui: \"页面交互\"\nOPAR_clear_completed_store: \"清单状态\"\nOPAR_clear_completed_storage: \"保存适配\"\nOPAR_clear_completed_saved: \"浏览器内待办数据\"\nOPAR_clear_completed_user -> OPAR_clear_completed_ui: \"1. 点击 Clear completed。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"2. 移除完整清单中全部已完成身份，保留未完成项。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_clear_completed_storage -> OPAR_clear_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_clear_completed_storage -> OPAR_clear_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_ui: \"10. 清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_clear_completed_user: \"用户\"\nOPAR_clear_completed_ui: \"页面交互\"\nOPAR_clear_completed_store: \"清单状态\"\nOPAR_clear_completed_storage: \"保存适配\"\nOPAR_clear_completed_saved: \"浏览器内待办数据\"\nOPAR_clear_completed_user -> OPAR_clear_completed_ui: \"1. 点击 Clear completed。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"2. 移除完整清单中全部已完成身份，保留未完成项。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_clear_completed_storage -> OPAR_clear_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_clear_completed_storage -> OPAR_clear_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_completed_store -> OPAR_clear_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_clear_completed_ui -> OPAR_clear_completed_ui: \"10. 清除按钮隐藏，未完成数量不变；若清单为空则隐藏主体和页脚，全选不残留选中。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-complete-in-active",
        "reason": "第 22 轮：同步 在 Active 中完成待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_in_active_user: \"用户\"\nOPAR_complete_in_active_ui: \"页面交互\"\nOPAR_complete_in_active_store: \"清单状态\"\nOPAR_complete_in_active_storage: \"保存适配\"\nOPAR_complete_in_active_saved: \"浏览器内待办数据\"\nOPAR_complete_in_active_user -> OPAR_complete_in_active_ui: \"1. 勾选当前可见目标。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"2. 按原身份设为已完成，不修改筛选选择。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_complete_in_active_storage -> OPAR_complete_in_active_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_in_active_storage -> OPAR_complete_in_active_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_ui: \"10. 目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_complete_in_active_user: \"用户\"\nOPAR_complete_in_active_ui: \"页面交互\"\nOPAR_complete_in_active_store: \"清单状态\"\nOPAR_complete_in_active_storage: \"保存适配\"\nOPAR_complete_in_active_saved: \"浏览器内待办数据\"\nOPAR_complete_in_active_user -> OPAR_complete_in_active_ui: \"1. 勾选当前可见目标。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"2. 按原身份设为已完成，不修改筛选选择。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_complete_in_active_storage -> OPAR_complete_in_active_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_complete_in_active_storage -> OPAR_complete_in_active_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_complete_in_active_store -> OPAR_complete_in_active_ui: \"9. 返回一致的展示快照。\"\nOPAR_complete_in_active_ui -> OPAR_complete_in_active_ui: \"10. 目标从 Active 消失但仍在完整清单中，切换到 All 或 Completed 可见；筛选保持 Active。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-reopen-in-completed",
        "reason": "第 22 轮：同步 在 Completed 中重新打开待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_in_completed_user: \"用户\"\nOPAR_reopen_in_completed_ui: \"页面交互\"\nOPAR_reopen_in_completed_store: \"清单状态\"\nOPAR_reopen_in_completed_storage: \"保存适配\"\nOPAR_reopen_in_completed_saved: \"浏览器内待办数据\"\nOPAR_reopen_in_completed_user -> OPAR_reopen_in_completed_ui: \"1. 取消当前可见目标的勾选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"2. 按原身份设为未完成，不修改筛选选择。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_reopen_in_completed_storage -> OPAR_reopen_in_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_in_completed_storage -> OPAR_reopen_in_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_ui: \"10. 目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_reopen_in_completed_user: \"用户\"\nOPAR_reopen_in_completed_ui: \"页面交互\"\nOPAR_reopen_in_completed_store: \"清单状态\"\nOPAR_reopen_in_completed_storage: \"保存适配\"\nOPAR_reopen_in_completed_saved: \"浏览器内待办数据\"\nOPAR_reopen_in_completed_user -> OPAR_reopen_in_completed_ui: \"1. 取消当前可见目标的勾选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"2. 按原身份设为未完成，不修改筛选选择。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_reopen_in_completed_storage -> OPAR_reopen_in_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_reopen_in_completed_storage -> OPAR_reopen_in_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_reopen_in_completed_store -> OPAR_reopen_in_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_reopen_in_completed_ui -> OPAR_reopen_in_completed_ui: \"10. 目标从 Completed 消失但仍在完整清单中，切换到 All 或 Active 可见；筛选保持 Completed。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-create-in-completed",
        "reason": "第 22 轮：同步 在 Completed 中新增未完成待办 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_in_completed_user: \"用户\"\nOPAR_create_in_completed_ui: \"页面交互\"\nOPAR_create_in_completed_store: \"清单状态\"\nOPAR_create_in_completed_storage: \"保存适配\"\nOPAR_create_in_completed_saved: \"浏览器内待办数据\"\nOPAR_create_in_completed_user -> OPAR_create_in_completed_ui: \"1. 按 Enter 提交新增标题。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"2. 创建新的未完成身份并追加到完整清单末尾。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_create_in_completed_storage -> OPAR_create_in_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_create_in_completed_storage -> OPAR_create_in_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_ui: \"10. 新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_create_in_completed_user: \"用户\"\nOPAR_create_in_completed_ui: \"页面交互\"\nOPAR_create_in_completed_store: \"清单状态\"\nOPAR_create_in_completed_storage: \"保存适配\"\nOPAR_create_in_completed_saved: \"浏览器内待办数据\"\nOPAR_create_in_completed_user -> OPAR_create_in_completed_ui: \"1. 按 Enter 提交新增标题。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"2. 创建新的未完成身份并追加到完整清单末尾。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_create_in_completed_storage -> OPAR_create_in_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_create_in_completed_storage -> OPAR_create_in_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_create_in_completed_store -> OPAR_create_in_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_create_in_completed_ui -> OPAR_create_in_completed_ui: \"10. 新增框清空，未完成数加一，Completed 选择保留且新项当前不可见；完整清单非空时仍显示页脚。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-clear-hidden-completed",
        "reason": "第 22 轮：同步 在 Active 中清除隐藏的已完成项 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_clear_hidden_completed_user: \"用户\"\nOPAR_clear_hidden_completed_ui: \"页面交互\"\nOPAR_clear_hidden_completed_store: \"清单状态\"\nOPAR_clear_hidden_completed_storage: \"保存适配\"\nOPAR_clear_hidden_completed_saved: \"浏览器内待办数据\"\nOPAR_clear_hidden_completed_user -> OPAR_clear_hidden_completed_ui: \"1. 点击仍然可见的 Clear completed。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"2. 从完整清单选择并移除全部已完成身份，包括当前看不到的项。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_storage: \"4. 提交最新完整清单，包含身份、整理后的标题、完成状态和顺序；删除结果以剩余条目表达。\"\nOPAR_clear_hidden_completed_storage -> OPAR_clear_hidden_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_clear_hidden_completed_storage -> OPAR_clear_hidden_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_ui: \"10. 隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_clear_hidden_completed_user: \"用户\"\nOPAR_clear_hidden_completed_ui: \"页面交互\"\nOPAR_clear_hidden_completed_store: \"清单状态\"\nOPAR_clear_hidden_completed_storage: \"保存适配\"\nOPAR_clear_hidden_completed_saved: \"浏览器内待办数据\"\nOPAR_clear_hidden_completed_user -> OPAR_clear_hidden_completed_ui: \"1. 点击仍然可见的 Clear completed。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"2. 从完整清单选择并移除全部已完成身份，包括当前看不到的项。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_store: \"3. 按独立身份定位条目，在完整清单内执行本次有效命令；保持未受影响条目及已有相对顺序。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_storage: \"4. 提交完整清单的已提交快照，包含隐藏项，排除新增草稿、编辑草稿与编辑会话状态。\"\nOPAR_clear_hidden_completed_storage -> OPAR_clear_hidden_completed_saved: \"5. 在当前实现隔离的存储空间保存完整快照，不改动其他实现的数据。\"\nOPAR_clear_hidden_completed_storage -> OPAR_clear_hidden_completed_store: \"6. 返回本次保存结果；本场景继续于保存成功，失败不能报告已保存。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"7. 返回本次命令结果，界面保留当前筛选。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_store: \"8. 按当前筛选读取派生展示结果；统计及整体空状态仍来自完整清单。\"\nOPAR_clear_hidden_completed_store -> OPAR_clear_hidden_completed_ui: \"9. 返回一致的展示快照。\"\nOPAR_clear_hidden_completed_ui -> OPAR_clear_hidden_completed_ui: \"10. 隐藏的已完成项被清除，Active 可见未完成项与剩余数量不变，清除按钮隐藏，分类保持 Active。\""
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受只保存完整已提交数据，初始化零写入；跨会话新提交与旧数据的衔接策略不虚构为已确定要求。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-23",
    "origin_refs": [
      "SCON-plain-text",
      "SREQ-create",
      "SREQ-edit",
      "SREQ-display",
      "SREQ-persist"
    ],
    "changes": [
      {
        "target_ref": "OMOD-ui",
        "reason": "第 23 轮用户文本安全边界覆盖呈现、业务与保存。",
        "patch": [
          {
            "op": "test",
            "path": "/constraint_refs",
            "value": [
              "SCON-consistent-behavior"
            ]
          },
          {
            "op": "replace",
            "path": "/constraint_refs",
            "value": [
              "SCON-consistent-behavior",
              "SCON-plain-text"
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-store",
        "reason": "第 23 轮用户文本安全边界覆盖呈现、业务与保存。",
        "patch": [
          {
            "op": "add",
            "path": "/constraint_refs",
            "value": [
              "SCON-plain-text"
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-storage",
        "reason": "第 23 轮用户文本安全边界覆盖呈现、业务与保存。",
        "patch": [
          {
            "op": "test",
            "path": "/constraint_refs",
            "value": [
              "SCON-local-storage"
            ]
          },
          {
            "op": "replace",
            "path": "/constraint_refs",
            "value": [
              "SCON-local-storage",
              "SCON-plain-text"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-plain-text",
        "reason": "第 23 轮：形成或修订 标题的文本语义，由引用的需求限定设计规则。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODEC-text-rendering",
        "reason": "第 23 轮：确认 文字内容与界面结构分离。同一标题必须在新增、编辑、显示和保存之间保持文本内容，避免视觉解释或执行改变需求语义。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受文本呈现边界，标题不作为页面结构或可执行内容。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-24",
    "origin_refs": [
      "SCON-visual-layout",
      "SREQ-display"
    ],
    "changes": [
      {
        "target_ref": "OMOD-ui",
        "reason": "第 24 轮可见布局由页面模块承接。",
        "patch": [
          {
            "op": "test",
            "path": "/constraint_refs",
            "value": [
              "SCON-consistent-behavior",
              "SCON-plain-text"
            ]
          },
          {
            "op": "replace",
            "path": "/constraint_refs",
            "value": [
              "SCON-consistent-behavior",
              "SCON-plain-text",
              "SCON-visual-layout"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-presentation",
        "reason": "第 24 轮：形成或修订 统一呈现规则，由引用的需求限定设计规则。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
                }
              ],
              "scope_refs": [
                "OMOD-ui"
              ],
              "requirement_refs": [
                "SREQ-display"
              ],
              "constraint_refs": [
                "SCON-visual-layout",
                "SCON-consistent-behavior"
              ],
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "ODEC-presentation-owner",
        "reason": "第 24 轮：确认 样式由页面职责集中维护。现有需求规定视觉关系而非像素级参数，集中维护样式可使空状态与后续交互采用同一呈现规则。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受页面统一维护布局，不把未给出的像素和实现文件结构写成业务要求。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-25",
    "origin_refs": [
      "SREQ-create",
      "SREQ-display"
    ],
    "changes": [
      {
        "target_ref": "OCON-presentation",
        "reason": "第 25 轮新增框样式属于同一呈现规则。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-presentation",
        "reason": "第 25 轮统一新增框与清单宽度。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
              {
                "id": "OCON-presentation-RULE-1",
                "description": "外层浅灰背景承载居中单列白色卡片，使用受约束的内容宽度，窄屏随可用空间收缩，不产生横向滚动。"
              },
              {
                "id": "OCON-presentation-RULE-2",
                "description": "todos 位于卡片上方居中，以明显较大的细体淡红字建立层级；布局样式与清单是否为空分开处理。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-presentation",
        "reason": "第 25 轮为长文本和操作控件建立布局边界。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受共享内容宽度与预留操作区域，长标题换行不遮挡控件。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-26",
    "origin_refs": [
      "SREQ-toggle",
      "SREQ-delete",
      "SREQ-edit"
    ],
    "changes": [
      {
        "target_ref": "OCON-presentation",
        "reason": "第 26 轮状态、删除与编辑共用呈现规则。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-delete",
              "SREQ-edit"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-presentation",
        "reason": "第 26 轮状态样式消费同一业务投影。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-presentation",
        "reason": "第 26 轮稳定删除控件布局。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-presentation",
        "reason": "第 26 轮编辑样式与会话状态统一。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受业务状态驱动完成样式，删除区域固定占位，编辑外观随会话切换。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-27",
    "origin_refs": [
      "SDOM-todos",
      "SFEA-display",
      "SFEA-create",
      "SFEA-edit",
      "SREQ-display",
      "SREQ-filter",
      "SCON-visual-layout",
      "SREQ-information"
    ],
    "changes": [
      {
        "target_ref": "OMOD-ui",
        "reason": "第 27 轮页面承接卡片外帮助与归属信息。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-count",
              "SREQ-edit",
              "SREQ-delete",
              "SREQ-toggle-all",
              "SREQ-clear-completed",
              "SREQ-filter",
              "SREQ-navigation"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-presentation",
        "reason": "第 27 轮补齐页脚与外部信息的呈现范围。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-delete",
              "SREQ-edit"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-toggle",
              "SREQ-delete",
              "SREQ-edit",
              "SREQ-information",
              "SREQ-filter",
              "SREQ-count",
              "SREQ-clear-completed"
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-presentation",
        "reason": "第 27 轮页脚布局承接最终样式要求。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-presentation",
        "reason": "第 27 轮外部信息不能被整体空清单条件误隐藏。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
              }
            ]
          }
        ]
      },
      {
        "target_ref": "OCON-presentation",
        "reason": "第 27 轮保留装饰效果的要求强度。",
        "patch": [
          {
            "op": "test",
            "path": "/rules",
            "value": [
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
              }
            ]
          },
          {
            "op": "replace",
            "path": "/rules",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "OMOD-ui",
        "reason": "第 27 轮归纳已形成的页面边界与协作，保持原模块身份。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "负责页面呈现、输入草稿和用户动作接入；把 Enter 新增交给清单状态，成功后清空新增框，加载时聚焦。清单内容以状态模块的快照为准。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "负责页面布局、英文文案、文本呈现、新增草稿与编辑会话；通过状态模块执行命令并读取投影，通过导航模块同步地址筛选。按完整清单控制主体及页脚显隐，卡片外帮助归属始终保留；界面不直接写保存资源。"
          }
        ]
      },
      {
        "target_ref": "OSCN-show-empty-information",
        "reason": "第 27 轮：将 空清单仍显示帮助与归属 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
          }
        ]
      },
      {
        "target_ref": "OSCN-launch",
        "reason": "第 27 轮：将 打开页面并建立当前展示状态 落到模块协作，保持单一路径，更新受影响的步骤和结果。",
        "patch": [
          {
            "op": "test",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-navigation",
              "SREQ-persist"
            ]
          },
          {
            "op": "replace",
            "path": "/requirement_refs",
            "value": [
              "SREQ-display",
              "SREQ-create",
              "SREQ-navigation",
              "SREQ-information",
              "SREQ-persist"
            ]
          },
          {
            "op": "test",
            "path": "/steps",
            "value": [
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
                "action": "呈现 todos 与新增入口，根据完整清单是否为空决定主体和页脚显示，加载后聚焦新增输入框。"
              },
              {
                "id": "OSCN-launch-STEP-8",
                "source_ref": "OPAR-launch-ui",
                "type": "activity",
                "action": "启动与首次呈现不构成待办提交，不触发保存，不因未恢复显示而覆盖原有存储。"
              }
            ]
          },
          {
            "op": "replace",
            "path": "/steps",
            "value": [
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
            ]
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-launch",
        "reason": "第 27 轮：同步 打开页面并建立当前展示状态 与设计正文。",
        "patch": [
          {
            "op": "test",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_launch_user: \"用户\"\nOPAR_launch_ui: \"页面交互\"\nOPAR_launch_router: \"筛选导航\"\nOPAR_launch_history: \"地址与导航历史\"\nOPAR_launch_store: \"清单状态\"\nOPAR_launch_user -> OPAR_launch_ui: \"1. 打开浏览器中的 TodoMVC 单清单应用。\"\nOPAR_launch_ui -> OPAR_launch_router: \"2. 解析当前合法筛选地址；地址没有指定筛选时选择 All。\"\nOPAR_launch_router -> OPAR_launch_history: \"3. 读取当前页面地址，按已确认的路由映射确定筛选。\"\nOPAR_launch_router -> OPAR_launch_ui: \"4. 返回规范化筛选值，不改变待办数据。\"\nOPAR_launch_ui -> OPAR_launch_store: \"5. 读取本页清单展示结果。\"\nOPAR_launch_store -> OPAR_launch_ui: \"6. 返回当前清单及本轮已经定义的派生展示值。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"7. 呈现 todos 与新增入口，根据完整清单是否为空决定主体和页脚显示，加载后聚焦新增输入框。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"8. 启动与首次呈现不构成待办提交，不触发保存，不因未恢复显示而覆盖原有存储。\""
          },
          {
            "op": "replace",
            "path": "/d2_code",
            "value": "shape: sequence_diagram\nOPAR_launch_user: \"用户\"\nOPAR_launch_ui: \"页面交互\"\nOPAR_launch_router: \"筛选导航\"\nOPAR_launch_history: \"地址与导航历史\"\nOPAR_launch_store: \"清单状态\"\nOPAR_launch_user -> OPAR_launch_ui: \"1. 打开浏览器中的 TodoMVC 单清单应用。\"\nOPAR_launch_ui -> OPAR_launch_router: \"2. 解析当前合法筛选地址；地址没有指定筛选时选择 All。\"\nOPAR_launch_router -> OPAR_launch_history: \"3. 读取当前页面地址，按已确认的路由映射确定筛选。\"\nOPAR_launch_router -> OPAR_launch_ui: \"4. 返回规范化筛选值，不改变待办数据。\"\nOPAR_launch_ui -> OPAR_launch_store: \"5. 读取本页清单展示结果。\"\nOPAR_launch_store -> OPAR_launch_ui: \"6. 返回当前清单及本轮已经定义的派生展示值。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"7. 呈现当前视图、标题、新增入口和卡片外帮助归属信息，应用统一视觉规则；加载后将焦点交给新增输入框。\"\nOPAR_launch_ui -> OPAR_launch_ui: \"8. 启动与首次呈现不构成待办提交，不触发保存，不因未恢复显示而覆盖原有存储。\""
          }
        ]
      },
      {
        "target_ref": "ODIAG-scenario-show-empty-information",
        "reason": "第 27 轮：同步 空清单仍显示帮助与归属 与设计正文。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "【模拟 Confirm】接受完整页脚与独立帮助归属区域；本轮不新增业务功能，既有非阻塞风险继续保留。"
      }
    ]
  }
] satisfies SolutionRecord[];
