// 학생이 학번+비밀번호로 로그인하면, 이 함수가 students 테이블에서 직접 검증하고
// Supabase 프로젝트의 JWT Secret으로 커스텀 토큰을 발급한다.
// (Supabase Auth의 가입/로그인 기능은 사용하지 않음 - 학번 로그인이라 이메일 기반과 안 맞음)
//
// 발급하는 JWT의 sub 클레임 = students.id (uuid). 이렇게 해야 프론트엔드가
// 이 토큰을 Supabase 클라이언트에 실어 보낼 때 auth.uid()가 students.id와 같아져서
// RLS 정책("id = auth.uid()")이 그대로 동작한다.

const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "허용되지 않은 요청입니다." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "요청 형식이 올바르지 않습니다." }) };
  }

  const { student_number, password, school_name } = body;
  if (!student_number || !password || !school_name) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "학교, 학번, 비밀번호를 모두 입력해 주세요." }),
    };
  }

  const { data: student, error } = await supabase
    .from("students")
    .select("id, student_number, password_hash, name, grade, class_id, school_name")
    .eq("student_number", student_number)
    .eq("school_name", school_name)
    .maybeSingle();

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "서버 오류가 발생했습니다." }) };
  }
  if (!student) {
    return { statusCode: 401, body: JSON.stringify({ error: "학번 또는 비밀번호가 올바르지 않습니다." }) };
  }

  const ok = await bcrypt.compare(password, student.password_hash || "");
  if (!ok) {
    return { statusCode: 401, body: JSON.stringify({ error: "학번 또는 비밀번호가 올바르지 않습니다." }) };
  }

  // 교사 조회용 정책(submissions_select_teacher)은 이제 app_role='teacher'인
  // 교사 전용 토큰만 통과하므로, 학생 토큰에는 teacher_id를 넣지 않는다
  // (넣어두면 같은 반 급우의 제출물까지 보일 수 있어서 제거함).
  const token = jwt.sign(
    {
      sub: student.id,
      role: "authenticated",
      student_number: student.student_number,
    },
    process.env.SUPABASE_JWT_SECRET,
    { algorithm: "HS256", expiresIn: "12h" }
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      token,
      student: {
        id: student.id,
        student_number: student.student_number,
        name: student.name,
        grade: student.grade,
        school_name: student.school_name,
      },
    }),
  };
};
