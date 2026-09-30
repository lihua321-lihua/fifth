# **SPEC.md — 小步辅导 StepTutor**

## **1. 项目定位**

**一句话**：初中英语 AI 作业辅导 + 错题本。学生拍照/上传题目 → DeepSeek 读图识别 → 识别文本可编辑 → AI 分层引导辅导 → 保存错题 → 自动汇总薄弱知识点。

**支持范围**：仅初中英语完形填空、阅读理解选择题。

**不支持**：小学/高中英语、作文、听力、语法填空、数学物理公式题。

**产品形态**：移动端优先的 Web App，每页底部固定 AgentDock AI 对话框。

**暂定名**：StepMath（后续可调整，不影响开发）。

***

## **2. 技术栈**

**层**

**选型**

前端

Next.js App Router + TypeScript + Tailwind + shadcn/ui

后端

Next.js API Routes（服务端调用 DeepSeek）

数据库

Supabase PostgreSQL

认证

Supabase Auth

文件存储

Supabase Storage（私有 bucket）

AI 读图

DeepSeek V4 Flash Vision

AI 辅导

DeepSeek + LangGraph 状态图编排

语音

Web Speech API（SpeechRecognition + SpeechSynthesis）

部署

Vercel + Supabase 云服务

**环境变量**：

text

```
# 客户端可暴露（NEXT_PUBLIC_ 前缀）
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

# 仅服务端私密，禁止加到前端
SUPABASE_SERVICE_ROLE_KEY
DEEPSEEK_API_KEY
```

**API 鉴权**：所有服务端 API Route（`/api/vision-analyze`、`/api/tutor`、`/api/agent`、`/api/weakness-analysis`）必须在开头解析 Supabase Auth JWT，获取 `user_id`，校验登录态。未登录返回 401，不执行任何操作。

***

## **3. 用户流程**

text

```
登录 → 上传/拍照 → DeepSeek 读图 → 识别文本可编辑 → 确认
  → AI 分层辅导（LangGraph）→ 总结方法 → 保存错题
  → 错题本 → 薄弱知识点分析 → 复习建议
```

***

## **4. 页面与路由**

**路由**

**页面**

**核心功能**

`/login`

登录页

邮箱密码登录、注册、一键 Demo

`/upload`

上传识别页

拍照/上传、DeepSeek 读图、可编辑文本

`/tutor/[sessionId]`

辅导页

LangGraph 分层辅导、提示级别、语音

`/mistakes`

错题本列表

状态筛选、卡片列表

`/mistakes/[id]`

错题详情

图片、文本、知识点、卡点、总结、改状态、重新辅导

`/weakness`

薄弱知识点

知识点卡片、依据、建议、相关错题

`/profile`

我的

邮箱、登出

**底部 Tab**：上传、错题本、薄弱点、我的。

**每页底部固定 AgentDock**。移动端 AgentDock 固定在底部 Tab 上方；Tab 页面收起态一行，可展开为半屏。

***

## **5. 页面详细设计**

### **5.1 `/login`**

- 标题：小步辅导
- 副标题：初中英语 AI 作业辅导
- 邮箱输入框、密码输入框
- 登录按钮、注册按钮
- 一键体验 Demo 按钮（使用 Supabase 匿名登录，见第 13 节）
- 支持边界说明：当前仅支持初中英语完形填空、阅读理解选择题
- 底部 AgentDock：可回答“怎么用”“支持什么题型”

### **5.2 `/upload`**

- 图片预览区（上传前占位，上传后显示原图）
- 按钮：拍照、从相册选择、使用示例题
- 拍照：`<input type="file" accept="image/*" capture="environment">`
- 上传：`<input type="file" accept="image/*">`
- 识别状态：加载中 / 成功 / 失败 / 信息不足
- 可编辑文本域：填入 `ocr_text`，用户可修改
- 缺失信息提示：黄色卡片，列出 `missing_info`
- 多题情况：MVP 视觉只返回单个 `ocr_text`。若检测到多题，返回 `needs_more_info=true`，`missing_info` 提示“检测到多道题，请重新上传单道题或手动编辑”。不提供多题选择。
- 确认按钮：创建 question + tutoring\_session，跳 `/tutor/[sessionId]`
- 用户点击确认时，重新校验 `is_in_scope`；若超出范围，提示不支持并阻止进入辅导。

**图片上传与 question\_id 顺序**：

- 上传时生成临时 UUID 作为 Storage 路径：`{user_id}/{temp_uuid}/original.jpg`
- 用户确认后创建 question 记录，并将 Storage 路径更新为 `{user_id}/{question_id}/original.jpg`
- 或先创建 question 草稿再上传。MVP 推荐前者。

**图片压缩**：前端压缩到最大边 1024px，JPEG 质量 0.7，控制 Base64 体积在 2MB 以内。

### **5.3 `/tutor/[sessionId]`**

- 顶部题目卡片：可折叠，显示题型、知识点、原文
- 对话区：气泡消息，AI 左、学生右
- 提示级别按钮组：小提示 / 分析思路 / 分步讲解 / 查看答案
- 输入框 + 麦克风 + 喇叭 + 发送
- 每条 AI 消息旁有小喇叭图标，点击播放语音
- **保存错题触发逻辑**：学生答错或卡住时，显示“保存到错题本”按钮；学生答对后，可选择性保存为复习题。不要求“已掌握”才保存。
- 查看答案后，同样展示总结卡片 + “保存到错题本”按钮，保证流程闭环。
- 底部 AgentDock：可执行保存错题、改状态、跳转

### **5.4 `/mistakes`**

- 状态筛选 Tab：全部 / 未掌握 / 学习中 / 待复习 / 已掌握
- 错题卡片：缩略图、题型、知识点、状态标签、卡点原因
- 空状态：提示“还没有错题，去上传一道吧”
- 点击卡片 → `/mistakes/[id]`

### **5.5 `/mistakes/[id]`**

- 题目图片（展示时服务端生成 signed URL）
- 题目文字
- 知识点标签
- 卡点原因
- 辅导总结
- 状态下拉：未掌握 / 学习中 / 待复习 / 已掌握
- 重新辅导按钮：新建 tutoring\_session，关联同一 question
- 底部 AgentDock：可改状态、改知识点

### **5.6 `/weakness`**

- 知识点卡片列表
- 每张卡片：知识点名称、考查次数、判断依据、复习建议、查看相关错题
- 重新分析按钮
- 底部 AgentDock：可生成复习计划

### **5.7 `/profile`**

- 显示当前邮箱
- 登出按钮
- 简单使用说明与已知限制入口

***

## **6. 数据库设计**

### **6.1 表结构**

**通用规则**：

- 所有 `id` 和 `user_id` 均为 `uuid` 类型。
- `user_id` 引用 `auth.users(id)`。
- `created_at` 默认 `now()`。
- 状态字段加 check 约束。

**profiles**

- id (uuid, primary key, references auth.users)
- nickname (text)
- grade (text, default '初中')
- created\_at (timestamptz default now())

**questions**

- id (uuid, primary key)
- user\_id (uuid, references auth.users)
- original\_image\_url (text)
- cropped\_image\_url (text, 预留，MVP 可空)
- ocr\_text (text)
- edited\_text (text)
- subject (text)
- question\_type (text)
- grade\_level (text)
- is\_in\_scope (boolean)
- knowledge\_points (text\[])
- selected\_question\_index (int, 预留，MVP 可空)
- created\_at (timestamptz default now())

**tutoring\_sessions**

- id (uuid, primary key)
- user\_id (uuid, references auth.users)
- question\_id (uuid, references questions)
- status (text, check in ('进行中','已完成'))
- current\_hint\_level (text, check in ('none','small\_hint','analysis','step\_by\_step','answer'))
- stuck\_reason (text)
- summary (text)
- created\_at (timestamptz default now())
- updated\_at (timestamptz default now())

**messages**

- id (uuid, primary key)
- session\_id (uuid, references tutoring\_sessions)
- user\_id (uuid, references auth.users)
- role (text, check in ('user','ai'))
- content (text)
- hint\_level (text, check in ('none','small\_hint','analysis','step\_by\_step','answer'))
- created\_at (timestamptz default now())

**mistakes**

- id (uuid, primary key)
- user\_id (uuid, references auth.users)
- question\_id (uuid, references questions)
- session\_id (uuid, references tutoring\_sessions)
- image\_url (text)
- text (text)
- knowledge\_points (text\[])
- stuck\_reason (text)
- tutoring\_summary (text)
- status (text, check in ('未掌握','学习中','待复习','已掌握'), default '未掌握')
- created\_at (timestamptz default now())
- updated\_at (timestamptz default now())

**weakness\_analysis**

- id (uuid, primary key)
- user\_id (uuid, references auth.users)
- knowledge\_point (text)
- count (int)
- evidence\_mistake\_ids (uuid\[])
- suggestion (text)
- updated\_at (timestamptz default now())
- unique (user\_id, knowledge\_point)

**ai\_usage**

- id (uuid, primary key)
- user\_id (uuid, references auth.users)
- model (text)
- endpoint (text)
- prompt\_tokens (int)
- completion\_tokens (int)
- image\_tokens (int)
- estimated\_cost (numeric, 标注为估算值)
- created\_at (timestamptz default now())

### **6.2 RLS**

所有业务表启用 RLS，策略统一：`auth.uid() = user_id`。

profiles 用 `auth.uid() = id`。

### **6.3 Storage**

- 私有 bucket：`question-images`
- 路径：`{user_id}/{question_id}/original.jpg`
- 上传时可用临时 UUID，确认后更新路径。
- Policy（修正索引为 `[0]`）：

sql

```
create policy "own images insert" on storage.objects for insert
with check (bucket_id = 'question-images' and auth.uid()::text = (storage.foldername(name))[0]);

create policy "own images select" on storage.objects for select
using (bucket_id = 'question-images' and auth.uid()::text = (storage.foldername(name))[0]);
```

- DB 中存 path，不存 signed URL。
- 展示图片时，服务端生成 signed URL 返回前端。

***

## **7. DeepSeek 读图**

### **7.1 调用方式**

前端压缩图片到最大边 1024px，JPEG 质量 0.7，转 Base64，POST 到 `/api/vision-analyze`。服务端调用 DeepSeek V4 Flash Vision。API Route 需校验 JWT。

### **7.2 返回 JSON**

json

```
{
  "is_readable": true,
  "confidence": 0.92,
  "ocr_text": "识别出的题目文字",
  "needs_more_info": false,
  "missing_info": [],
  "is_in_scope": true,
  "scope_reason": "初中英语完形填空，在支持范围内",
  "subject": "英语",
  "question_type": "完形填空",
  "grade_level": "初中",
  "knowledge_points": ["动词时态", "词义辨析"],
  "brief_analysis": "这道题主要考查上下文逻辑和动词时态。"
}
```

**MVP 只返回单个 **`ocr_text`。若图片包含多道题，返回 `needs_more_info=true`，`missing_info` 中说明“检测到多道题，请重新上传单道题或手动编辑”。不做 questions 数组。

### **7.3 Prompt 规则**

text

```
你是视觉识别模块，只支持初中英语完形填空和阅读理解选择题。
读取图片，提取题目文字，并自评识别质量。
如果图片模糊、文字太小、题目被截断、选项缺失，必须：
- is_readable = false 或 confidence < 0.6
- needs_more_info = true
- 在 missing_info 中列出具体缺什么
如果检测到多道题，也返回 needs_more_info = true，并说明请上传单道题。
禁止猜测或编造任何题目内容。看不清的部分不要补全，只说明缺失。
只返回 JSON。
```

### **7.4 前端处理**

- `is_readable=false` 或 `confidence<0.6` 或 `ocr_text` 为空 → 提示“图片模糊或信息不足，请重拍或手动输入”，不进入辅导
- `needs_more_info=true` → 展示缺失项，要求补充
- `is_in_scope=false` → 提示“当前仅支持初中英语完形填空和阅读理解选择题”
- 正常 → 填入可编辑文本框
- 用户点击“确认并开始辅导”时，再次校验 `is_in_scope`；若超出范围，阻止进入辅导。

### **7.5 异常处理**

- API 失败/超时 → 提示重试或手动输入
- 额度耗尽 → 提示稍后重试
- **JSON 解析容错**：解析前用正则去除 markdown 代码块标记（`json ...`），提取纯 JSON 字符串。解析失败则要求重试。

***

## **8. AI 辅导（LangGraph）**

### **8.1 TutorState**

ts

```
type TutorState = {
  questionText: string;
  questionType: "完形填空" | "阅读理解选择题";
  knowledgePoints: string[];
  studentAnswer: string | null;
  conversationHistory: { role: "user" | "ai"; content: string }[];
  currentHintLevel: "none" | "small_hint" | "analysis" | "step_by_step" | "answer";
  stuckReason: string | null;
  isCorrect: boolean | null;
  attemptCount: number;
  maxAttempts: number; // 5，总尝试上限
  consecutiveWrong: number; // 连续答错次数
  finalSummary: string | null;
};
```

**规则**：总尝试上限 5 次；连续答错 3 次解锁“查看答案”按钮。

### **8.2 节点**

- `analyze_question`：复用读图阶段的知识点和题型
- `diagnose_stuck`：根据学生回答判断卡点（词汇不足、逻辑混乱、未定位原文、粗心）
- `generate_hint`：按 `currentHintLevel` 生成提示
- `evaluate_answer`：从学生自然语言中提取答案（如“我选 A”“应该是 B 吧”），并评估对错，更新 `isCorrect`、`attemptCount`、`consecutiveWrong`
- `adjust_hint_level`：答对 → 准备总结；部分对 → 保持或微调；错 → 提升一级
- `summarize`：总结方法、知识点、易错点

### **8.3 提示级别**

**级别**

**输出**

小提示

只给方向，如“注意第二段 but 后的内容”

分析思路

拆解题目逻辑，不给答案

分步讲解

分步引导，每步留问题让学生回答

查看答案

仅当学生主动点击或连续错 3 次后提供

### **8.4 条件路由**

- 学生发回答 → `evaluate_answer` → 正确或 `attemptCount >= maxAttempts` → `summarize`
- 否则 → `adjust_hint_level` → `generate_hint`
- 学生点提示按钮 → `set_mode` → `generate_hint`
- **查看答案后**：同样触发 `summarize`，并展示保存错题按钮，保证流程闭环。
- 学生直接查看答案时，卡点原因标注为“未尝试直接查看答案”。

### **8.5 总结格式**

text

```
本题考查：动词时态、词义辨析。
解题步骤：1. 定位时间状语；2. 判断时态；3. 排除选项。
易错点：忽略上下文时间线。
复习建议：复习一般过去时与现在完成时区别。
```

### **8.6 状态持久化**

**每次 **`/api/tutor`** 请求都从 Supabase 读取 **`messages`**、**`tutoring_sessions`**，重建 **`TutorState`**，执行 LangGraph 后写回。** MemorySaver 仅作为单次请求内缓存，不能跨请求持久化。Vercel Serverless 无状态，禁止依赖内存状态。

***

## **9. AgentDock**

### **9.1 定位**

每页底部固定 AI 对话框，既能聊天，又能通过结构化 actions 修改当前页面。

### **9.2 页面上下文**

前端每次请求 `/api/agent` 时传：

json

```
{
  "route": "/mistakes",
  "page": "错题本",
  "formValues": {},
  "selectedQuestion": null,
  "selectedMistake": { "id": "xxx", "status": "未掌握" },
  "filters": { "status": "全部" },
  "sessionState": null,
  "messages": [{ "role": "user", "content": "把这道题改成待复习" }]
}
```

### **9.3 返回格式**

json

```
{
  "reply": "已把这道题标记为待复习。",
  "actions": [
    { "type": "update_status", "payload": { "mistakeId": "xxx", "status": "待复习" } }
  ]
}
```

### **9.4 支持的 actions**

**type**

**payload**

**作用**

`set_form`

`{ target, value }`

设置当前页表单字段

`navigate`

`{ path }`

跳转页面

`set_mode`

`{ mode }`

辅导模式

`save_mistake`

`{ questionId, sessionId }`

保存到错题本

`update_status`

`{ mistakeId, status }`

改错题状态

`run_weakness_analysis`

`{}`

触发薄弱知识点分析

`set_filter`

`{ status }`

错题本筛选

**注意**：MVP 阶段 action 由前端执行，依赖 RLS 保护数据隔离。执行失败时显示错误提示，不做额外服务端校验层。

### **9.5 交互**

- 收起态：一行输入框 + 麦克风 + 发送
- 展开态：半屏对话框 + 聊天历史 + 快捷指令
- 每个页面把 `pageContext` 传给 AgentDock 组件
- 移动端 AgentDock 固定在底部 Tab 上方

### **9.6 与 LangGraph 的关系**

- 辅导页 AgentDock 走 `/api/tutor`，由 LangGraph 处理
- 其他页 AgentDock 走 `/api/agent`，用普通 DeepSeek JSON 输出

***

## **10. 语音能力**

### **10.1 实现**

用 Web Speech API，不做打电话模式。

**语音输入**：`SpeechRecognition`，学生点麦克风说话，识别文字填入输入框，可修改后发送。

**语音播放**：`SpeechSynthesis`，每条 AI 消息旁有喇叭图标，点击播放。

### **10.2 兼容性**

**浏览器**

**识别**

**合成**

Chrome

✅

✅

Edge

✅

✅

Safari

⚠️ 部分

✅

Firefox

❌

✅

### **10.3 异常**

- 不支持 → 隐藏对应按钮，提示用 Chrome 或 Edge
- 麦克风权限被拒绝 → 提示，文字输入照常
- 合成不可用 → 隐藏喇叭图标

***

## **11. 错题本与薄弱知识点**

### **11.1 保存错题**

- 触发时机：学生答错或卡住时显示保存按钮；答对后可选择性保存。
- `image_url`：MVP 用原图 path
- `text`：编辑后的题目文本
- `knowledge_points`：来自识别 JSON 或本次辅导分析
- `stuck_reason`：来自 LangGraph `stuckReason`，若空则 AI 生成
- `tutoring_summary`：来自 `summarize`
- `status`：默认“未掌握”

### **11.2 状态流转**

- 保存时 → 未掌握
- 完成一次引导后，用户手动或通过 AgentDock 改为“学习中”
- 用户或 AI 改为待复习
- 用户确认已掌握 → 已掌握
- MVP 不做自动流转，用户手动改

### **11.3 薄弱知识点汇总**

- 按 `knowledge_point` 分组统计 `status != 已掌握` 的错题
- 展示：知识点、考查次数、相关错题列表、判断依据、复习建议
- 文案用“考查次数”，并标注“一道题可能涉及多个知识点”
- 判断依据示例：“近 5 道错题中 3 道涉及该知识点”
- 复习建议由 AI 生成，基于相关错题文本
- 保存错题后自动触发 `/api/weakness-analysis`，按 `user_id + knowledge_point` 做 upsert，覆盖旧记录，避免重复和膨胀

***

## **12. 异常处理清单**

**异常**

**处理**

图片模糊/信息不足

提示重拍或手动输入，不进入辅导

多题图片

提示重新上传单道题或手动编辑

AI 请求失败/超时

提示“AI 服务暂时不可用，请重试或手动输入”

JSON 解析失败

正则去 markdown 包裹，仍失败则要求重试

语音不可用

隐藏麦克风/喇叭按钮，文字照常

数据库写入失败

提示保存失败，可重试

LangGraph 状态异常

从 DB 重建 TutorState，失败则重置会话

API 鉴权失败

返回 401，前端跳转登录

额度耗尽

提示稍后重试

***

## **13. 测试账号与示例题**

**Demo 方式**：点击“一键体验 Demo”时，使用 Supabase 匿名登录，为每个访客创建独立匿名用户，避免数据串号。不硬编码 `demo@stepmath.com` 密码。

**预置两道题**（绑定到示例数据或通过“使用示例题”按钮加载）：

1. 完形填空：一篇短文，5 个空，选项 A-D。知识点：动词时态、词义辨析。
2. 阅读理解选择题：一篇短文，3 道题，每题 4 选项。知识点：细节理解、主旨大意。

上传页提供“使用示例题”按钮。

***

## **14. 网页内标注**

**已实现**：登录、上传拍照、DeepSeek 读图识别、文本可编辑、AI 辅导、语音输入/播放、错题本、薄弱知识点、AgentDock。

**Mock**：AI 使用次数/成本展示为估算值；题目图片预置为文本渲染；无真实 OCR 降级。

**已知限制**：仅支持初中英语完形填空和阅读理解选择题；手写体、模糊、倾斜图片可能识别不准；多题裁剪未实现；相似题生成未实现；家长/教师摘要未实现；RAG 未实现。

***

## **15. MVP 不做**

- 多题裁剪
- 相似题生成
- 家长/教师摘要
- RAG 知识库
- 百度 OCR 降级
- 实时语音通话
- PostgresSaver
- 向量数据库、Redis、MongoDB
- 服务端 action 二次校验层
- 未成年人隐私合规完整方案（仅加提示）

***

## **16. 部署**

- Next.js 部署 Vercel
- Supabase 云服务
- DeepSeek API Key 放服务端环境变量
- Storage bucket：`question-images`
- 所有 API Route 校验 Supabase JWT

***

## **17. 分阶段开发建议**

1. 项目骨架 + Supabase + 登录（含匿名 Demo）
2. `/upload` + DeepSeek 读图 + 图片压缩 + 临时 UUID
3. `/tutor/[sessionId]` + LangGraph + 从 DB 重建状态
4. `/mistakes` + `/weakness` + `/profile`
5. AgentDock + 语音
6. 异常处理 + 部署 + 标注

每阶段验收后再进入下一阶段。

***

## **18. 前端设计原则**

- 移动端优先，单列布局
- 每页底部固定 AgentDock，位于底部 Tab 上方
- 状态管理用 React useState + Supabase 查询，不引入 Redux/Zustand
- UI 风格、配色、字体由 Trae 自行决定，建议用 shadcn/ui
- 加载动画、错误提示样式由 Trae 自行决定

***

## **19. 修订记录（13 项修正）**

1. Storage 权限索引 `[1]` → `[0]`
2. 错题本保存触发：答错/卡住时保存，答对选择性保存
3. LangGraph 状态：每次请求从 DB 重建 TutorState
4. question\_id 顺序：临时 UUID 上传，确认后更新路径
5. Demo 账号：改用 Supabase 匿名登录，独立用户
6. 图片压缩：1024px + 质量 0.7，控制 Base64 体积
7. 多题识别：MVP 只返回单题，多题提示重传
8. JSON 解析：正则去 markdown 包裹
9. API 鉴权：每个 Route 校验 Supabase JWT
10. 学生答案提取：evaluate\_answer 中同时提取+评估
11. 查看答案后：同样触发 summarize + 保存按钮
12. 尝试次数：总 5 次，连续错 3 次解锁答案
13. is\_in\_scope：用户确认时重新校验

