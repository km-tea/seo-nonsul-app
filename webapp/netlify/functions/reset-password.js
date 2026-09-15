// 두 가지 용도로 쓰는 함수:
//  1) 교사가 "자기 학급" 학생의 비밀번호를 새로 정해주기 (기존 비밀번호 확인 불필요 - 교사 권한)
//  2) 교사 본인이 자기 비밀번호를 바꾸기 (기존 비밀번호 확인 필요)

const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
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

  const { target, student_id, new_password, old_password } = body;
  if (!new_password || new_password.length < 4) {
    return { statusCode: 400, body: JSON.stringify({ error: "새 비밀번호는 4자 이상으로 입력해 주세요." }) };
  }

  if (target === "student") {
    if (!student_id) {
      return { statusCode: 400, body: JSON.stringify({ error: "student_id가 필요합니다." }) };
    }
    const { data: student, error: stuErr } = await supabase
      .from("students")
      .select("id, class_id, classes(teacher_id)")
      .eq("id", student_id)
      .maybeSingle();

    if (stuErr || !student) {
      return { statusCode: 404, body: JSON.stringify({ error: "학생을 찾을 수 없습니다." }) };
    }
    if (student.classes?.teacher_id !== claims.teacher_id) {
      return { statusCode: 403, body: JSON.stringify({ error: "이 학생의 비밀번호를 바꿀 권한이 없습니다." }) };
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    const { error: updErr } = await supabase
      .from("students")
      .update({ password_hash })
      .eq("id", student_id);

    if (updErr) {
      return { statusCode: 500, body: JSON.stringify({ error: "비밀번호 변경 실패: " + updErr.message }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  if (target === "self") {
    if (!old_password) {
      return { statusCode: 400, body: JSON.stringify({ error: "현재 비밀번호를 입력해 주세요." }) };
    }
    const { data: teacher, error: tErr } = await supabase
      .from("teachers")
      .select("id, password_hash")
      .eq("id", claims.teacher_id)
      .maybeSingle();

    if (tErr || !teacher) {
      return { statusCode: 404, body: JSON.stringify({ error: "교사 계정을 찾을 수 없습니다." }) };
    }
    const ok = await bcrypt.compare(old_password, teacher.password_hash || "");
    if (!ok) {
      return { statusCode: 401, body: JSON.stringify({ error: "현재 비밀번호가 올바르지 않습니다." }) };
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    const { error: updErr } = await supabase
      .from("teachers")
      .update({ password_hash })
      .eq("id", claims.teacher_id);

    if (updErr) {
      return { statusCode: 500, body: JSON.stringify({ error: "비밀번호 변경 실패: " + updErr.message }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: "target 값이 올바르지 않습니다." }) };
};
