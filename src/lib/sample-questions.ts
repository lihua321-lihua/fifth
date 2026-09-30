export type SampleQuestion = {
  id: "sample-cloze" | "sample-reading";
  subject: string;
  question_type: string;
  grade_level: string;
  knowledge_points: string[];
  brief_analysis: string;
  text: string;
};

// 预置两道示例题（SPEC 第 13 节），供上传页“使用示例题”按钮加载。
// 示例题以文本渲染，无真实图片（original_image_url 为空）。
export const SAMPLE_QUESTIONS: SampleQuestion[] = [
  {
    id: "sample-cloze",
    subject: "英语",
    question_type: "完形填空",
    grade_level: "初中",
    knowledge_points: ["动词时态", "词义辨析"],
    brief_analysis: "主要考查一般过去时的时态判断与上下文词义辨析。",
    text: [
      "Last Sunday, I ___1___ my grandparents in the countryside.",
      "When I ___2___ the bus, it started to rain.",
      "I didn't have an umbrella, so I ___3___ wet.",
      "Luckily, a kind woman ___4___ me her umbrella.",
      "I thanked her and ___5___ her with a big smile.",
      "",
      "1. A. visit   B. visited   C. will visit   D. am visiting",
      "2. A. get off   B. got off   C. gets off   D. will get off",
      "3. A. get   B. got   C. getting   D. to get",
      "4. A. lend   B. lent   C. lends   D. will lend",
      "5. A. show   B. showed   C. showing   D. will show",
    ].join("\n"),
  },
  {
    id: "sample-reading",
    subject: "英语",
    question_type: "阅读理解选择题",
    grade_level: "初中",
    knowledge_points: ["细节理解", "主旨大意"],
    brief_analysis: "考查在短文中定位细节信息与把握主旨大意的能力。",
    text: [
      "Tom is a middle school student.",
      "Every morning, he gets up at 6:30 and rides his bike to school.",
      "He likes English best because his English teacher is very kind.",
      "After school, he often plays basketball with his friends.",
      "On weekends, he goes to the library to read books.",
      "Tom wants to be a teacher in the future.",
      "",
      "1. How does Tom go to school?",
      "   A. By bus   B. By bike   C. On foot   D. By car",
      "2. Why does Tom like English best?",
      "   A. Because it is easy   B. Because his English teacher is kind",
      "   C. Because he likes reading   D. Because he likes speaking",
      "3. What does Tom want to be in the future?",
      "   A. A doctor   B. A player   C. A teacher   D. A writer",
    ].join("\n"),
  },
];

export function getSampleQuestion(id: string): SampleQuestion | undefined {
  return SAMPLE_QUESTIONS.find((q) => q.id === id);
}