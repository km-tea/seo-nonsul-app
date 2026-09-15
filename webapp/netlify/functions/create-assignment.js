// 교사가 자기 학급에 과제(문항 묶음 + 마감일)를 지정한다.
// 학교급이 안 맞는 문항을 실수로 넣지 못하도록, 서버에서도 한 번 더 확인한다.

const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LEVEL_TO_GRADE_BANDS = {
  초등학교: ["3-4", "5-6"],
  중학교: ["중학교"],
  고등학교: ["고등학교"],
};

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

  const { class_id, item_ids, title, due_date } = body;
  if (!class_id || !Array.isArray(item_ids) || item_ids.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "class_id와 item_ids가 필요합니다." }) };
  }

  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select("id, teacher_id, school_level")
    .eq("id", class_id)
    .maybeSingle();

  if (clsErr || !cls || cls.teacher_id !== claims.teacher_id) {
    return { statusCode: 403, body: JSON.stringify({ error: "이 학급에 과제를 낼 권한이 없습니다." }) };
  }

  // 학교급에 안 맞는 문항이 섞여 있지는 않은지 확인
  if (cls.school_level && LEVEL_TO_GRADE_BANDS[cls.school_level]) {
    const allowedBands = LEVEL_TO_GRADE_BANDS[cls.school_level];
    const { data: items } = await supabase.from("items").select("id, grade_band").in("id", item_ids);
    const mismatched = (items || []).filter((i) => !allowedBands.includes(i.grade_band));
    if (mismatched.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `이 학급(${cls.school_level})에 맞지 않는 문항이 포함돼 있어요: ${mismatched.map((m) => m.id).join(", ")}`,
        }),
      };
    }
  }

  const { data: assignment, error: aErr } = await supabase
    .from("assignments")
    .insert({ teacher_id: claims.teacher_id, class_id, title: title || null, due_date: due_date || null })
    .select()
    .single();

  if (aErr) {
    return { statusCode: 500, body: JSON.stringify({ error: "과제 생성 실패: " + aErr.message }) };
  }

  const rows = item_ids.map((item_id) => ({ assignment_id: assignment.id, item_id }));
  const { error: aiErr } = await supabase.from("assignment_items").insert(rows);
  if (aiErr) {
    return { statusCode: 500, body: JSON.stringify({ error: "과제 문항 연결 실패: " + aiErr.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ assignment }) };
};
