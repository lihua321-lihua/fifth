import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// AI 回复 Markdown 渲染（支持加粗、列表、表格、代码块等）
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="md-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}