// 网页内标注（SPEC 14）：已实现 / Mock / 已知限制
export default function ImplNotes() {
  return (
    <div className="mt-4 space-y-3">
      <NoteBlock
        tone="emerald"
        title="已实现"
        items={[
          "登录 / 匿名 Demo",
          "上传拍照、DeepSeek 读图识别、文本可编辑",
          "AI 分层辅导（LangGraph）",
          "语音输入 / 语音播放（Web Speech API）",
          "错题本 + 薄弱知识点",
          "AgentDock（结构化 actions）",
        ]}
      />
      <NoteBlock
        tone="amber"
        title="Mock"
        items={[
          "AI 使用次数 / 成本展示为估算值",
          "示例题以文本渲染，无真实图片",
          "无真实 OCR 降级",
        ]}
      />
      <NoteBlock
        tone="gray"
        title="已知限制"
        items={[
          "仅支持初中英语完形填空、阅读理解选择题",
          "手写体、模糊、倾斜图片可能识别不准",
          "多题裁剪未实现",
          "相似题生成未实现",
          "家长 / 教师摘要未实现",
          "RAG 未实现",
        ]}
      />
    </div>
  );
}

const TONES: Record<string, { bg: string; text: string; dot: string }> = {
  emerald: { bg: "bg-success-50", text: "text-success-700", dot: "bg-success-500" },
  amber: { bg: "bg-warning-50", text: "text-warning-700", dot: "bg-warning-500" },
  gray: { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" },
};

function NoteBlock({
  tone,
  title,
  items,
}: {
  tone: "emerald" | "amber" | "gray";
  title: string;
  items: string[];
}) {
  const t = TONES[tone];
  return (
    <div className={`rounded-2xl px-4 py-3 ${t.bg}`}>
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${t.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
        {title}
      </p>
      <ul className="mt-2 space-y-1">
        {items.map((it) => (
          <li key={it} className={`text-xs ${t.text}`}>
            · {it}
          </li>
        ))}
      </ul>
    </div>
  );
}