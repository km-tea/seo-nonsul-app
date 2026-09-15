// 교사가 AI 채점 결과(점수, 피드백)를 직접 고칠 수 있게 하는 함수.
// 아무 제출이나 고칠 수 있는 게 아니라, 그 학생이 "이 교사의 학급" 소속일 때만 허용한다.

const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function verifyTeacherToken(event) {
  const header = event.headers.authorization || event.headers.Authorization || "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const claims = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    return claims.app_role === "teacher" ? claims : null;
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "허용되지 않은 요청입니다." }) };
  }

  const claims = verifyTeacherToken(event);
  if (!claims) {
    return { statusCode: 401, body: JSON.stringify({ error: "교사 로그인이 필요합니다." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "요청 형식이 올바르지 않습니다." }) };
  }

  const { submission_id, score, max_score, feedback } = body;
  if (!submission_id) {
    return { statusCode: 400, body: JSON.stringify({ error: "submission_id가 필요합니다." }) };
  }

  // 이 제출물의 학생이 정말 이 교사 학급 소속인지 확인
  const { data: sub, error: subErr } = await supabase
    .from("submissions")
    .select("id, student_id, students(class_id, classes(teacher_id))")
    .eq("id", submission_id)
    .maybeSingle();

  if (subErr || !sub) {
    return { statusCode: 404, body: JSON.stringify({ error: "제출 기록을 찾을 수 없습니다." }) };
  }

  const ownerTeacherId = sub.students?.classes?.teacher_id;
  if (!ownerTeacherId || ownerTeacherId !== claims.teacher_id) {
    return { statusCode: 403, body: JSON.stringify({ error: "이 제출물을 수정할 권한이 없습니다." }) };
  }

  const updateFields = { teacher_edited: true };
  if (score !== undefined) updateFields.score = score;
  if (max_score !== undefined) updateFields.max_score = max_score;
  if (feedback !== undefined) updateFields.ai_feedback = feedback;

  const { data: updated, error: updErr } = await supabase
    .from("submissions")
    .update(updateFields)
    .eq("id", submission_id)
    .select()
    .single();

  if (updErr) {
    return { statusCode: 500, body: JSON.stringify({ error: "수정 중 오류가 발생했습니다: " + updErr.message }) };
  }

  return { statusCode: 200, body: JSON.stringify(updated) };
};
