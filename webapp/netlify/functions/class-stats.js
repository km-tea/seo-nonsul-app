// 교사 학급의 문항별 평균 점수를 계산해서, 반 전체가 어려워하는 문항을 짚어준다
// (평균이 낮은 순으로 정렬해서 돌려줌).

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
  const claims = verifyTeacherToken(event);
  if (!claims) {
    return { statusCode: 401, body: JSON.stringify({ error: "교사 로그인이 필요합니다." }) };
  }

  const classId = event.queryStringParameters?.class_id;
  if (!classId) {
    return { statusCode: 400, body: JSON.stringify({ error: "class_id가 필요합니다." }) };
  }

  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select("id, teacher_id")
    .eq("id", classId)
    .maybeSingle();

  if (clsErr || !cls || cls.teacher_id !== claims.teacher_id) {
    return { statusCode: 403, body: JSON.stringify({ error: "이 학급 통계를 볼 권한이 없습니다." }) };
  }

  const { data: students, error: stuErr } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", classId);

  if (stuErr) {
    return { statusCode: 500, body: JSON.stringify({ error: stuErr.message }) };
  }
  const studentIds = (students || []).map((s) => s.id);
  if (studentIds.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ items: [] }) };
  }

  const { data: subs, error: subErr } = await supabase
    .from("submissions")
    .select("item_id, score, max_score, items(title, subject)")
    .in("student_id", studentIds);

  if (subErr) {
    return { statusCode: 500, body: JSON.stringify({ error: subErr.message }) };
  }

  const byItem = {};
  (subs || []).forEach((s) => {
    if (!byItem[s.item_id]) {
      byItem[s.item_id] = { item_id: s.item_id, title: s.items?.title, subject: s.items?.subject, scores: [] };
    }
    if (s.max_score) {
      byItem[s.item_id].scores.push((s.score ?? 0) / s.max_score);
    }
  });

  const items = Object.values(byItem)
    .filter((x) => x.scores.length > 0)
    .map((x) => ({
      item_id: x.item_id,
      title: x.title,
      subject: x.subject,
      attempts: x.scores.length,
      avg_percent: Math.round((x.scores.reduce((a, b) => a + b, 0) / x.scores.length) * 100),
    }))
    .sort((a, b) => a.avg_percent - b.avg_percent);

  return { statusCode: 200, body: JSON.stringify({ items }) };
};
