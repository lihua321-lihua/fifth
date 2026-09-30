import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TutorChat from "./tutor-chat";
import type { HintLevel } from "@/lib/tutor-types";

export default async function TutorPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("tutoring_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) notFound();

  const { data: question } = await supabase
    .from("questions")
    .select("*")
    .eq("id", session.question_id)
    .maybeSingle();
  if (!question) notFound();

  const { data: msgs } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return (
    <TutorChat
      sessionId={sessionId}
      questionId={question.id}
      questionText={question.edited_text || question.ocr_text || ""}
      questionType={question.question_type || ""}
      knowledgePoints={question.knowledge_points ?? []}
      initialMessages={(msgs ?? []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "ai",
        content: m.content,
        hint_level: (m.hint_level ?? null) as HintLevel | null,
      }))}
      initialHintLevel={(session.current_hint_level ?? "none") as HintLevel}
      initialSummary={session.summary ?? null}
      initialStatus={session.status ?? "进行中"}
      initialSubQuestionCount={session.sub_question_count ?? 0}
      initialSubQuestionIndex={session.sub_question_index ?? 1}
    />
  );
}