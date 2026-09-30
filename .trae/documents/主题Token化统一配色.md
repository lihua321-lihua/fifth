# 全局 @theme 色彩 Token 化：统一配色方案

## Context（背景）

项目 `e:\bishi\fifth`（Next 16 + Tailwind v4 CSS-first）当前的配色存在三类乱象：

1. **主色语义不统一**：品牌主色以 `indigo-*` 为主色，但 `login-form`、`upload`、`tutor-chat` 又把 `emerald-*` / `green-*` 用作主操作按钮，造成「双主色」。
2. **语义色角色混用**：`emerald` 既表达「成功/已掌握」又表达「主操作按钮」；状态反馈混用 `red/green/emerald/amber/sky` 多套色族，无归并。
3. **无 Token 体系**：颜色全部以 Tailwind 内置类名内联散布在 10 个组件 + `globals.css` 硬编码色值中，改主色需动几十处。

本次目标：在 Tailwind `@theme` 中建立**主色 primary + 语义色 danger/success/warning/info** 的 Token 体系，并把组件中的 `indigo/red/green/emerald/amber/sky` 内联类统一替换为语义 Token。

**已确认的决策**（经用户确认）：

* 主色用**当前靛蓝紫 indigo 色值**（`#4f46e5` 族），保留现有视觉。

* 语义色**全部 Token 化**并归并为 danger / success / warning / info 四类。

## Token 设计（写入 `src/app/globals.css`）

在现有 `@theme inline {}` 块中追加如下色阶变量（Tailwind v4 会依据 `--color-<name>-<step>` 自动生成 `<name>-<step>` 类）：

```css
/* 主色 primary（沿用靛蓝紫 indigo 值） */
--color-primary-50:  #eef2ff;
--color-primary-100: #e0e7ff;
--color-primary-200: #c7d2fe;
--color-primary-500: #6366f1;
--color-primary-600: #4f46e5;
--color-primary-700: #4338ca;

/* 语义 danger（沿用 red 值） */
--color-danger-50:  #fef2f2;
--color-danger-400: #f87171;
--color-danger-500: #ef4444;
--color-danger-600: #dc2626;
--color-danger-700: #b91c1c;

/* 语义 success（沿用 emerald 值作为事实标准） */
--color-success-50:  #ecfdf5;
--color-success-100: #d1fae5;
--color-success-200: #a7f3d0;
--color-success-500: #10b981;
--color-success-600: #059669;
--color-success-700: #047857;

/* 语义 warning（沿用 amber 值） */
--color-warning-50:  #fffbeb;
--color-warning-500: #f59e0b;
--color-warning-700: #b45309;
--color-warning-800: #92400e;

/* 语义 info（沿用 sky 值） */
--color-info-100: #e0f2fe;
--color-info-700: #0369a1;
```

> 说明：success 统一采用 emerald 家族值（项目事实标准）。`login-form` 处的 `green-50/green-600`（`#f0fdf4`/`#16a34a`）会一并归并为 success，绿色有微量偏移属预期，换取语义统一。

## 类名映射表（组件内替换规则）

| 原类名                                             | 新类名（语义 Token）                               |
| ----------------------------------------------- | ------------------------------------------- |
| `indigo-50/100/200/500/600/700`                 | `primary-50/100/200/500/600/700`            |
| `red-50/400/500/600/700`                        | `danger-50/400/500/600/700`                 |
| `green-50/600`、`emerald-50/100/200/500/600/700` | `success-50/100/200/500/600/700`（按现有实际档位映射） |
| `amber-50/500/700/800`                          | `warning-50/500/700/800`                    |
| `sky-100/700`                                   | `info-100/700`                              |

中性色 `gray-*`、`bg-white`、`bg-black`（相机预览）、`text-white` 保持不变（灰属中性，非语义）。

## 涉及文件（按 Explore 盘点）

**组件/页面内联类替换**（`indigo→primary`、`emerald/green→success`、`red→danger`、`amber→warning`、`sky→info`）——10 个文件：

* `src/app/login/login-form.tsx`（含 green-50/600→success）

* `src/app/upload/page.tsx`（含 emerald-600/700→success；red→danger；amber→warning）

* `src/app/tutor/[sessionId]/tutor-chat.tsx`（含 emerald 总结区→success；amber→warning）

* `src/app/weakness/weakness-client.tsx`（red→danger）

* `src/app/mistakes/mistakes-list.tsx`（red/amber/sky/emerald 状态→danger/warning/info/success）

* `src/app/mistakes/[id]/mistake-detail.tsx`（amber→warning；red→danger）

* `src/app/profile/page.tsx`（emerald→success）

* `src/components/agent-dock.tsx`（red→danger）

* `src/components/voice-settings.tsx`、`src/components/speak-button.tsx`、`src/components/bottom-tab.tsx`（indigo→primary）

* `src/components/hold-to-talk.tsx`（red→danger）

* `src/components/impl-notes.tsx`（emerald/amber tone→success/warning）

**硬编码色值**：

* `src/app/globals.css`（`.md-content` blockquote 边框 `#c7d2fe`→primary-200、文字 `#6b7280`→gray-600、表格边框 `#e5e7eb`→gray-200、链接 `#4f46e5`→primary-600、code/pre 背景 rgba 保持中性灰）

* `lib/` 或 `src/lib/` 下 `compress-image.ts` 的 `#ffffff`（确认后保留为 `white` 或 `#fff` 常量）

## 执行注意事项

* **映射须按实际出现档位精确替换**，不要用 `replace_all` 无差别替换整色族（例如 `emerald-600` 是渐变到 success-600，`red-400` 与 `red-500` 分属不同用途，需保持各自档位对应）。

* `globals.css` 中 `:root` 的 `--background`/`--foreground` 与 `body` 背景保持不变（已属中性层级）。

* 替换后确认每组色族类名**不再残留**于组件（可用 Grep 校验）。

## 验证方式

1. **残留校验**：对 `src/` 执行 Grep `(bg|text|border|ring)-?(indigo|red|green|emerald|amber|sky)`（排除 globals.css 的 Token 定义行），应无命中或仅剩预期残留。
2. **构建验证**：运行 `npm run build`（或 dev server），确认 Tailwind 能解析新的 `primary-*` / `danger-*` 等类，无编译报错。
3. **视觉抽查**：在浏览器打开登录、错题本、Tutor 会话、上传、AgentDock 页面，确认主色仍为靛蓝紫、四类语义色表达正确、无异常跳色。
4. 若项目有 `node:test` 测试，跑一次确保替换未破坏 UI 相关测试（如有）。

