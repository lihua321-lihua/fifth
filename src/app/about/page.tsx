import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-md p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">产品说明</h1>
        <Link href="/login" className="text-sm text-primary-600 hover:underline">
          返回登录
        </Link>
      </div>

      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">如何使用</h2>
        <ol className="mt-3 space-y-2 text-sm text-gray-600">
          <li className="flex gap-2">
            <span className="font-semibold text-primary-600">1.</span>
            登录 / 注册，或点击「一键体验 Demo」匿名进入。
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-primary-600">2.</span>
            在「上传」页拍照或从相册选择一道初中英语题目。
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-primary-600">3.</span>
            AI 自动读图识别题目文字，可手动编辑修正。
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-primary-600">4.</span>
            点击「确认并开始辅导」，进入 AI 分层辅导对话。
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-primary-600">5.</span>
            辅导结束后，可在「错题本」和「薄弱知识点」查看结果。
          </li>
        </ol>
      </section>

      <section className="mt-4 rounded-2xl bg-success-50 p-4">
        <h2 className="text-sm font-semibold text-success-700">已实现功能</h2>
        <ul className="mt-2 space-y-1 text-sm text-success-700">
          <li>· 登录 / 注册 / 匿名 Demo</li>
          <li>· 拍照上传、DeepSeek 读图识别、文本可编辑</li>
          <li>· AI 分层辅导（LangGraph）</li>
          <li>· 语音输入 / 语音播放（Web Speech API）</li>
          <li>· 错题本 + 薄弱知识点</li>
          <li>· AgentDock（结构化动作）</li>
        </ul>
      </section>

      <section className="mt-4 rounded-2xl bg-gray-50 p-4">
        <h2 className="text-sm font-semibold text-gray-600">未实现功能</h2>
        <ul className="mt-2 space-y-1 text-sm text-gray-500">
          <li>· 多题裁剪</li>
          <li>· 相似题生成</li>
          <li>· 家长 / 教师学习报告</li>
          <li>· RAG 检索增强</li>
          <li>· 题型范围目前仅支持初中英语完形填空与阅读理解选择题</li>
        </ul>
      </section>
    </main>
  );
}