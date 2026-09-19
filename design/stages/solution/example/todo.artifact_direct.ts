import type { SolutionArtifact } from "../artifact";

/**
 * 用途：展示 todo Specification 对应的完整 Solution Artifact。
 * 本示例直接承接 specification/example/todo.artifact.ts，不包含后续 Record 引入的标题搜索和空标题防误删变化。
 * 示例省略初始 Solution Record，因此所有 record_refs 均为空。
 */
export const todomvcSolutionArtifact = {
    structure: {
        apps: [
            {
                id: "OAPP-todomvc-web",
                name: "TodoMVC Web",
                type: "web",
                description:
                    "运行在浏览器中的单清单待办应用，负责以响应式 TodoMVC 视觉呈现处理用户交互，并协调清单状态、筛选导航和本地持久化。",
                technologies: [
                    {
                        type: "platform",
                        name: "Web Browser",
                    },
                    {
                        type: "framework",
                        name: "React",
                    }
                ],
                modules: [
                    {
                        id: "OMOD-todo-ui",
                        name: "Todo UI",
                        description:
                            "统一负责 TodoMVC 的响应式页面结构和视觉状态，将用户操作转成明确请求，并根据完整清单、当前筛选与临时交互状态更新界面；不直接维护业务清单或持久化数据。",
                        requirement_refs: [
                            "SREQ-list-display",
                            "SREQ-visual-style",
                            "SREQ-create-todo",
                            "SREQ-edit-todo",
                            "SREQ-toggle-todo",
                            "SREQ-toggle-all",
                            "SREQ-delete-todo",
                            "SREQ-clear-completed",
                            "SREQ-remaining-count",
                            "SREQ-filter-todos",
                            "SREQ-filter-navigation",
                            "SREQ-app-information",
                        ],
                        constraint_refs: [
                            "SCON-todomvc-presentation",
                            "SCON-title-as-text",
                        ],
                        interfaces: [
                            {
                                id: "OMOD-todo-ui-INT-user-interaction",
                                name: "User Interaction",
                                type: "call",
                                description:
                                    "接收新增、编辑、完成、删除、批量操作和筛选导航等用户交互，并呈现包含焦点、悬停、编辑、完成和筛选状态的可观察结果。",
                            },
                        ],
                    },
                    {
                        id: "OMOD-todo-state",
                        name: "Todo State",
                        description:
                            "作为当前页面中完整待办清单的唯一状态权威，维护待办身份、标题、完成状态和顺序，执行清单修改并提供查询结果。",
                        requirement_refs: [
                            "SREQ-create-todo",
                            "SREQ-edit-todo",
                            "SREQ-toggle-todo",
                            "SREQ-toggle-all",
                            "SREQ-delete-todo",
                            "SREQ-clear-completed",
                            "SREQ-remaining-count",
                            "SREQ-filter-todos",
                            "SREQ-persist-todos",
                        ],
                        constraint_refs: ["SCON-title-as-text"],
                        interfaces: [
                            {
                                id: "OMOD-todo-state-INT-command",
                                name: "Todo Commands",
                                type: "call",
                                description:
                                    "执行待办新增、编辑、完成状态切换和删除；成功修改后返回最新完整清单。",
                            },
                            {
                                id: "OMOD-todo-state-INT-query",
                                name: "Todo Query",
                                type: "call",
                                description:
                                    "读取当前完整清单、未完成数量、全选状态和是否存在已完成待办。",
                            },
                        ],
                    },
                    {
                        id: "OMOD-filter-router",
                        name: "Filter Router",
                        description:
                            "维护 All、Active、Completed 三种视图与地址之间的映射，并基于完整清单计算当前可见待办；不修改待办数据。",
                        requirement_refs: ["SREQ-filter-todos", "SREQ-filter-navigation"],
                        interfaces: [
                            {
                                id: "OMOD-filter-router-INT-navigation",
                                name: "Filter Navigation",
                                type: "call",
                                description:
                                    "读取或改变当前筛选，保持地址、选中入口和可见结果一致，并支持浏览器前进、后退和直接访问。",
                            },
                        ],
                    },
                    {
                        id: "OMOD-todo-persistence",
                        name: "Todo Persistence",
                        description:
                            "将已提交的完整待办清单序列化并写入当前浏览器的专属存储键；不保存临时输入、编辑状态或筛选状态。",
                        requirement_refs: ["SREQ-persist-todos"],
                        constraint_refs: ["SCON-local-persistence", "SCON-title-as-text"],
                        interfaces: [
                            {
                                id: "OMOD-todo-persistence-INT-save",
                                name: "Save Todo Snapshot",
                                type: "call",
                                description:
                                    "以一次完整快照保存待办身份、标题、完成状态和顺序，并用实现专属键隔离其他 TodoMVC 实现。",
                            },
                        ],
                    },
                ],
            },
        ],
        packages: [],
        resources: [
            {
                id: "ORES-browser-local-storage",
                name: "Browser Local Storage",
                type: "database",
                description:
                    "浏览器提供的本地键值持久化能力，用于保存当前实现已经提交的完整待办清单。",
                capabilities: [
                    {
                        name: "browser-local durable storage",
                        description: "在当前浏览器范围内持久保存序列化后的清单快照。",
                    },
                    {
                        name: "namespaced key isolation",
                        description:
                            "通过 todos-[framework] 键名区分不同实现，避免相互覆盖。",
                    },
                ],
                requirement_refs: ["SREQ-persist-todos"],
                constraint_refs: ["SCON-local-persistence"],
            },
        ],
        relations: [
            {
                id: "OREL-ui-calls-state",
                source_ref: "OMOD-todo-ui",
                target_ref: "OMOD-todo-state",
                type: "calls",
                description:
                    "Todo UI 通过状态模块的命令和查询能力处理用户操作并取得完整清单状态。",
                requirement_refs: [
                    "SREQ-list-display",
                    "SREQ-create-todo",
                    "SREQ-edit-todo",
                    "SREQ-toggle-todo",
                    "SREQ-toggle-all",
                    "SREQ-delete-todo",
                    "SREQ-clear-completed",
                    "SREQ-remaining-count",
                ],
            },
            {
                id: "OREL-ui-calls-router",
                source_ref: "OMOD-todo-ui",
                target_ref: "OMOD-filter-router",
                type: "calls",
                description:
                    "Todo UI 将筛选选择和浏览器导航交给 Filter Router，并使用其返回的当前筛选更新界面。",
                requirement_refs: ["SREQ-filter-todos", "SREQ-filter-navigation"],
            },
            {
                id: "OREL-router-calls-state",
                source_ref: "OMOD-filter-router",
                target_ref: "OMOD-todo-state",
                type: "calls",
                description:
                    "Filter Router 读取完整清单并派生当前筛选的可见结果，不在自身保存另一份清单。",
                requirement_refs: ["SREQ-filter-todos"],
            },
            {
                id: "OREL-state-calls-persistence",
                source_ref: "OMOD-todo-state",
                target_ref: "OMOD-todo-persistence",
                type: "calls",
                description:
                    "Todo State 在有效修改完成后要求 Persistence 保存最新完整清单；未提交输入不触发保存。",
                requirement_refs: ["SREQ-persist-todos"],
                constraint_refs: ["SCON-local-persistence"],
            },
            {
                id: "OREL-persistence-writes-storage",
                source_ref: "OMOD-todo-persistence",
                target_ref: "ORES-browser-local-storage",
                type: "writes",
                description:
                    "Todo Persistence 将完整清单快照写入当前实现专属的 localStorage 键。",
                requirement_refs: ["SREQ-persist-todos"],
                constraint_refs: ["SCON-local-persistence"],
            },
        ],
    },
    scenarios: [
        {
            id: "OSCN-display-current-list",
            status: "active",
            description:
                "打开应用或清单状态变化后，根据当前完整清单和地址筛选呈现列表、计数、全选和操作入口。",
            requirement_refs: [
                "SREQ-list-display",
                "SREQ-visual-style",
                "SREQ-remaining-count",
                "SREQ-filter-todos",
                "SREQ-filter-navigation",
                "SREQ-app-information",
            ],
            initial_state: "Todo UI 已启动，Todo State 持有当前页面的完整清单。",
            participants: [
                {
                    id: "OPAR-display-actor",
                    type: "actor",
                    name: "User",
                },
                {
                    id: "OPAR-display-ui",
                    ref: "OMOD-todo-ui",
                    type: "module",
                    name: "Todo UI",
                },
                {
                    id: "OPAR-display-state",
                    ref: "OMOD-todo-state",
                    type: "module",
                    name: "Todo State",
                },
                {
                    id: "OPAR-display-router",
                    ref: "OMOD-filter-router",
                    type: "module",
                    name: "Filter Router",
                },
            ],
            steps: [
                {
                    id: "OSCN-display-current-list-STEP-1",
                    source_ref: "OPAR-display-actor",
                    target_ref: "OPAR-display-ui",
                    type: "call",
                    action: "打开应用或完成一次待办操作。",
                },
                {
                    id: "OSCN-display-current-list-STEP-2",
                    source_ref: "OPAR-display-ui",
                    target_ref: "OPAR-display-state",
                    type: "call",
                    action: "读取完整清单及派生统计。",
                },
                {
                    id: "OSCN-display-current-list-STEP-3",
                    source_ref: "OPAR-display-ui",
                    target_ref: "OPAR-display-router",
                    type: "call",
                    action: "读取地址对应的当前筛选并取得可见待办。",
                },
                {
                    id: "OSCN-display-current-list-STEP-4",
                    source_ref: "OPAR-display-ui",
                    type: "activity",
                    action:
                        "按完整清单、当前筛选和临时交互状态派生页面布局、待办行、操作页脚及其视觉状态，并始终呈现新增入口和应用说明。",
                },
            ],
            outcomes: [
                {
                    target_ref: "OPAR-display-actor",
                    type: "response",
                    description:
                        "用户看到与当前完整清单、筛选地址、交互状态和 TodoMVC 视觉要求一致的响应式界面。",
                },
            ],
        },
        {
            id: "OSCN-create-todo",
            status: "active",
            description:
                "用户提交有效标题后创建一条独立的未完成待办，将其加入完整清单并自动保存。",
            requirement_refs: ["SREQ-create-todo", "SREQ-persist-todos"],
            initial_state: "用户已在新增输入框中输入标题。",
            participants: [
                {
                    id: "OPAR-create-actor",
                    type: "actor",
                    name: "User",
                },
                {
                    id: "OPAR-create-ui",
                    ref: "OMOD-todo-ui",
                    type: "module",
                    name: "Todo UI",
                },
                {
                    id: "OPAR-create-state",
                    ref: "OMOD-todo-state",
                    type: "module",
                    name: "Todo State",
                },
                {
                    id: "OPAR-create-persistence",
                    ref: "OMOD-todo-persistence",
                    type: "module",
                    name: "Todo Persistence",
                },
                {
                    id: "OPAR-create-storage",
                    ref: "ORES-browser-local-storage",
                    type: "resource",
                    name: "Browser Local Storage",
                },
            ],
            steps: [
                {
                    id: "OSCN-create-todo-STEP-1",
                    source_ref: "OPAR-create-actor",
                    target_ref: "OPAR-create-ui",
                    type: "call",
                    action: "按 Enter 提交新增标题。",
                },
                {
                    id: "OSCN-create-todo-STEP-2",
                    source_ref: "OPAR-create-ui",
                    target_ref: "OPAR-create-state",
                    type: "call",
                    action: "请求以去除首尾空白后的非空标题创建待办。",
                },
                {
                    id: "OSCN-create-todo-STEP-3",
                    source_ref: "OPAR-create-state",
                    type: "activity",
                    action: "分配独立身份，将未完成待办追加到完整清单末尾。",
                },
                {
                    id: "OSCN-create-todo-STEP-4",
                    source_ref: "OPAR-create-state",
                    target_ref: "OPAR-create-persistence",
                    type: "call",
                    action: "提交最新完整清单快照。",
                },
                {
                    id: "OSCN-create-todo-STEP-5",
                    source_ref: "OPAR-create-persistence",
                    target_ref: "OPAR-create-storage",
                    type: "write",
                    action: "写入当前实现专属的存储键。",
                },
                {
                    id: "OSCN-create-todo-STEP-6",
                    source_ref: "OPAR-create-state",
                    target_ref: "OPAR-create-ui",
                    type: "return",
                    action: "返回最新完整清单并清空新增输入。",
                },
            ],
            outcomes: [
                {
                    target_ref: "OPAR-create-state",
                    type: "state",
                    description:
                        "完整清单末尾新增一条身份独立、标题已整理且状态为未完成的待办。",
                },
                {
                    target_ref: "OPAR-create-storage",
                    type: "state",
                    description: "持久化快照与新增后的完整清单一致。",
                },
            ],
        },
        {
            id: "OSCN-edit-todo",
            status: "active",
            description:
                "用户有效提交标题修改后更新原待办，保持身份、完成状态和位置，并自动保存。",
            requirement_refs: ["SREQ-edit-todo", "SREQ-persist-todos"],
            initial_state: "用户正在编辑一条既有待办，并输入了非空标题。",
            participants: [
                {
                    id: "OPAR-edit-actor",
                    type: "actor",
                    name: "User",
                },
                {
                    id: "OPAR-edit-ui",
                    ref: "OMOD-todo-ui",
                    type: "module",
                    name: "Todo UI",
                },
                {
                    id: "OPAR-edit-state",
                    ref: "OMOD-todo-state",
                    type: "module",
                    name: "Todo State",
                },
                {
                    id: "OPAR-edit-persistence",
                    ref: "OMOD-todo-persistence",
                    type: "module",
                    name: "Todo Persistence",
                },
                {
                    id: "OPAR-edit-storage",
                    ref: "ORES-browser-local-storage",
                    type: "resource",
                    name: "Browser Local Storage",
                },
            ],
            steps: [
                {
                    id: "OSCN-edit-todo-STEP-1",
                    source_ref: "OPAR-edit-actor",
                    target_ref: "OPAR-edit-ui",
                    type: "call",
                    action: "通过 Enter 或失焦提交标题。",
                },
                {
                    id: "OSCN-edit-todo-STEP-2",
                    source_ref: "OPAR-edit-ui",
                    target_ref: "OPAR-edit-state",
                    type: "call",
                    action: "请求更新指定待办的已整理标题。",
                },
                {
                    id: "OSCN-edit-todo-STEP-3",
                    source_ref: "OPAR-edit-state",
                    type: "activity",
                    action: "替换标题，保持待办身份、完成状态和清单位置。",
                },
                {
                    id: "OSCN-edit-todo-STEP-4",
                    source_ref: "OPAR-edit-state",
                    target_ref: "OPAR-edit-persistence",
                    type: "call",
                    action: "提交最新完整清单快照。",
                },
                {
                    id: "OSCN-edit-todo-STEP-5",
                    source_ref: "OPAR-edit-persistence",
                    target_ref: "OPAR-edit-storage",
                    type: "write",
                    action: "覆盖当前实现专属的存储快照。",
                },
            ],
            outcomes: [
                {
                    target_ref: "OPAR-edit-state",
                    type: "state",
                    description:
                        "原待办保留身份、完成状态和顺序，仅标题更新为整理后的非空内容。",
                },
            ],
        },
        {
            id: "OSCN-delete-empty-edit",
            status: "active",
            description:
                "用户通过 Enter 或失焦提交空标题时删除当前待办并保存剩余完整清单。",
            requirement_refs: [
                "SREQ-edit-todo",
                "SREQ-delete-todo",
                "SREQ-persist-todos",
            ],
            initial_state: "用户正在编辑一条待办，标题为空或仅含空白。",
            participants: [
                {
                    id: "OPAR-empty-edit-actor",
                    type: "actor",
                    name: "User",
                },
                {
                    id: "OPAR-empty-edit-ui",
                    ref: "OMOD-todo-ui",
                    type: "module",
                    name: "Todo UI",
                },
                {
                    id: "OPAR-empty-edit-state",
                    ref: "OMOD-todo-state",
                    type: "module",
                    name: "Todo State",
                },
                {
                    id: "OPAR-empty-edit-persistence",
                    ref: "OMOD-todo-persistence",
                    type: "module",
                    name: "Todo Persistence",
                },
                {
                    id: "OPAR-empty-edit-storage",
                    ref: "ORES-browser-local-storage",
                    type: "resource",
                    name: "Browser Local Storage",
                },
            ],
            steps: [
                {
                    id: "OSCN-delete-empty-edit-STEP-1",
                    source_ref: "OPAR-empty-edit-actor",
                    target_ref: "OPAR-empty-edit-ui",
                    type: "call",
                    action: "提交空标题或纯空白标题。",
                },
                {
                    id: "OSCN-delete-empty-edit-STEP-2",
                    source_ref: "OPAR-empty-edit-ui",
                    target_ref: "OPAR-empty-edit-state",
                    type: "call",
                    action: "请求删除正在编辑的待办。",
                },
                {
                    id: "OSCN-delete-empty-edit-STEP-3",
                    source_ref: "OPAR-empty-edit-state",
                    type: "activity",
                    action: "移除目标待办并重新计算清单派生状态。",
                },
                {
                    id: "OSCN-delete-empty-edit-STEP-4",
                    source_ref: "OPAR-empty-edit-state",
                    target_ref: "OPAR-empty-edit-persistence",
                    type: "call",
                    action: "提交删除后的完整清单快照。",
                },
                {
                    id: "OSCN-delete-empty-edit-STEP-5",
                    source_ref: "OPAR-empty-edit-persistence",
                    target_ref: "OPAR-empty-edit-storage",
                    type: "write",
                    action: "覆盖当前实现专属的存储快照。",
                },
            ],
            outcomes: [
                {
                    target_ref: "OPAR-empty-edit-state",
                    type: "state",
                    description:
                        "目标待办从完整清单和持久化快照中移除，其余待办保持不变。",
                },
            ],
        },
        {
            id: "OSCN-change-completion",
            status: "active",
            description:
                "用户切换单条或整份清单的完成状态，并保存所有受影响待办的最新状态。",
            requirement_refs: [
                "SREQ-toggle-todo",
                "SREQ-toggle-all",
                "SREQ-persist-todos",
            ],
            participants: [
                {
                    id: "OPAR-completion-actor",
                    type: "actor",
                    name: "User",
                },
                {
                    id: "OPAR-completion-ui",
                    ref: "OMOD-todo-ui",
                    type: "module",
                    name: "Todo UI",
                },
                {
                    id: "OPAR-completion-state",
                    ref: "OMOD-todo-state",
                    type: "module",
                    name: "Todo State",
                },
                {
                    id: "OPAR-completion-persistence",
                    ref: "OMOD-todo-persistence",
                    type: "module",
                    name: "Todo Persistence",
                },
                {
                    id: "OPAR-completion-storage",
                    ref: "ORES-browser-local-storage",
                    type: "resource",
                    name: "Browser Local Storage",
                },
            ],
            steps: [
                {
                    id: "OSCN-change-completion-STEP-1",
                    source_ref: "OPAR-completion-actor",
                    target_ref: "OPAR-completion-ui",
                    type: "call",
                    action: "切换一条待办或全选控件的完成状态。",
                },
                {
                    id: "OSCN-change-completion-STEP-2",
                    source_ref: "OPAR-completion-ui",
                    target_ref: "OPAR-completion-state",
                    type: "call",
                    action: "请求更新目标范围内的完成状态。",
                },
                {
                    id: "OSCN-change-completion-STEP-3",
                    source_ref: "OPAR-completion-state",
                    type: "activity",
                    action:
                        "更新受影响待办并重新计算未完成数量、全选状态和当前筛选结果。",
                },
                {
                    id: "OSCN-change-completion-STEP-4",
                    source_ref: "OPAR-completion-state",
                    target_ref: "OPAR-completion-persistence",
                    type: "call",
                    action: "提交最新完整清单快照。",
                },
                {
                    id: "OSCN-change-completion-STEP-5",
                    source_ref: "OPAR-completion-persistence",
                    target_ref: "OPAR-completion-storage",
                    type: "write",
                    action: "覆盖当前实现专属的存储快照。",
                },
            ],
            outcomes: [
                {
                    target_ref: "OPAR-completion-state",
                    type: "state",
                    description:
                        "受影响待办的完成状态、清单统计、筛选结果和持久化快照保持一致。",
                },
            ],
        },
        {
            id: "OSCN-remove-todos",
            status: "active",
            description:
                "用户删除指定待办或清除所有已完成待办，保存剩余完整清单并更新界面派生状态。",
            requirement_refs: [
                "SREQ-delete-todo",
                "SREQ-clear-completed",
                "SREQ-persist-todos",
            ],
            participants: [
                {
                    id: "OPAR-remove-actor",
                    type: "actor",
                    name: "User",
                },
                {
                    id: "OPAR-remove-ui",
                    ref: "OMOD-todo-ui",
                    type: "module",
                    name: "Todo UI",
                },
                {
                    id: "OPAR-remove-state",
                    ref: "OMOD-todo-state",
                    type: "module",
                    name: "Todo State",
                },
                {
                    id: "OPAR-remove-persistence",
                    ref: "OMOD-todo-persistence",
                    type: "module",
                    name: "Todo Persistence",
                },
                {
                    id: "OPAR-remove-storage",
                    ref: "ORES-browser-local-storage",
                    type: "resource",
                    name: "Browser Local Storage",
                },
            ],
            steps: [
                {
                    id: "OSCN-remove-todos-STEP-1",
                    source_ref: "OPAR-remove-actor",
                    target_ref: "OPAR-remove-ui",
                    type: "call",
                    action: "选择删除一条待办或清除全部已完成待办。",
                },
                {
                    id: "OSCN-remove-todos-STEP-2",
                    source_ref: "OPAR-remove-ui",
                    target_ref: "OPAR-remove-state",
                    type: "call",
                    action: "请求按指定目标或完成状态删除待办。",
                },
                {
                    id: "OSCN-remove-todos-STEP-3",
                    source_ref: "OPAR-remove-state",
                    type: "activity",
                    action: "移除目标待办并重新计算清单派生状态。",
                },
                {
                    id: "OSCN-remove-todos-STEP-4",
                    source_ref: "OPAR-remove-state",
                    target_ref: "OPAR-remove-persistence",
                    type: "call",
                    action: "提交删除后的完整清单快照。",
                },
                {
                    id: "OSCN-remove-todos-STEP-5",
                    source_ref: "OPAR-remove-persistence",
                    target_ref: "OPAR-remove-storage",
                    type: "write",
                    action: "覆盖当前实现专属的存储快照。",
                },
            ],
            outcomes: [
                {
                    target_ref: "OPAR-remove-state",
                    type: "state",
                    description:
                        "被删除待办不再存在，其余待办的身份、内容、状态和相对顺序保持不变。",
                },
            ],
        },
        {
            id: "OSCN-change-filter",
            status: "active",
            description:
                "用户切换 All、Active、Completed 或使用浏览器导航时，地址、选中入口和可见列表同步变化。",
            requirement_refs: ["SREQ-filter-todos", "SREQ-filter-navigation"],
            participants: [
                {
                    id: "OPAR-filter-actor",
                    type: "actor",
                    name: "User",
                },
                {
                    id: "OPAR-filter-ui",
                    ref: "OMOD-todo-ui",
                    type: "module",
                    name: "Todo UI",
                },
                {
                    id: "OPAR-filter-router",
                    ref: "OMOD-filter-router",
                    type: "module",
                    name: "Filter Router",
                },
                {
                    id: "OPAR-filter-state",
                    ref: "OMOD-todo-state",
                    type: "module",
                    name: "Todo State",
                },
            ],
            steps: [
                {
                    id: "OSCN-change-filter-STEP-1",
                    source_ref: "OPAR-filter-actor",
                    target_ref: "OPAR-filter-ui",
                    type: "call",
                    action: "选择筛选入口、直接访问筛选地址或使用浏览器前进后退。",
                },
                {
                    id: "OSCN-change-filter-STEP-2",
                    source_ref: "OPAR-filter-ui",
                    target_ref: "OPAR-filter-router",
                    type: "call",
                    action: "请求解析或改变当前完成状态筛选。",
                },
                {
                    id: "OSCN-change-filter-STEP-3",
                    source_ref: "OPAR-filter-router",
                    target_ref: "OPAR-filter-state",
                    type: "call",
                    action: "读取完整清单。",
                },
                {
                    id: "OSCN-change-filter-STEP-4",
                    source_ref: "OPAR-filter-router",
                    type: "activity",
                    action: "根据筛选规则派生可见待办，保持完整清单不变。",
                },
                {
                    id: "OSCN-change-filter-STEP-5",
                    source_ref: "OPAR-filter-router",
                    target_ref: "OPAR-filter-ui",
                    type: "return",
                    action: "返回当前筛选和可见待办。",
                },
            ],
            outcomes: [
                {
                    target_ref: "OPAR-filter-actor",
                    type: "response",
                    description:
                        "地址、选中筛选入口和可见列表一致，完整清单及其顺序不受筛选影响。",
                },
            ],
        },
    ],
    concepts: [
        {
            id: "OCON-authoritative-todo-list",
            name: "Authoritative Todo List",
            status: "active",
            definition:
                "Todo State 持有当前页面唯一的完整待办集合；筛选、计数、全选和持久化都从这份集合派生。",
            scope_refs: [
                "OMOD-todo-state",
                "OMOD-filter-router",
                "OMOD-todo-persistence",
                "OSCN-display-current-list",
                "OSCN-change-filter",
            ],
            requirement_refs: [
                "SREQ-list-display",
                "SREQ-toggle-all",
                "SREQ-clear-completed",
                "SREQ-remaining-count",
                "SREQ-filter-todos",
                "SREQ-persist-todos",
            ],
            rules: [
                {
                    id: "OCON-authoritative-todo-list-RULE-1",
                    description: "筛选只产生可见集合，不复制或修改完整待办集合。",
                },
                {
                    id: "OCON-authoritative-todo-list-RULE-2",
                    description:
                        "计数、全选、清除已完成和持久化始终作用于完整清单，包括当前不可见的待办。",
                },
                {
                    id: "OCON-authoritative-todo-list-RULE-3",
                    description:
                        "待办标题或完成状态变化不改变其身份和清单位置；只有新增按末尾追加，删除才移除身份。",
                },
            ],
            record_refs: [],
        },
        {
            id: "OCON-committed-todo-data",
            name: "Committed Todo Data",
            status: "active",
            definition:
                "只有完成有效提交的待办数据才进入权威清单和持久化快照，输入过程和界面交互状态不属于已提交数据。",
            scope_refs: ["OMOD-todo-ui", "OMOD-todo-state", "OMOD-todo-persistence"],
            requirement_refs: [
                "SREQ-create-todo",
                "SREQ-edit-todo",
                "SREQ-persist-todos",
            ],
            rules: [
                {
                    id: "OCON-committed-todo-data-RULE-1",
                    description: "新增输入未按 Enter 时不创建待办，也不进入持久化快照。",
                },
                {
                    id: "OCON-committed-todo-data-RULE-2",
                    description:
                        "编辑中的临时标题和编辑状态不写入持久化快照；Escape 恢复原已提交标题。",
                },
                {
                    id: "OCON-committed-todo-data-RULE-3",
                    description:
                        "有效修改成功后，以最新完整清单覆盖保存快照；空清单也是有效快照。",
                },
            ],
            record_refs: [],
        },
        {
            id: "OCON-title-text",
            name: "Todo Title as Text",
            status: "active",
            definition:
                "待办标题是用户提供的普通文字，在新增、编辑、展示和保存过程中保持同一文本语义。",
            scope_refs: ["OMOD-todo-ui", "OMOD-todo-state", "OMOD-todo-persistence"],
            requirement_refs: ["SREQ-create-todo", "SREQ-edit-todo"],
            constraint_refs: ["SCON-title-as-text"],
            rules: [
                {
                    id: "OCON-title-text-RULE-1",
                    description: "提交时只去除标题首尾空白，保留中间空格和其他文字内容。",
                },
                {
                    id: "OCON-title-text-RULE-2",
                    description:
                        "标题始终按文字显示和保存，不解释为 HTML、命令或可执行内容。",
                },
            ],
            record_refs: [],
        },
        {
            id: "OCON-todo-lifecycle",
            name: "Todo Lifecycle",
            status: "active",
            definition:
                "一条待办从创建开始在未完成和已完成之间切换，直到被明确删除或因空标题提交而删除。",
            scope_refs: ["OMOD-todo-state"],
            requirement_refs: [
                "SREQ-create-todo",
                "SREQ-edit-todo",
                "SREQ-toggle-todo",
                "SREQ-toggle-all",
                "SREQ-delete-todo",
                "SREQ-clear-completed",
            ],
            rules: [
                {
                    id: "OCON-todo-lifecycle-RULE-1",
                    description: "新待办初始为未完成。",
                },
                {
                    id: "OCON-todo-lifecycle-RULE-2",
                    description: "完成和重新打开只改变完成状态，不改变标题、身份或位置。",
                },
                {
                    id: "OCON-todo-lifecycle-RULE-3",
                    description:
                        "删除后的待办从完整清单及持久化快照中移除，不再参与筛选和统计。",
                },
            ],
            record_refs: [],
        },
        {
            id: "OCON-state-derived-presentation",
            name: "State-derived Presentation",
            status: "active",
            definition:
                "Todo UI 从完整清单、当前筛选及焦点、悬停、编辑等临时交互状态派生页面外观；视觉状态不成为业务清单或持久化数据。",
            scope_refs: ["OMOD-todo-ui", "OSCN-display-current-list"],
            requirement_refs: [
                "SREQ-list-display",
                "SREQ-visual-style",
                "SREQ-edit-todo",
                "SREQ-toggle-todo",
                "SREQ-delete-todo",
                "SREQ-filter-todos",
                "SREQ-app-information",
            ],
            constraint_refs: ["SCON-todomvc-presentation"],
            rules: [
                {
                    id: "OCON-state-derived-presentation-RULE-1",
                    description:
                        "页面始终使用同一单列结构组织标题、新增入口、清单和操作页脚；窄屏只调整可用宽度和内容换行，不改变区域顺序或产生横向滚动。",
                },
                {
                    id: "OCON-state-derived-presentation-RULE-2",
                    description:
                        "待办行的未完成、已完成、悬停和编辑外观由当前状态派生；状态切换不改变待办身份和顺序，也不因控件显示或隐藏移动主要内容。",
                },
                {
                    id: "OCON-state-derived-presentation-RULE-3",
                    description:
                        "操作页脚根据完整清单、当前筛选和已完成待办是否存在派生内容与选中状态；条件控件变化时保持计数、筛选和操作区域的视觉位置稳定。",
                },
                {
                    id: "OCON-state-derived-presentation-RULE-4",
                    description:
                        "标题、输入、待办状态、焦点、分隔、筛选选中和辅助信息使用统一的视觉层级；具体实现不得以另一套局部样式改变这些状态的含义。",
                },
            ],
            record_refs: [],
        },
    ],
    decisions: [
        {
            id: "ODEC-single-browser-app",
            name: "Single Browser Application",
            status: "active",
            decision:
                "将 TodoMVC 设计为单个浏览器 Web App，由应用内 Module 分担界面、清单状态、筛选导航和持久化职责。",
            reason:
                "当前需求面向单用户浏览器内的一份清单，不需要独立服务、跨设备同步或后台处理；单应用边界可以保持协作直接且职责清晰。",
            scope_refs: ["OAPP-todomvc-web"],
            requirement_refs: [
                "SREQ-list-display",
                "SREQ-visual-style",
                "SREQ-create-todo",
                "SREQ-edit-todo",
                "SREQ-toggle-todo",
                "SREQ-toggle-all",
                "SREQ-delete-todo",
                "SREQ-clear-completed",
                "SREQ-remaining-count",
                "SREQ-filter-todos",
                "SREQ-filter-navigation",
                "SREQ-persist-todos",
                "SREQ-app-information",
            ],
            record_refs: [],
        },
        {
            id: "ODEC-unified-responsive-presentation",
            name: "Unified Responsive Presentation",
            status: "active",
            decision:
                "由 Todo UI 使用一套响应式页面结构和状态驱动的视觉规则呈现所有筛选及交互状态，不为 All、Active、Completed 或待办状态维护相互独立的界面结构。",
            reason:
                "Specification 要求不同状态保持统一的 TodoMVC 视觉层级、控件位置和窄屏可用性；统一派生可以避免筛选或交互变化造成样式分叉和布局跳动。",
            scope_refs: [
                "OMOD-todo-ui",
                "OSCN-display-current-list",
                "OCON-state-derived-presentation",
            ],
            requirement_refs: ["SREQ-visual-style", "SREQ-list-display"],
            constraint_refs: ["SCON-todomvc-presentation"],
            record_refs: [],
        },
        {
            id: "ODEC-derived-filter-view",
            name: "Derived Filter View",
            status: "active",
            decision:
                "All、Active、Completed 视图从 Todo State 的完整清单即时派生，不分别维护可修改的数据副本。",
            reason:
                "所有视图共同操作同一份清单，且计数、全选、清除已完成和保存必须覆盖被筛选隐藏的待办。",
            scope_refs: [
                "OMOD-todo-state",
                "OMOD-filter-router",
                "OSCN-change-filter",
            ],
            requirement_refs: [
                "SREQ-filter-todos",
                "SREQ-remaining-count",
                "SREQ-toggle-all",
                "SREQ-clear-completed",
            ],
            record_refs: [],
        },
        {
            id: "ODEC-hash-filter-routing",
            name: "Hash Filter Routing",
            status: "active",
            decision:
                "使用统一的 Hash 路由形式表达 All、Active、Completed，并让浏览器历史只记录筛选选择。",
            reason:
                "需求明确使用 #/、#/active、#/completed 或等价的 #!/ 形式，并要求直接访问及前进后退保持一致。",
            scope_refs: ["OMOD-filter-router", "OSCN-change-filter"],
            requirement_refs: ["SREQ-filter-navigation", "SREQ-filter-todos"],
            record_refs: [],
        },
        {
            id: "ODEC-local-snapshot-persistence",
            name: "Local Snapshot Persistence",
            status: "active",
            decision:
                "每次有效清单修改后，将包含身份、标题、完成状态和顺序的完整清单快照写入 todos-[framework] 对应的 localStorage 键。",
            reason:
                "完整快照直接覆盖筛选隐藏的数据和删除结果，并满足不同实现之间的存储隔离要求。",
            scope_refs: [
                "OMOD-todo-state",
                "OMOD-todo-persistence",
                "ORES-browser-local-storage",
            ],
            requirement_refs: ["SREQ-persist-todos"],
            constraint_refs: ["SCON-local-persistence"],
            record_refs: [],
        },
    ],
    risks: [
        {
            id: "ORISK-local-storage-unavailable",
            name: "Local Storage Unavailable",
            status: "active",
            description:
                "浏览器可能因隐私模式、容量限制或安全策略拒绝 localStorage 写入。",
            impact:
                "清单在当前页面中已经变化，但对应持久化快照未能同步，导致持久化要求无法成立。",
            mitigation:
                "通过独立 Persistence Module 隔离存储失败并返回明确结果，使实现能够阻止无声失败并保留可诊断信息；具体用户交互由 Implementation 确定。",
            scope_refs: [
                "OMOD-todo-state",
                "OMOD-todo-persistence",
                "ORES-browser-local-storage",
            ],
            requirement_refs: ["SREQ-persist-todos"],
            constraint_refs: ["SCON-local-persistence"],
            record_refs: [],
        },
    ],
    diagrams: [
        {
            id: "ODIAG-todomvc-overview",
            name: "TodoMVC Overview",
            status: "active",
            type: "overview",
            description: "展示浏览器用户、TodoMVC Web App 与本地存储之间的总体边界。",
            refs: [
                "OAPP-todomvc-web",
                "OMOD-todo-ui",
                "OMOD-todo-state",
                "OMOD-filter-router",
                "OMOD-todo-persistence",
                "ORES-browser-local-storage",
                "OREL-ui-calls-state",
                "OREL-ui-calls-router",
                "OREL-router-calls-state",
                "OREL-state-calls-persistence",
                "OREL-persistence-writes-storage",
            ],
            d2_code: `direction: right

user: User {shape: person}
app: TodoMVC Web {
  ui: Todo UI
  state: Todo State
  router: Filter Router
  persistence: Todo Persistence

  ui -> state: commands and queries
  ui -> router: filter navigation
  router -> state: read full list
  state -> persistence: save snapshot
}
storage: Browser Local Storage {shape: cylinder}

user -> app.ui: interact
app.persistence -> storage: write namespaced snapshot`,
            record_refs: [],
        },
        {
            id: "ODIAG-todomvc-components",
            name: "TodoMVC Components",
            status: "active",
            type: "component",
            description:
                "展示 TodoMVC Web 内部 Module 的职责关系以及唯一的持久化资源。",
            refs: [
                "OAPP-todomvc-web",
                "OMOD-todo-ui",
                "OMOD-todo-state",
                "OMOD-filter-router",
                "OMOD-todo-persistence",
                "ORES-browser-local-storage",
                "OREL-ui-calls-state",
                "OREL-ui-calls-router",
                "OREL-router-calls-state",
                "OREL-state-calls-persistence",
                "OREL-persistence-writes-storage",
                "OCON-authoritative-todo-list",
                "OCON-state-derived-presentation",
                "ODEC-unified-responsive-presentation",
            ],
            d2_code: `direction: right

ui: Todo UI {
  label: Todo UI\nResponsive Presentation
}
state: Todo State {
  label: Todo State\nAuthoritative List
}
router: Filter Router
persistence: Todo Persistence
storage: Browser Local Storage {shape: cylinder}

ui -> state: commands and queries
ui -> router: navigation
router -> state: derive visible list
state -> persistence: committed snapshot
persistence -> storage: "write todos-[framework]"`,
            record_refs: [],
        },
        {
            id: "ODIAG-create-todo-scenario",
            name: "Create Todo Scenario",
            status: "active",
            type: "scenario",
            description: "展示创建有效待办、更新权威清单并保存完整快照的协作顺序。",
            refs: [
                "OSCN-create-todo",
                "OMOD-todo-ui",
                "OMOD-todo-state",
                "OMOD-todo-persistence",
                "ORES-browser-local-storage",
            ],
            d2_code: `shape: sequence_diagram

user: User
ui: Todo UI
state: Todo State
persistence: Todo Persistence
storage: Browser Local Storage

user -> ui: submit title
ui -> state: create todo
state -> state: append pending todo
state -> persistence: save full snapshot
persistence -> storage: "write todos-[framework]"
state -> ui: return current list`,
            record_refs: [],
        },
        {
            id: "ODIAG-todo-lifecycle",
            name: "Todo Lifecycle",
            status: "active",
            type: "state",
            description: "展示单条待办从创建到完成状态切换及删除的生命周期。",
            refs: ["OCON-todo-lifecycle", "OMOD-todo-state"],
            d2_code: `direction: right

created: Created
pending: Pending
completed: Completed
removed: Removed {shape: oval}

created -> pending: create
pending -> completed: complete
completed -> pending: reopen
pending -> removed: delete or empty-title submit
completed -> removed: delete or clear completed`,
            record_refs: [],
        },
    ],
} satisfies SolutionArtifact;
