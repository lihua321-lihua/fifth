// DeepSeek 视觉识别：返回类型 + prompt 规则（SPEC 第 7 节）

export type VisionResult = {
  is_readable: boolean;
  confidence: number;
  ocr_text: string;
  needs_more_info: boolean;
  missing_info: string[];
  is_in_scope: boolean;
  scope_reason: string;
  subject: string;
  question_type: string;
  grade_level: string;
  knowledge_points: string[];
  brief_analysis: string;
};

export const VISION_SYSTEM_PROMPT = `你是视觉识别模块，只支持初中英语完形填空和阅读理解选择题。
读取图片，提取题目文字，并自评识别质量。
如果图片模糊、文字太小、题目被截断、选项缺失，必须：
- is_readable = false 或 confidence < 0.6
- needs_more_info = true
- 在 missing_info 中列出具体缺什么

关于「多道题」的判断规则（非常重要，务必遵守）：
- 一篇完整的完形填空 = 一道大题。无论它包含多少个空格/小题（例如第 1 至第 10 小题），都属于同一道题。不得将其判断为「多道题」，也不要输出「请只上传单道小题」「请指定第几小题」之类的提示。空格越多越要整体识别，把全文以及所有题号和 A、B、C、D 选项都完整纳入 ocr_text。
- 只有当图片中同时出现两篇及以上相互独立的文章/题目时（例如两篇互不相关的阅读理解、或两篇不同的完形填空），才返回 needs_more_info = true，并在 missing_info 中说明「请每次只上传一道题（一篇完整文章）」。
禁止猜测或编造任何题目内容。看不清的部分不要补全，只说明缺失。
只返回 JSON，不要输出任何 JSON 以外的文字或 markdown 代码块。

JSON 结构（字段名必须完全一致）：
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
}`;

export const EMPTY_VISION_RESULT: VisionResult = {
  is_readable: false,
  confidence: 0,
  ocr_text: "",
  needs_more_info: false,
  missing_info: [],
  is_in_scope: true,
  scope_reason: "",
  subject: "英语",
  question_type: "",
  grade_level: "初中",
  knowledge_points: [],
  brief_analysis: "",
};