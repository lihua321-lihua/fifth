import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";

// 确认上传：创建 question + tutoring_session，图片上传到私有 bucket（SPEC 5.2 / 6.3）
export async function POST(req: Request) {
  // 1. 鉴权
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. 解析请求
  let body: {
    image_base64?: string;
    ocr_text?: string;
    edited_text?: string;
    subject?: string;
    question_type?: string;
    grade_level?: string;
    is_in_scope?: boolean;
    knowledge_points?: string[];
    brief_analysis?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const editedText = (body.edited_text ?? "").trim();
  if (!editedText) {
    return NextResponse.json(
      { error: "empty_text", message: "题目文本为空，请填写后再确认" },
      { status: 400 },
    );
  }

  const questionId = randomUUID();
  const sessionId = randomUUID();

  // 3. 上传图片（若有）到 {user_id}/{question_id}/original.jpg
  let imageUrl: string | null = null;
  const imageBase64 = body.image_base64;
  if (imageBase64) {
    const base64 = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;
    const bytes = Buffer.from(base64, "base64");
    const path = `${user.id}/${questionId}/original.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("question-images")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });

    if (uploadError) {
      console.error("[questions] 图片上传失败", uploadError);
      return NextResponse.json(
        { error: "upload_error", message: "图片上传失败，请重试" },
        { status: 500 },
      );
    }
    imageUrl = path;
  }

  // 4. 写入 question
  const { error: questionError } = await supabase.from("questions").insert({
    id: questionId,
    user_id: user.id,
    original_image_url: imageUrl,
    ocr_text: body.ocr_text ?? editedText,
    edited_text: editedText,
    subject: body.subject ?? "英语",
    question_type: body.question_type ?? "",
    grade_level: body.grade_level ?? "初中",
    is_in_scope: body.is_in_scope !== false,
    knowledge_points: body.knowledge_points ?? [],
  });
  if (questionError) {
    console.error("[questions] 创建 question 失败", questionError);
    return NextResponse.json(
      { error: "db_error", message: "保存失败，请重试" },
      { status: 500 },
    );
  }

  // 5. 写入 tutoring_session
  const { error: sessionError } = await supabase.from("tutoring_sessions").insert({
    id: sessionId,
    user_id: user.id,
    question_id: questionId,
    status: "进行中",
    current_hint_level: "none",
  });
  if (sessionError) {
    console.error("[questions] 创建 session 失败", sessionError);
    return NextResponse.json(
      { error: "db_error", message: "保存失败，请重试" },
      { status: 500 },
    );
  }

  return NextResponse.json({ questionId, sessionId });
}