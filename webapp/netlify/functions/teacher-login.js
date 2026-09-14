// 교사가 로그인 아이디+비밀번호로 로그인하면, 이 함수가 teachers 테이블에서
// 직접 검증하고 커스텀 JWT를 발급한다. 학생 토큰과 구분하기 위해
// app_role: "teacher" 클레임을 반드시 넣는다 (RLS 정책이 이걸로 교사 전용
// 접근을 구분한다 - webapp_teacher_patch.sql 참고).

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

  const { login_id, password } = body;
  if (!login_id || !password) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "아이디와 비밀번호를 모두 입력해 주세요." }),
    };
  }

  const { data: teacher, error } = await supabase
    .from("teachers")
    .select("id, login_id, password_hash, name, school_name")
    .eq("login_id", login_id)
    .maybeSingle();

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "서버 오류가 발생했습니다." }) };
  }
  if (!teacher) {
    return { statusCode: 401, body: JSON.stringify({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }) };
  }

  const ok = await bcrypt.compare(password, teacher.password_hash || "");
  if (!ok) {
    return { statusCode: 401, body: JSON.stringify({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }) };
  }

  const token = jwt.sign(
    {
      sub: teacher.id,
      role: "authenticated",
      app_role: "teacher",
      teacher_id: teacher.id,
      login_id: teacher.login_id,
    },
    process.env.SUPABASE_JWT_SECRET,
    { algorithm: "HS256", expiresIn: "12h" }
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      token,
      teacher: {
        id: teacher.id,
        login_id: teacher.login_id,
        name: teacher.name,
        school_name: teacher.school_name,
      },
    }),
  };
};
