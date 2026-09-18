/**
 * 从空 Specification Artifact 开始，按 todomvcIntents 的顺序逐轮模拟流程形成的 27 条记录。
 * 流程：analyze →（需要时 clarify → analyze）→ confirm → finalize。
 * questions 的答复来自当前问题相关的 knowledge；feedbacks 中的 user 为模拟确认，非真实用户对话。
 * 每轮仅纳入当前 Intent 和相关澄清，不提前吸收后续 Intent，也不包含后续修改示例。
 * 静态保存每轮原始 Intent 与最终累计补丁，可从空 Artifact 顺序重放；不是 Kernel 运行日志。
 */
import type { SpecificationRecord } from '../record.js';

export const todoRecords = [
  {
    "id": "RUN-todomvc-spec-01",
    "intent": "我想做个像 TodoMVC 那样的待办小工具，在浏览器里用，一份清单就够了。标题叫 todos，操作按钮用英文。不管用哪种语言或框架做，功能和用法都应该一样。",
    "origin_refs": [
      "SDOM-todos",
      "SFEA-display",
      "SREQ-display",
      "SCON-consistent-behavior"
    ],
    "changes": [
      {
        "target_ref": "SDOM-todos",
        "reason": "第 1 轮明确单清单待办应用的领域边界。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SDOM-todos",
              "responsibility": "在浏览器中管理一份待办清单。",
              "status": "active"
            }
          }
        ]
      },
      {
        "target_ref": "SFEA-display",
        "reason": "第 1 轮建立清单展示职责。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SFEA-display",
              "responsibility": "展示待办清单及其页面信息。",
              "status": "active",
              "domain_ref": "SDOM-todos"
            }
          }
        ]
      },
      {
        "target_ref": "SREQ-display",
        "reason": "第 1 轮明确应用入口和标题。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SREQ-display",
              "status": "active",
              "description": "浏览器页面提供一份待办清单，页面标题为 todos。",
              "acceptances": [
                {
                  "id": "SACC-display-single-list",
                  "requirement_ref": "SREQ-display",
                  "description": "打开应用时呈现单清单待办页面，标题显示 todos。"
                }
              ],
              "feature_ref": "SFEA-display",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "SCON-consistent-behavior",
        "reason": "第 1 轮约束所有实现的业务行为与界面语言。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SCON-consistent-behavior",
              "status": "active",
              "description": "应用在浏览器中使用一份待办清单；操作文案为英文，不同语言或框架的实现保持本版已确认的功能和用户可见用法一致。",
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
        "content": "确认本轮变化：先定义浏览器中的单清单待办应用，标题 todos、英文操作文案；不同语言或框架保持相同功能和用法。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-02",
    "intent": "上面放个输入框，提示 What needs to be done?。打开页面就能直接打字。我输入“买牛奶”按回车，就在最后添一条还没完成的待办，再把输入框清空，方便继续记下一条。不按回车就先别加进去。",
    "origin_refs": [
      "SFEA-create",
      "SREQ-create"
    ],
    "changes": [
      {
        "target_ref": "SFEA-create",
        "reason": "第 2 轮增加新增待办职责。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SFEA-create",
              "responsibility": "将已提交的输入标题加入待办清单。",
              "status": "active",
              "domain_ref": "SDOM-todos"
            }
          }
        ]
      },
      {
        "target_ref": "SREQ-create",
        "reason": "第 2 轮定义新增触发条件、初始状态和成功结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SREQ-create",
              "status": "active",
              "description": "页面顶部提供提示为 What needs to be done? 的新增输入框，加载后获得焦点；按 Enter 新增一条未完成待办到清单末尾，成功后清空输入框。未按 Enter 的输入不创建待办。",
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
                }
              ],
              "feature_ref": "SFEA-create",
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
        "content": "确认本轮变化：新增框提示 What needs to be done?，打开即获得焦点；Enter 新增一条未完成待办到末尾并清空输入，未提交不新增。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-03",
    "intent": "标题两头多打的空格帮我去掉，中间的留着。空着或者只有空格就别添加。一样的标题可以记两次，当成两件独立的事，改一条、勾一条或删一条，都别影响另一条。",
    "origin_refs": [
      "SREQ-create",
      "SACC-create-trim",
      "SACC-create-blank",
      "SACC-create-duplicate"
    ],
    "changes": [
      {
        "target_ref": "SREQ-create",
        "reason": "第 3 轮限定有效提交和同名条目的独立身份。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "页面顶部提供提示为 What needs to be done? 的新增输入框，加载后获得焦点；按 Enter 新增一条未完成待办到清单末尾，成功后清空输入框。未按 Enter 的输入不创建待办。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "页面顶部提供提示为 What needs to be done? 的新增输入框，加载后获得焦点；按 Enter 将去除首尾空白后的非空标题作为一条具有独立身份的未完成待办追加到末尾，成功后清空输入。保留中间空格，允许同名待办；空输入、纯空白或未按 Enter 的输入不创建待办。"
          }
        ]
      },
      {
        "target_ref": "SACC-create-trim",
        "reason": "第 3 轮明确标题规范化边界。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-create-trim",
              "requirement_ref": "SREQ-create",
              "description": "输入“  买  牛奶  ”按 Enter，仅新增标题为“买  牛奶”的待办，首尾空白去除且中间空格保留。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-create-blank",
        "reason": "第 3 轮拒绝无效标题。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-create-blank",
              "requirement_ref": "SREQ-create",
              "description": "空输入或纯空白按 Enter 均不创建待办，清单数量保持不变。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-create-duplicate",
        "reason": "第 3 轮明确标题不作为待办身份。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-create-duplicate",
              "requirement_ref": "SREQ-create",
              "description": "连续两次提交相同标题，得到两条独立待办；之后修改、完成或删除其中一条时，另一条保持不变。"
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：新增去除首尾空白、保留中间空格，拒绝空标题；同名待办具有独立身份，操作其中一条不影响另一条。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-04",
    "intent": "待办按添加顺序排，每按一次回车只加一条。以后改名字或者勾完成，也别换位置。一条都没有时，只留标题和新增输入框，列表、全选和下面那排操作都收起来；添了第一条再显示，删光后再收起来。",
    "origin_refs": [
      "SREQ-display",
      "SACC-display-order",
      "SACC-display-empty",
      "SACC-create-one-per-submit"
    ],
    "changes": [
      {
        "target_ref": "SREQ-display",
        "reason": "第 4 轮建立稳定顺序和整份清单的空状态；尚未展开页脚各项操作规则。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "浏览器页面提供一份待办清单，页面标题为 todos。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "浏览器页面提供一份待办清单，标题为 todos，新增入口始终可用。按加入顺序展示待办，修改标题或完成状态不改变位置。完整清单为空时隐藏清单主体（含全选控件）与操作页脚；加入第一条后显示，删除最后一条后重新隐藏。"
          }
        ]
      },
      {
        "target_ref": "SACC-display-order",
        "reason": "第 4 轮要求编辑与状态变化保持位置。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-display-order",
              "requirement_ref": "SREQ-display",
              "description": "按顺序新增 A、B、C，清单依次显示 A、B、C；修改 B 的标题或完成状态后，B 仍位于第二条。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-display-empty",
        "reason": "第 4 轮按完整清单是否为空控制区域显示。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-display-empty",
              "requirement_ref": "SREQ-display",
              "description": "完整清单为空时，标题和新增框可见，清单主体、全选和操作页脚隐藏；新增第一条后显示，删除最后一条后重新隐藏。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-create-one-per-submit",
        "reason": "第 4 轮补充单次提交与连续新增的验收。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-create-one-per-submit",
              "requirement_ref": "SREQ-create",
              "description": "连续提交有效标题时，每次 Enter 只增加一条，并按提交先后追加到清单末尾。"
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：每次有效 Enter 只增加一条，按加入顺序展示，改名或切换完成状态不换位置；空清单隐藏主体、全选和操作页脚。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-05",
    "intent": "每条旁边放个勾选框，勾上表示做完，取消勾选就表示还没做完。做完的标题划一道线，让我一眼分得清。点完马上变化，不用刷新，也别改标题、换位置或影响其他条目。",
    "origin_refs": [
      "SFEA-completion",
      "SREQ-toggle"
    ],
    "changes": [
      {
        "target_ref": "SFEA-completion",
        "reason": "第 5 轮增加完成状态管理职责。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SFEA-completion",
              "responsibility": "切换待办完成状态并一致呈现结果。",
              "status": "active",
              "domain_ref": "SDOM-todos"
            }
          }
        ]
      },
      {
        "target_ref": "SREQ-toggle",
        "reason": "第 5 轮定义单条完成操作及隔离范围。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
                }
              ],
              "feature_ref": "SFEA-completion",
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
        "content": "确认本轮变化：每条可勾选完成或取消完成，完成标题显示删除线，操作立即生效且保持身份、标题、位置及其他条目不变。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-06",
    "intent": "下面显示还有几件没做完，数字加粗。英文写成 1 item left、2 items left，零件就是 0 items left。添加、完成、重新打开或删除时跟着更新，改名字不用变。全部做完但还没删时也显示零，只有清单真的空了才把下面这排藏起来。",
    "origin_refs": [
      "SREQ-count"
    ],
    "changes": [
      {
        "target_ref": "SREQ-count",
        "reason": "第 6 轮定义未完成计数的显示、更新和空状态。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SREQ-count",
              "status": "active",
              "description": "操作页脚显示未完成待办数量，数字加粗；数量为 1 时显示 1 item left，其余显示 N items left。新增、完成、重新打开或删除时更新，单纯改名不改变数量；非空清单全部完成时显示零，完整清单为空时随页脚隐藏。",
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
                }
              ],
              "feature_ref": "SFEA-display",
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
        "content": "确认本轮变化：页脚以加粗数字显示未完成数量及英文单复数；新增、完成、重新打开和删除同步更新，全部完成显示零，完整清单为空才隐藏。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-07",
    "intent": "双击标题就能在原来的位置改名字，做完的也能改。先把原标题放进去，让我直接接着输入。改的时候，这一条原来的文字、勾选框和删除按钮先藏起来。",
    "origin_refs": [
      "SFEA-edit",
      "SREQ-edit"
    ],
    "changes": [
      {
        "target_ref": "SFEA-edit",
        "reason": "第 7 轮增加标题编辑职责。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SFEA-edit",
              "responsibility": "就地修改已有待办的标题。",
              "status": "active",
              "domain_ref": "SDOM-todos"
            }
          }
        ]
      },
      {
        "target_ref": "SREQ-edit",
        "reason": "第 7 轮定义编辑入口，并吸收模拟澄清确认的自动焦点。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SREQ-edit",
              "status": "active",
              "description": "双击未完成或已完成待办的标题，在原标题位置进入编辑。编辑框预填当前已提交标题并获得焦点；编辑期间隐藏该条原有标题展示、完成控件和删除控件。",
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
                }
              ],
              "feature_ref": "SFEA-edit",
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [
      {
        "id": "QST-1",
        "question": "“让我直接接着输入”是否要求双击后编辑框自动获得焦点？",
        "description": "模拟澄清；答复依据 todo.intents.ts 的 knowledge.editTodo[1]，仅用于本轮问题。",
        "answer": "双击未完成或已完成待办的标题后进入编辑状态，编辑框包含当前已提交标题并获得焦点。"
      }
    ],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：双击任意完成状态的标题可就地编辑，编辑框载入已提交标题并获得焦点，隐藏该条原文字、完成控件和删除控件。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-08",
    "intent": "改好按回车，或者点到别处，都保存并结束编辑。还是去掉两头的空格，中间保留。它仍然是原来那一条，做没做完、排在哪儿都别变。按回车后再点出去，也别重复处理，更不能误删。",
    "origin_refs": [
      "SREQ-edit",
      "SACC-edit-enter-submit",
      "SACC-edit-blur-submit",
      "SACC-edit-enter-then-blur"
    ],
    "changes": [
      {
        "target_ref": "SREQ-edit",
        "reason": "第 8 轮补充非空改名的提交语义，空标题提交尚待后续输入规定。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "双击未完成或已完成待办的标题，在原标题位置进入编辑。编辑框预填当前已提交标题并获得焦点；编辑期间隐藏该条原有标题展示、完成控件和删除控件。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "双击任意完成状态的待办标题可就地编辑，预填已提交标题并获得焦点，隐藏该条原标题及完成、删除控件。通过 Enter 或失焦提交非空标题并退出编辑，去除首尾空白、保留中间空格，保持身份、完成状态和位置。Enter 提交后发生失焦不得重复处理或误删。"
          }
        ]
      },
      {
        "target_ref": "SACC-edit-enter-submit",
        "reason": "第 8 轮明确 Enter 的整理及提交结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-edit-enter-submit",
              "requirement_ref": "SREQ-edit",
              "description": "把标题改为“  买  面包  ”按 Enter，保存为“买  面包”并退出编辑，仍为原待办，身份、完成状态和位置不变。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-edit-blur-submit",
        "reason": "第 8 轮使失焦提交与 Enter 一致。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-edit-blur-submit",
              "requirement_ref": "SREQ-edit",
              "description": "输入非空新标题后让编辑框失焦，按同样的首尾空白规则保存并退出编辑，身份、完成状态和位置不变。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-edit-enter-then-blur",
        "reason": "第 8 轮约束连续提交事件。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-edit-enter-then-blur",
              "requirement_ref": "SREQ-edit",
              "description": "Enter 提交非空新标题后再触发失焦，待办只提交一次，保留新标题，不重复处理或误删。"
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：非空改名通过 Enter 或失焦提交，去除首尾空白、保留中间空格；保留身份、完成状态和位置，Enter 后失焦不重复提交或误删。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-09",
    "intent": "按 Esc 就算了，退出编辑，恢复原来的标题。哪怕我把文字全删光了，按 Esc 也要留下原来那条。之后再点到别处，不能又把刚才取消的内容保存进去。",
    "origin_refs": [
      "SREQ-edit",
      "SACC-edit-escape",
      "SACC-edit-escape-blank"
    ],
    "changes": [
      {
        "target_ref": "SREQ-edit",
        "reason": "第 9 轮增加取消路径，区分草稿与已提交标题。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "双击任意完成状态的待办标题可就地编辑，预填已提交标题并获得焦点，隐藏该条原标题及完成、删除控件。通过 Enter 或失焦提交非空标题并退出编辑，去除首尾空白、保留中间空格，保持身份、完成状态和位置。Enter 提交后发生失焦不得重复处理或误删。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "双击任意完成状态的待办标题可就地编辑，预填已提交标题并获得焦点，隐藏该条原标题及完成、删除控件。通过 Enter 或失焦提交非空标题并退出编辑，去除首尾空白、保留中间空格，保持身份、完成状态和位置。Enter 提交后发生失焦不得重复处理或误删。 Escape 取消编辑并恢复原已提交标题，即使草稿为空或纯空白也保留原待办；取消后失焦不得保存被取消的内容。"
          }
        ]
      },
      {
        "target_ref": "SACC-edit-escape",
        "reason": "第 9 轮保证取消结果不被后续失焦覆盖。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-edit-escape",
              "requirement_ref": "SREQ-edit",
              "description": "输入新标题后按 Escape，退出编辑并恢复编辑前标题；随后失焦不提交已取消的草稿。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-edit-escape-blank",
        "reason": "第 9 轮明确空草稿的取消语义。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-edit-escape-blank",
              "requirement_ref": "SREQ-edit",
              "description": "将编辑草稿清空或改成纯空白后按 Escape，原待办和原标题保留；随后失焦也不保存或删除。"
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：Escape 退出编辑并恢复原标题，即使草稿为空也不删除；随后失焦不保存已取消的草稿。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-10",
    "intent": "不过，如果我把标题清空，或者只剩空格，然后按回车或点出去，就直接删掉这条，和 TodoMVC 一样。删除后数量和按钮也要跟着变，其他条目别动。",
    "origin_refs": [
      "SREQ-edit",
      "SACC-edit-delete-blank",
      "SACC-edit-delete-updates"
    ],
    "changes": [
      {
        "target_ref": "SREQ-edit",
        "reason": "第 10 轮补全空标题提交删除，保留第 9 轮取消优先语义。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "双击任意完成状态的待办标题可就地编辑，预填已提交标题并获得焦点，隐藏该条原标题及完成、删除控件。通过 Enter 或失焦提交非空标题并退出编辑，去除首尾空白、保留中间空格，保持身份、完成状态和位置。Enter 提交后发生失焦不得重复处理或误删。 Escape 取消编辑并恢复原已提交标题，即使草稿为空或纯空白也保留原待办；取消后失焦不得保存被取消的内容。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "双击任意完成状态的待办标题可就地编辑，预填已提交标题并获得焦点，隐藏该条原标题及完成、删除控件。Enter 或失焦提交时去除首尾空白、保留中间空格：非空则保存到同一待办，保持完成状态和位置；为空则删除该条并更新相关数量、控件与空状态。Escape 取消并恢复原已提交标题，即使草稿为空或纯空白也保留原待办。Enter 提交或 Escape 取消后的失焦不得重复处理、保存已取消草稿或误删。"
          }
        ]
      },
      {
        "target_ref": "SACC-edit-delete-blank",
        "reason": "第 10 轮覆盖空标题与两种提交入口。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-edit-delete-blank",
              "requirement_ref": "SREQ-edit",
              "description": "分别将标题清空或改为纯空白，再分别通过 Enter 或失焦提交，均删除被编辑的那条，其他待办的内容、状态和顺序不变。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-edit-delete-updates",
        "reason": "第 10 轮要求删除结果一致且不重复处理。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-edit-delete-updates",
              "requirement_ref": "SREQ-edit",
              "description": "空标题提交删除后，未完成计数、相关按钮和清单空状态与剩余待办一致；Enter 删除后继续失焦，不再删除其他条目。"
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：空标题或纯空白通过 Enter、失焦提交时删除原待办并更新数量、按钮和空状态；Escape 仍按取消处理。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-11",
    "intent": "再给每条加个删除按钮，平时鼠标移到那条上面才出现，点一下就删。做完没做完都能删，只动我点的那条。剩下的内容和顺序不变，未完成数量、全选和清除按钮也一起更新。",
    "origin_refs": [
      "SFEA-remove",
      "SREQ-delete"
    ],
    "changes": [
      {
        "target_ref": "SFEA-remove",
        "reason": "第 11 轮增加直接删除职责。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SFEA-remove",
              "responsibility": "删除指定待办。",
              "status": "active",
              "domain_ref": "SDOM-todos"
            }
          }
        ]
      },
      {
        "target_ref": "SREQ-delete",
        "reason": "第 11 轮明确悬停删除入口及相关展示更新。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
                }
              ],
              "feature_ref": "SFEA-remove",
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
        "content": "确认本轮变化：非编辑条目悬停显示删除按钮，点击立即删除该条；支持两种完成状态，其余条目内容和顺序不变，相关数量和控件同步更新。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-12",
    "intent": "我还想一键把所有待办勾上，也能一键全部取消。勾完剩余数量就是零，全部取消后就是清单总数，标题和顺序都不变。只有每一条都完成时，全选才是勾着的；逐条勾完最后一条，它也自动勾上。重新打开一条或者再添一条，它就取消勾选。",
    "origin_refs": [
      "SFEA-completion",
      "SREQ-toggle-all"
    ],
    "changes": [
      {
        "target_ref": "SFEA-completion",
        "reason": "第 12 轮将完成职责扩展到批量操作。",
        "patch": [
          {
            "op": "test",
            "path": "/responsibility",
            "value": "切换待办完成状态并一致呈现结果。"
          },
          {
            "op": "replace",
            "path": "/responsibility",
            "value": "切换单条或整份清单的完成状态，并一致呈现结果。"
          }
        ]
      },
      {
        "target_ref": "SREQ-toggle-all",
        "reason": "第 12 轮定义批量完成和由完整清单派生的全选状态。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SREQ-toggle-all",
              "status": "active",
              "description": "全选控件将整份清单统一设为已完成或未完成，不改变待办身份、标题或顺序。清单非空且全部完成时才显示选中；逐条完成最后一条时自动选中，重新打开或新增未完成待办时取消选中。",
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
                }
              ],
              "feature_ref": "SFEA-completion",
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
        "content": "确认本轮变化：全选可将整份清单设为完成或未完成；非空且全部完成才选中，逐条完成、新增或重新打开时同步状态，标题和顺序不变。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-13",
    "intent": "有做完的事情才显示 Clear completed，点它删掉所有已完成的，没完成的原样保留，剩余数量也不变。清完就隐藏这个按钮，有待办留下就继续显示清单，删光才全部收起来。清空后别留下勾着的全选；再添加一条时，全选也不能是勾着的。",
    "origin_refs": [
      "SFEA-remove",
      "SREQ-clear-completed",
      "SACC-toggle-all-empty-reset"
    ],
    "changes": [
      {
        "target_ref": "SFEA-remove",
        "reason": "第 13 轮扩展删除职责到批量清除。",
        "patch": [
          {
            "op": "test",
            "path": "/responsibility",
            "value": "删除指定待办。"
          },
          {
            "op": "replace",
            "path": "/responsibility",
            "value": "删除指定待办，或一次清除全部已完成待办。"
          }
        ]
      },
      {
        "target_ref": "SREQ-clear-completed",
        "reason": "第 13 轮定义清除入口、作用对象和结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SREQ-clear-completed",
              "status": "active",
              "description": "完整清单存在已完成待办时显示 Clear completed；点击删除所有已完成待办，保留未完成待办的身份、标题、状态和相对顺序，未完成计数不变。清除后按钮隐藏，有剩余待办则主体和页脚保留，清单为空则隐藏。",
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
                }
              ],
              "feature_ref": "SFEA-remove",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "SACC-toggle-all-empty-reset",
        "reason": "第 13 轮补充清空及再次新增的全选边界。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-toggle-all-empty-reset",
              "requirement_ref": "SREQ-toggle-all",
              "description": "清除全部已完成待办使清单为空后，不残留可见的全选选中状态；再次新增未完成待办时全选未选中。"
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：仅有已完成待办时显示 Clear completed，一次清掉所有已完成；未完成条目和数量不变，清完隐藏按钮，删光后重置空状态和全选。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-14",
    "intent": "下面再加 All、Active、Completed。All 看全部，Active 看没做完的，Completed 看做完的，选了哪个要看得出来。只是换个看法，仍然是同一份清单，内容和原来的先后顺序都别变。",
    "origin_refs": [
      "SFEA-filter",
      "SREQ-filter"
    ],
    "changes": [
      {
        "target_ref": "SFEA-filter",
        "reason": "第 14 轮增加状态筛选职责。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SFEA-filter",
              "responsibility": "按待办完成状态查看同一份清单。",
              "status": "active",
              "domain_ref": "SDOM-todos"
            }
          }
        ]
      },
      {
        "target_ref": "SREQ-filter",
        "reason": "第 14 轮定义三种视图及其共同数据边界。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SREQ-filter",
              "status": "active",
              "description": "页脚提供 All、Active、Completed，分别显示全部、未完成、已完成待办，并标明当前选中项。筛选仅决定可见条目，共享同一份完整清单，不修改实际内容、状态或原有相对顺序。",
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
                }
              ],
              "feature_ref": "SFEA-filter",
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
        "content": "确认本轮变化：All、Active、Completed 分别查看全部、未完成和已完成，选中入口可辨识；共享同一份清单，筛选不修改内容或相对顺序。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-15",
    "intent": "在 Active 里勾完一条，它就从这里消失，在 Completed 或 All 里能找到；在 Completed 里取消完成则反过来。改标题也改的是同一条，回到 All 能看到。添加、修改、删除、全选或者清除后，列表马上更新，但别替我切换正在看的分类。",
    "origin_refs": [
      "SREQ-filter",
      "SACC-filter-complete-in-active",
      "SACC-filter-reopen-in-completed",
      "SACC-filter-mutation-sync",
      "SACC-edit-same-item-in-filter"
    ],
    "changes": [
      {
        "target_ref": "SREQ-filter",
        "reason": "第 15 轮补充操作后的视图同步和筛选保持。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "页脚提供 All、Active、Completed，分别显示全部、未完成、已完成待办，并标明当前选中项。筛选仅决定可见条目，共享同一份完整清单，不修改实际内容、状态或原有相对顺序。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "页脚提供 All、Active、Completed，分别显示全部、未完成、已完成待办，并标明当前选中项。筛选仅决定可见条目，共享同一份完整清单，不修改实际内容、状态或原有相对顺序。 在任意视图操作同一份清单；新增、编辑、删除、单条或批量完成、清除已完成后立即按当前筛选重新匹配，筛选选择保持不变。"
          }
        ]
      },
      {
        "target_ref": "SACC-filter-complete-in-active",
        "reason": "第 15 轮覆盖从未完成变为已完成。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-filter-complete-in-active",
              "requirement_ref": "SREQ-filter",
              "description": "在 Active 完成一条后，该条立即消失，在 Completed 或 All 可见，当前仍选中 Active。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-filter-reopen-in-completed",
        "reason": "第 15 轮覆盖从已完成变为未完成。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-filter-reopen-in-completed",
              "requirement_ref": "SREQ-filter",
              "description": "在 Completed 取消一条完成状态后，该条立即消失，在 Active 或 All 可见，当前仍选中 Completed。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-filter-mutation-sync",
        "reason": "第 15 轮统一所有操作后的筛选一致性。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-filter-mutation-sync",
              "requirement_ref": "SREQ-filter",
              "description": "任一视图中新增、编辑、删除、全选或清除已完成后，可见列表立即按更新的清单重新匹配，当前筛选保持不变；删除项不再出现在任何视图。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-edit-same-item-in-filter",
        "reason": "第 15 轮明确跨视图编辑仍操作同一身份。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-edit-same-item-in-filter",
              "requirement_ref": "SREQ-edit",
              "description": "在 Active 或 Completed 编辑可见待办并提交非空标题，修改作用于原待办；切换到 All 后看到相同的新标题、完成状态和位置。"
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：筛选视图里的修改作用于同一条待办；完成状态变化立即重新匹配，新增、编辑、删除、全选、清除后保持当前分类。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-16",
    "intent": "在 Completed 里也能添加，新添的还没完成，所以先不显示，但剩余数量要加一，去 Active 或 All 就能看到。有时候只是当前分类没有内容，清单里其实还有别的待办，这时只让列表空着，下面的数字和分类按钮都留着，好让我切回去。",
    "origin_refs": [
      "SACC-create-in-completed",
      "SREQ-display",
      "SACC-display-empty-filter"
    ],
    "changes": [
      {
        "target_ref": "SACC-create-in-completed",
        "reason": "第 16 轮明确 Completed 下的新增结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-create-in-completed",
              "requirement_ref": "SREQ-create",
              "description": "在 Completed 提交有效标题，新待办以未完成状态加入完整清单末尾，当前不可见但未完成数量加一，筛选保持 Completed；切换到 Active 或 All 后可见。"
            }
          }
        ]
      },
      {
        "target_ref": "SREQ-display",
        "reason": "第 16 轮区分完整清单为空与当前视图为空。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "浏览器页面提供一份待办清单，标题为 todos，新增入口始终可用。按加入顺序展示待办，修改标题或完成状态不改变位置。完整清单为空时隐藏清单主体（含全选控件）与操作页脚；加入第一条后显示，删除最后一条后重新隐藏。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "浏览器页面提供一份待办清单，标题为 todos，新增入口始终可用。按加入顺序展示待办，修改标题或完成状态不改变位置。完整清单为空时隐藏清单主体（含全选控件）与操作页脚；加入第一条后显示，删除最后一条后重新隐藏。 当前筛选无匹配项但完整清单非空时，仅待办列表为空，主体、全选和操作页脚仍按非空清单显示，可继续切换筛选。"
          }
        ]
      },
      {
        "target_ref": "SACC-display-empty-filter",
        "reason": "第 16 轮防止把视图为空误判为完整清单为空。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-display-empty-filter",
              "requirement_ref": "SREQ-display",
              "description": "完整清单有待办但当前筛选没有匹配项时，列表为空，新增入口、全选、未完成数字及筛选按钮仍可用，可切回有内容的分类。"
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：Completed 中新增仍是未完成，所以当前不可见但剩余数量加一；分类无匹配项时只留空列表，完整清单非空就保留主体和页脚。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-17",
    "intent": "下面的数字始终算整份清单。例如两条没做完、一条做完了，看哪个分类都显示 2 items left。全选也管全部，包括现在看不到的。Clear completed 同样清掉全部已完成的，所以在 Active 里，只要有做完的，也要显示这个按钮并能清掉它们。",
    "origin_refs": [
      "SREQ-count",
      "SACC-count-global",
      "SREQ-toggle-all",
      "SACC-toggle-all-global",
      "SREQ-clear-completed",
      "SACC-clear-completed-global",
      "SACC-edit-delete-updates"
    ],
    "changes": [
      {
        "target_ref": "SREQ-count",
        "reason": "第 17 轮明确未完成统计的全局范围。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "操作页脚显示未完成待办数量，数字加粗；数量为 1 时显示 1 item left，其余显示 N items left。新增、完成、重新打开或删除时更新，单纯改名不改变数量；非空清单全部完成时显示零，完整清单为空时随页脚隐藏。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "操作页脚始终显示完整清单中未完成待办数量，与当前筛选可见数量无关；数字加粗，1 时显示 1 item left，其余显示 N items left。新增、完成、重新打开或删除时更新，单纯改名不变；非空清单全部完成时显示零，完整清单为空时随页脚隐藏。"
          }
        ]
      },
      {
        "target_ref": "SACC-count-global",
        "reason": "第 17 轮提供跨视图计数示例。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-count-global",
              "requirement_ref": "SREQ-count",
              "description": "完整清单有两条未完成和一条已完成时，All、Active、Completed 均显示 2 items left，切换筛选不改变计数。"
            }
          }
        ]
      },
      {
        "target_ref": "SREQ-toggle-all",
        "reason": "第 17 轮强调批量操作不局限于可见项。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "全选控件将整份清单统一设为已完成或未完成，不改变待办身份、标题或顺序。清单非空且全部完成时才显示选中；逐条完成最后一条时自动选中，重新打开或新增未完成待办时取消选中。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "全选控件将整份清单统一设为已完成或未完成，不改变待办身份、标题或顺序。清单非空且全部完成时才显示选中；逐条完成最后一条时自动选中，重新打开或新增未完成待办时取消选中。 操作范围包括当前筛选隐藏的待办，更新后重新匹配当前视图且不切换筛选。"
          }
        ]
      },
      {
        "target_ref": "SACC-toggle-all-global",
        "reason": "第 17 轮覆盖筛选下的全量操作。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-toggle-all-global",
              "requirement_ref": "SREQ-toggle-all",
              "description": "在 Active 或 Completed 中执行全选或全部取消，隐藏条目也一并更新；当前筛选保持不变，可见条目按结果重新匹配。"
            }
          }
        ]
      },
      {
        "target_ref": "SREQ-clear-completed",
        "reason": "第 17 轮明确清除入口和效果的全局范围。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "完整清单存在已完成待办时显示 Clear completed；点击删除所有已完成待办，保留未完成待办的身份、标题、状态和相对顺序，未完成计数不变。清除后按钮隐藏，有剩余待办则主体和页脚保留，清单为空则隐藏。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "完整清单存在已完成待办时显示 Clear completed；点击删除所有已完成待办，保留未完成待办的身份、标题、状态和相对顺序，未完成计数不变。清除后按钮隐藏，有剩余待办则主体和页脚保留，清单为空则隐藏。 显示条件和删除范围均包含当前筛选隐藏的已完成待办。"
          }
        ]
      },
      {
        "target_ref": "SACC-clear-completed-global",
        "reason": "第 17 轮覆盖不可见已完成项的清除。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-clear-completed-global",
              "requirement_ref": "SREQ-clear-completed",
              "description": "在 Active 中，只要完整清单有已完成待办就显示 Clear completed；点击清除全部隐藏的已完成项，未完成项不变，当前仍选中 Active。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-edit-delete-updates",
        "reason": "第 17 轮结合已定义的全局控件与筛选规则，补全第 10 轮删除联动验收。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "空标题提交删除后，未完成计数、相关按钮和清单空状态与剩余待办一致；Enter 删除后继续失焦，不再删除其他条目。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "空标题提交删除后，未完成计数、当前筛选结果、全选状态、Clear completed 和空清单展示按剩余完整清单更新，筛选选择保持不变；Enter 删除后继续失焦不重复删除。"
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：计数、全选和 Clear completed 都作用于完整清单，包括筛选隐藏的条目；Active 中也能清除不可见的已完成待办。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-18",
    "intent": "我希望地址也能看出正在看哪一类：#/ 是全部，#/active 是没做完的，#/completed 是做完的。没指定就看全部，直接打开某个地址就看那一类。用 #!/ 那种写法也行，几个入口统一就好。点分类时地址和列表一起变，已有待办别丢。",
    "origin_refs": [
      "SFEA-filter",
      "SREQ-navigation",
      "SREL-navigation-depends-filter"
    ],
    "changes": [
      {
        "target_ref": "SFEA-filter",
        "reason": "第 18 轮扩展筛选职责到地址选择。",
        "patch": [
          {
            "op": "test",
            "path": "/responsibility",
            "value": "按待办完成状态查看同一份清单。"
          },
          {
            "op": "replace",
            "path": "/responsibility",
            "value": "按待办完成状态查看同一份清单，并通过地址表达当前筛选。"
          }
        ]
      },
      {
        "target_ref": "SREQ-navigation",
        "reason": "第 18 轮定义地址选择；模拟澄清确认替代形式属于实现选择。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SREQ-navigation",
              "status": "active",
              "description": "地址 #/、#/active、#/completed 分别选择 All、Active、Completed；也允许实现统一采用等价的 #!/ 形式。未指定筛选时使用 All；直接访问合法地址采用对应筛选，点击入口时地址、选中项和列表同步更新，页面内导航保留现有待办。",
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
                }
              ],
              "feature_ref": "SFEA-filter",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "SREL-navigation-depends-filter",
        "reason": "第 18 轮建立地址导航对状态筛选的依赖，避免另存一套筛选语义。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SREL-navigation-depends-filter",
              "status": "active",
              "source_req_ref": "SREQ-navigation",
              "target_req_ref": "SREQ-filter",
              "type": "depends_on",
              "description": "地址导航选择 All、Active、Completed 中的一种视图，其显示结果依赖状态筛选要求中定义的匹配规则。",
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [
      {
        "id": "QST-2",
        "question": "“用 #!/ 那种写法也行”是否表示两套形式都必须支持，还是允许实现选择一种并统一使用？",
        "description": "模拟澄清；答复依据 todo.intents.ts 的 knowledge.filterNavigation[1]，仅用于本轮问题。",
        "answer": "可以统一采用 #/，也允许采用等价的 #!/ 形式；各入口与导航使用一致形式即可，不要求同时支持两套。"
      }
    ],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：地址表达三种筛选，未指定时为 All；支持直接访问和点击同步，页面内导航保留待办。允许统一使用等价的 #!/ 形式，不强制同时支持两套入口。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-19",
    "intent": "浏览器的后退、前进也要好用。从 All 到 Active 再到 Completed，后退就依次回 Active、All，前进再回来，选中的按钮和列表都跟着变。刷新后仍按地址选分类，但这次不要求把刷新前的待办重新显示出来。地址只是选择前面那三种看法，以后分类规则改了，对应地址下的结果也要一起改。",
    "origin_refs": [
      "SFEA-filter",
      "SREQ-navigation",
      "SACC-navigation-history",
      "SACC-navigation-refresh",
      "SREL-navigation-depends-filter"
    ],
    "changes": [
      {
        "target_ref": "SFEA-filter",
        "reason": "第 19 轮补充浏览器导航职责。",
        "patch": [
          {
            "op": "test",
            "path": "/responsibility",
            "value": "按待办完成状态查看同一份清单，并通过地址表达当前筛选。"
          },
          {
            "op": "replace",
            "path": "/responsibility",
            "value": "按待办完成状态查看同一份清单，并通过地址、浏览器前进后退和刷新表达当前筛选。"
          }
        ]
      },
      {
        "target_ref": "SREQ-navigation",
        "reason": "第 19 轮增加历史导航和刷新边界，不将筛选恢复扩展为待办恢复。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "地址 #/、#/active、#/completed 分别选择 All、Active、Completed；也允许实现统一采用等价的 #!/ 形式。未指定筛选时使用 All；直接访问合法地址采用对应筛选，点击入口时地址、选中项和列表同步更新，页面内导航保留现有待办。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "地址 #/、#/active、#/completed 分别选择 All、Active、Completed；也允许实现统一采用等价的 #!/ 形式。未指定筛选时使用 All；直接访问合法地址采用对应筛选，点击入口时地址、选中项和列表同步更新，页面内导航保留现有待办。 浏览器后退、前进按历史记录同步筛选；在合法地址刷新后采用地址对应的筛选规则，但本版不要求恢复刷新前的待办。地址始终选择已定义的三种筛选，筛选语义调整时同步检查导航结果。"
          }
        ]
      },
      {
        "target_ref": "SACC-navigation-history",
        "reason": "第 19 轮覆盖前进后退序列。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-navigation-history",
              "requirement_ref": "SREQ-navigation",
              "description": "从 All 切换到 Active 再到 Completed，后退依次返回 Active、All，前进依次回到 Active、Completed；地址、选中入口和可见列表同步，已有待办保持。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-navigation-refresh",
        "reason": "第 19 轮模拟澄清确认刷新验收仅针对筛选状态。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-navigation-refresh",
              "requirement_ref": "SREQ-navigation",
              "description": "在合法筛选地址刷新页面后，采用地址对应的筛选规则；若操作页脚可见，其选中入口与地址一致。本项只验收筛选状态，不要求恢复刷新前的待办。"
            }
          }
        ]
      },
      {
        "target_ref": "SREL-navigation-depends-filter",
        "reason": "第 19 轮明确依赖关系的变更影响。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "地址导航选择 All、Active、Completed 中的一种视图，其显示结果依赖状态筛选要求中定义的匹配规则。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "地址导航选择 All、Active、Completed 中的一种视图，其显示结果依赖状态筛选要求中定义的匹配规则；筛选规则调整时，须同步检查直接访问、点击切换、浏览器前进后退和刷新后的筛选结果。"
          }
        ]
      }
    ],
    "questions": [
      {
        "id": "QST-3",
        "question": "若刷新后没有恢复待办、操作页脚因此隐藏，这一轮如何验收地址筛选？",
        "description": "模拟澄清；答复依据 todo.intents.ts 的 knowledge.filterNavigation[5]，仅用于本轮问题。",
        "answer": "在合法筛选地址刷新页面后，采用地址对应的筛选规则；若操作页脚可见，其选中入口与地址一致。本项只验收筛选状态，不要求恢复刷新前的待办。"
      }
    ],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：浏览器后退、前进同步地址、选中项和列表；刷新只按地址选择筛选，不要求恢复待办。筛选规则调整时同步检查地址导航结果。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-20",
    "intent": "每次操作完帮我自动保存，不用再点保存按钮。就放在当前浏览器的 localStorage 里。不同框架做的版本要分开存，名字按 TodoMVC 的约定用 todos-[framework]，把后面换成各自的框架名，别把另一个版本的清单覆盖了。",
    "origin_refs": [
      "SFEA-persistence",
      "SREQ-persist",
      "SCON-local-storage"
    ],
    "changes": [
      {
        "target_ref": "SFEA-persistence",
        "reason": "第 20 轮增加浏览器内持久化职责。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SFEA-persistence",
              "responsibility": "自动保存待办操作后的数据。",
              "status": "active",
              "domain_ref": "SDOM-todos"
            }
          }
        ]
      },
      {
        "target_ref": "SREQ-persist",
        "reason": "第 20 轮建立自动保存能力，后续轮次继续细化保存内容和边界。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SREQ-persist",
              "status": "active",
              "description": "待办有效操作后自动将最新待办数据保存到当前浏览器的 localStorage，无需额外点击保存按钮；不同框架实现的数据相互隔离。",
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
                }
              ],
              "feature_ref": "SFEA-persistence",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "SCON-local-storage",
        "reason": "第 20 轮规定全局保存位置和命名隔离；模拟答复不补选框架。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SCON-local-storage",
              "status": "active",
              "description": "已提交待办数据保存在当前浏览器的 localStorage，存储键遵循 todos-[framework]，其中 [framework] 替换为实现名称；不同框架实现的新增、修改和删除不得覆盖彼此的清单。具体框架内部实现不在本版业务需求中指定。",
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [
      {
        "id": "QST-4",
        "question": "当前尚未选择框架，是否需要在本轮把 todos-[framework] 固定为某个具体名称？",
        "description": "模拟澄清；答复依据 todo.intents.ts 的 knowledge.constraints[1]、scope[4]，仅用于本轮问题。",
        "answer": "不需要。使用 todos-[framework] 的命名约定，在实现时将 [framework] 替换为实现名称；具体框架内部实现不属于这里的业务决定范围。"
      }
    ],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：待办有效操作后自动保存到当前浏览器 localStorage，使用 todos-[framework] 隔离各实现；具体框架由实现选择，不在需求中写死。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-21",
    "intent": "每条待办的标题、做没做完和加入顺序都要记住，同名的两条也得分得清。新增保存整理过的标题和未完成的标记；改名就更新原来那条，别多出副本。单条或全部勾选、取消都保存。点删除、清空标题后按回车或点出去删除、清除已完成，也都从保存的清单里去掉；删光后就存空清单。",
    "origin_refs": [
      "SFEA-persistence",
      "SREQ-persist",
      "SACC-persist-create",
      "SACC-persist-edit",
      "SACC-persist-completion",
      "SACC-persist-delete"
    ],
    "changes": [
      {
        "target_ref": "SFEA-persistence",
        "reason": "第 21 轮细化持久化职责。",
        "patch": [
          {
            "op": "test",
            "path": "/responsibility",
            "value": "自动保存待办操作后的数据。"
          },
          {
            "op": "replace",
            "path": "/responsibility",
            "value": "自动持久化待办的已提交内容、完成状态和删除结果。"
          }
        ]
      },
      {
        "target_ref": "SREQ-persist",
        "reason": "第 21 轮明确持久化内容、身份和全部变更入口。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "待办有效操作后自动将最新待办数据保存到当前浏览器的 localStorage，无需额外点击保存按钮；不同框架实现的数据相互隔离。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "待办有效提交后自动将最新数据保存到当前浏览器 localStorage，无需额外保存操作，各框架实现相互隔离。保存每条待办的独立身份、整理后的标题、完成状态和加入顺序；改名更新原条目不产生副本，单条和批量状态切换同步保存，直接删除、空标题提交删除及清除已完成均移除对应数据，删光后保存空清单。"
          }
        ]
      },
      {
        "target_ref": "SACC-persist-create",
        "reason": "第 21 轮验收新增的保存内容与顺序。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-persist-create",
              "requirement_ref": "SREQ-persist",
              "description": "有效新增后，存储中可核对独立身份、去除首尾空白的标题和未完成状态；连续新增保留加入顺序，同名两条保持独立。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-persist-edit",
        "reason": "第 21 轮验收两种改名提交入口。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-persist-edit",
              "requirement_ref": "SREQ-persist",
              "description": "通过 Enter 或失焦提交非空改名后，存储中同一身份的标题更新，完成状态和位置不变，不产生副本。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-persist-completion",
        "reason": "第 21 轮验收完成状态保存。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-persist-completion",
              "requirement_ref": "SREQ-persist",
              "description": "单条勾选、取消以及全选、全部取消后，存储中所有受影响待办的完成状态与操作结果一致，身份、标题和顺序不变。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-persist-delete",
        "reason": "第 21 轮覆盖全部删除路径及空清单保存。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-persist-delete",
              "requirement_ref": "SREQ-persist",
              "description": "直接删除、将标题清空或改为纯空白后通过 Enter 或失焦提交删除、Clear completed 清除后，对应待办均从存储的有效清单移除；删光后存空清单，不残留旧的有效待办。"
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：保存独立身份、整理后的标题、完成状态和加入顺序；改名更新同一条，单条与批量状态变化、所有删除入口都同步保存，删光存空清单。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-22",
    "intent": "保存要管整份清单，不能漏掉当前分类里看不到的条目。新增框里还没按回车的字、空输入，还有编辑到一半的文字都别存进去，也别记住“正在编辑”。按 Esc 取消后，存的仍然是原标题。现在只检查这些内容有没有保存正确，先不用做刷新后重新显示待办，也别因为这样就把已保存的内容清掉。",
    "origin_refs": [
      "SREQ-persist",
      "SACC-persist-full-list",
      "SACC-persist-exclude-drafts",
      "SACC-persist-cancel",
      "SACC-persist-no-restore-no-clear"
    ],
    "changes": [
      {
        "target_ref": "SREQ-persist",
        "reason": "第 22 轮限定提交边界、完整清单保存和不恢复显示的含义。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "待办有效提交后自动将最新数据保存到当前浏览器 localStorage，无需额外保存操作，各框架实现相互隔离。保存每条待办的独立身份、整理后的标题、完成状态和加入顺序；改名更新原条目不产生副本，单条和批量状态切换同步保存，直接删除、空标题提交删除及清除已完成均移除对应数据，删光后保存空清单。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "待办有效提交后自动将最新数据保存到当前浏览器 localStorage，无需额外保存操作，各框架实现相互隔离。保存每条待办的独立身份、整理后的标题、完成状态和加入顺序；改名更新原条目不产生副本，单条和批量状态切换同步保存，直接删除、空标题提交删除及清除已完成均移除对应数据，删光后保存空清单。 每次保存完整清单，包括当前筛选隐藏且未被操作的条目；未提交的新增文字、无效空输入、编辑草稿和正在编辑状态不作为已提交数据保存，Escape 后存储仍保留原标题。验收直接核对存储结果，不要求刷新后恢复显示；不得因不恢复或页面初始化未显示待办而清除已保存数据。"
          }
        ]
      },
      {
        "target_ref": "SACC-persist-full-list",
        "reason": "第 22 轮防止用筛选结果覆盖完整清单。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-persist-full-list",
              "requirement_ref": "SREQ-persist",
              "description": "在 Active 或 Completed 中提交变化后，存储仍表示更新后的完整清单，筛选隐藏且未被操作的待办保留，不因不可见而丢失。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-persist-exclude-drafts",
        "reason": "第 22 轮区分已提交模型与临时界面状态。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-persist-exclude-drafts",
              "requirement_ref": "SREQ-persist",
              "description": "新增框未按 Enter 的文字、被拒绝的空输入、编辑中的临时标题和正在编辑状态不进入已提交存储；即使此时发生其他有效操作，保存也不带入这些草稿。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-persist-cancel",
        "reason": "第 22 轮核对取消操作的持久化结果。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-persist-cancel",
              "requirement_ref": "SREQ-persist",
              "description": "编辑后按 Escape，存储中的标题仍为编辑前的已提交值；草稿为空或纯空白时也不删除存储中的原待办。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-persist-no-restore-no-clear",
        "reason": "第 22 轮区分主动删光后的空清单保存与未恢复显示，后者不能清除旧数据。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-persist-no-restore-no-clear",
              "requirement_ref": "SREQ-persist",
              "description": "已有存储数据时刷新页面，本版不要求恢复并显示待办；不得仅因未恢复或初始显示为空而将已保存数据覆盖为空。持久化验收直接核对各次有效提交的存储结果。"
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：保存完整清单而非当前视图；未提交新增、空输入和编辑草稿、编辑状态不入存储，Escape 保留原标题；只验收已提交存储结果，不要求刷新恢复，也不得因此清除旧存储。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-23",
    "intent": "我打的标题就当普通文字处理。比如 <b>买牛奶</b>，要原样显示和保存，别变成加粗效果，更不能执行里面的代码。除了前面说的去掉两头空格，添加、修改、显示和保存时都别擅自改我的内容。",
    "origin_refs": [
      "SCON-plain-text",
      "SACC-create-plain-text",
      "SACC-edit-plain-text",
      "SACC-display-plain-text",
      "SACC-persist-plain-text"
    ],
    "changes": [
      {
        "target_ref": "SCON-plain-text",
        "reason": "第 23 轮建立跨新增、编辑、展示和保存的用户文本约束。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SCON-plain-text",
              "status": "active",
              "description": "待办标题在新增、编辑、列表展示和保存过程中始终作为用户文本处理。除规定的首尾空白处理外，保留标题内容；例如输入 <b>买牛奶</b> 时，显示并保存这段文字本身，不将其解释为页面标记或可执行内容。",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "SACC-create-plain-text",
        "reason": "第 23 轮验证新增入口的文本边界。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-create-plain-text",
              "requirement_ref": "SREQ-create",
              "description": "新增标题“<b>买牛奶</b>”后保留该文字本身，只执行规定的首尾空白处理，不解释为页面标记或可执行内容。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-edit-plain-text",
        "reason": "第 23 轮验证编辑入口同样遵守文本边界。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-edit-plain-text",
              "requirement_ref": "SREQ-edit",
              "description": "通过 Enter 或失焦把标题改为包含页面标记的文字时，只执行规定的首尾空白处理，保留文字本身，不解释或执行其中内容。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-display-plain-text",
        "reason": "第 23 轮验证显示不解释用户文本。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-display-plain-text",
              "requirement_ref": "SREQ-display",
              "description": "标题“<b>买牛奶</b>”在列表中原样显示，不产生加粗效果；标题中的可执行内容不得执行。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-persist-plain-text",
        "reason": "第 23 轮验证保存的数据仍为原始用户文本。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-persist-plain-text",
              "requirement_ref": "SREQ-persist",
              "description": "新增或修改为“<b>买牛奶</b>”并提交后，存储标题为该文字本身，除规定的首尾空白处理外不擅自变更内容。"
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：标题在新增、编辑、展示和保存中都作为普通文字，只做规定的首尾空白处理；页面标记原样显示保存，不解释或执行。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-24",
    "intent": "页面我想要干净、轻一点，背景用很浅的灰色，中间放一列白色的待办卡片，桌面上别铺满整个屏幕，窄屏也不要出现横向滚动。todos 放在卡片上方居中，字要很大、很细，用淡一点的红色，看起来比输入框和清单文字更突出。",
    "origin_refs": [
      "SCON-visual-layout",
      "SACC-display-layout",
      "SACC-display-heading-style"
    ],
    "changes": [
      {
        "target_ref": "SCON-visual-layout",
        "reason": "第 24 轮定义可见布局与响应宽度，不补充未给出的像素或具体样式参数。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SCON-visual-layout",
              "status": "active",
              "description": "页面采用简洁轻量的单列布局：很浅的灰色背景，水平居中的白色待办卡片；桌面宽度适中、不铺满屏幕，窄屏随可用宽度收缩且不产生横向滚动。todos 在卡片上方居中，使用明显大于输入框和清单文字的细体淡红色字，形成清晰视觉层级。",
              "record_refs": []
            }
          }
        ]
      },
      {
        "target_ref": "SACC-display-layout",
        "reason": "第 24 轮使整体布局可验收。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-display-layout",
              "requirement_ref": "SREQ-display",
              "description": "桌面显示浅灰背景上的居中单列白色待办卡片，卡片不铺满屏幕；窄屏下内容随宽度收缩且不出现横向滚动。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-display-heading-style",
        "reason": "第 24 轮明确标题视觉层级。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-display-heading-style",
              "requirement_ref": "SREQ-display",
              "description": "todos 位于卡片上方居中，字形细、颜色淡红，字号明显大于输入框和清单文字。"
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：采用浅灰背景与居中单列白色卡片，桌面宽度适中、窄屏不横向滚动；todos 在上方居中，使用更大的细体淡红色文字。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-25",
    "intent": "新增输入框就放在白色卡片最上面，和下面的清单一样宽，字大一点，提示文字用浅灰色斜体；点进去时要看得出现在可以输入。每条待办单独占一行，留出舒服的间距，用细灰线分开，文字多了可以换行，不能盖住两边的操作。",
    "origin_refs": [
      "SACC-create-input-style",
      "SACC-display-row-style"
    ],
    "changes": [
      {
        "target_ref": "SACC-create-input-style",
        "reason": "第 25 轮规定新增框的位置、提示与焦点样式。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-create-input-style",
              "requirement_ref": "SREQ-create",
              "description": "新增框位于白色卡片最上方，与清单等宽，输入文字较大，What needs to be done? 使用浅灰斜体，获得焦点时有可见输入状态。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-display-row-style",
        "reason": "第 25 轮规定行间距、分隔和长文本布局。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-display-row-style",
              "requirement_ref": "SREQ-display",
              "description": "每条待办单独占一行，保持舒适一致的间距并用细灰线分隔；长标题可换行，不遮挡左右两侧操作控件。"
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：新增框位于卡片顶部并与清单等宽，大字配浅灰斜体提示且焦点可见；每条独占一行，留白和细灰分隔线一致，长标题换行不挡控件。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-26",
    "intent": "每条左边用圆形的完成按钮，没做完时标题用清楚的深色；做完后按钮里显示绿色的勾，标题变成浅灰色并加删除线。删除按钮放在最右边，鼠标移到这一行才出现一个淡红色的叉，出现时不要把标题挤动。双击编辑后，编辑框就在原来标题的位置替换它，大小跟这一行协调，边框和焦点要明显。",
    "origin_refs": [
      "SACC-toggle-state-style",
      "SACC-delete-button-style",
      "SACC-edit-input-style"
    ],
    "changes": [
      {
        "target_ref": "SACC-toggle-state-style",
        "reason": "第 26 轮细化已定义完成状态的可见样式。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-toggle-state-style",
              "requirement_ref": "SREQ-toggle",
              "description": "未完成时左侧为圆形完成控件、标题为清晰深色；完成后控件显示绿色勾，标题变为浅灰色并显示删除线，取消完成后恢复未完成样式。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-delete-button-style",
        "reason": "第 26 轮明确悬停删除的外观和布局稳定性。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-delete-button-style",
              "requirement_ref": "SREQ-delete",
              "description": "删除按钮位于待办行最右侧，非悬停时隐藏，悬停时显示淡红叉号；显示或隐藏不挤动标题或其他控件。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-edit-input-style",
        "reason": "第 26 轮明确就地编辑的视觉状态。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-edit-input-style",
              "requirement_ref": "SREQ-edit",
              "description": "双击后编辑框在原标题位置替换展示内容，尺寸与该行协调，边框清晰且焦点状态明显。"
            }
          }
        ]
      }
    ],
    "questions": [],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：完成控件在左侧呈圆形，完成后显示绿色勾和浅灰删除线标题；右侧淡红叉悬停出现且不挤动内容，编辑框就地替换并有清晰边框和焦点。"
      }
    ]
  },
  {
    "id": "RUN-todomvc-spec-27",
    "intent": "卡片底部那一排要紧凑：左边放剩余数量，中间放 All、Active、Completed，右边有需要时再显示 Clear completed。选中的分类用细的淡红色圆角边框圈出来，切换时整排不要跳来跳去。白色卡片下面可以有很轻的阴影和叠纸效果。卡片外面居中放 Double-click to edit a todo、作者或团队名字，以及指向 https://todomvc.com/ 的 Part of TodoMVC，小一点、浅灰一点，清单空了也保留。前面说的都按这个来，这一版没有需要留着以后再决定的事了。",
    "origin_refs": [
      "SDOM-todos",
      "SFEA-display",
      "SFEA-create",
      "SFEA-edit",
      "SACC-display-footer-style",
      "SACC-filter-selected-style",
      "SCON-visual-layout",
      "SREQ-information"
    ],
    "changes": [
      {
        "target_ref": "SDOM-todos",
        "reason": "第 27 轮全部输入确认后，汇总已逐轮形成的完整业务责任，不引入新能力。",
        "patch": [
          {
            "op": "test",
            "path": "/responsibility",
            "value": "在浏览器中管理一份待办清单。"
          },
          {
            "op": "replace",
            "path": "/responsibility",
            "value": "管理一份待办清单：记录要做的事情，修改内容，标记完成，移除不再需要的事项，按完成状态查看清单，并保存已提交的数据。每条待办具有独立身份、标题和完成状态。"
          }
        ]
      },
      {
        "target_ref": "SFEA-display",
        "reason": "第 27 轮展示职责已覆盖清单、空状态、计数及提示，汇总最终责任。",
        "patch": [
          {
            "op": "test",
            "path": "/responsibility",
            "value": "展示待办清单及其页面信息。"
          },
          {
            "op": "replace",
            "path": "/responsibility",
            "value": "展示待办清单、空清单状态、未完成数量和必要的操作提示。"
          }
        ]
      },
      {
        "target_ref": "SFEA-create",
        "reason": "第 27 轮将已确认的有效标题与未完成初态纳入最终功能职责。",
        "patch": [
          {
            "op": "test",
            "path": "/responsibility",
            "value": "将已提交的输入标题加入待办清单。"
          },
          {
            "op": "replace",
            "path": "/responsibility",
            "value": "把用户输入的有效标题加入清单，形成新的未完成待办。"
          }
        ]
      },
      {
        "target_ref": "SFEA-edit",
        "reason": "第 27 轮汇总已经确认的提交、取消与清空标题删除职责。",
        "patch": [
          {
            "op": "test",
            "path": "/responsibility",
            "value": "就地修改已有待办的标题。"
          },
          {
            "op": "replace",
            "path": "/responsibility",
            "value": "就地修改待办标题，支持提交、取消，以及通过清空标题删除待办。"
          }
        ]
      },
      {
        "target_ref": "SACC-display-footer-style",
        "reason": "第 27 轮明确页脚排列和布局稳定性。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-display-footer-style",
              "requirement_ref": "SREQ-display",
              "description": "操作页脚紧凑排列：左侧为剩余数量，中间为 All、Active、Completed，右侧按需显示 Clear completed；切换筛选或按钮显隐时整排不明显跳动。"
            }
          }
        ]
      },
      {
        "target_ref": "SACC-filter-selected-style",
        "reason": "第 27 轮细化选中入口外观。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
              "id": "SACC-filter-selected-style",
              "requirement_ref": "SREQ-filter",
              "description": "当前选中的分类以细的淡红色圆角边框圈出，其他分类无选中边框；切换分类时整排布局不明显跳动。"
            }
          }
        ]
      },
      {
        "target_ref": "SCON-visual-layout",
        "reason": "第 27 轮补充全局视觉约束；原 Intent 的“可以有”保留为可选装饰。",
        "patch": [
          {
            "op": "test",
            "path": "/description",
            "value": "页面采用简洁轻量的单列布局：很浅的灰色背景，水平居中的白色待办卡片；桌面宽度适中、不铺满屏幕，窄屏随可用宽度收缩且不产生横向滚动。todos 在卡片上方居中，使用明显大于输入框和清单文字的细体淡红色字，形成清晰视觉层级。"
          },
          {
            "op": "replace",
            "path": "/description",
            "value": "页面采用简洁轻量的单列布局：很浅的灰色背景，水平居中的白色待办卡片；桌面宽度适中、不铺满屏幕，窄屏随可用宽度收缩且不产生横向滚动。todos 在卡片上方居中，使用明显大于输入框和清单文字的细体淡红色字，形成清晰视觉层级。 白色卡片可使用轻微阴影和底部叠纸效果；操作页脚紧凑、状态切换不明显跳动，控件与文字遵守各要求中的可见样式。卡片外的提示与归属信息居中显示为小号浅灰文字。"
          }
        ]
      },
      {
        "target_ref": "SREQ-information",
        "reason": "第 27 轮增加卡片外信息；模拟澄清确认作者由实现填写，且外部提示不随空清单操作区域隐藏。",
        "patch": [
          {
            "op": "add",
            "path": "",
            "value": {
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
              "record_refs": []
            }
          }
        ]
      }
    ],
    "questions": [
      {
        "id": "QST-5",
        "question": "作者或团队名字需要在本轮确定成某个具体文案吗？",
        "description": "模拟澄清；答复依据 todo.intents.ts 的 knowledge.appInformation[2]，仅用于本轮问题。",
        "answer": "页面展示当前实现的作者或团队信息，并提供指向 https://todomvc.com/ 的 TodoMVC 项目入口；作者文案由具体实现填写。"
      },
      {
        "id": "QST-6",
        "question": "第 4 轮“只留标题和新增输入框”是否也要隐藏本轮增加的卡片外提示和项目归属？",
        "description": "模拟澄清；答复依据 todo.intents.ts 的 knowledge.listDisplay[2]、appInformation[3]、visualStyle[8]，仅用于本轮问题。",
        "answer": "不用隐藏。空清单时隐藏清单主体和操作页脚；卡片外的编辑提示、作者或团队信息和 TodoMVC 归属信息仍然可见。"
      }
    ],
    "feedbacks": [
      {
        "source": "user",
        "content": "确认本轮变化：页脚紧凑分列，选中分类有细淡红圆角边框且切换不跳动；卡片可有轻微阴影和叠纸效果，卡片外保留编辑提示、实现作者或团队、TodoMVC 链接；本版无待决问题。"
      }
    ]
  }
] satisfies SpecificationRecord[];
