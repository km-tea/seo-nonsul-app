// 교사 스스로 가입할 수 있게 하되, 아무나 교사로 등록되지 않도록
// "가입 코드"(TEACHER_SIGNUP_CODE, 관리자가 정해서 필요한 사람에게만 알려주는 값)를
// 맞게 입력해야만 계정이 만들어진다.

const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");

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

  const { login_id, password, name, school_name, signup_code } = body;

  if (!login_id || !password || !name || !school_name || !signup_code) {
    return { statusCode: 400, body: JSON.stringify({ error: "모든 항목을 입력해 주세요." }) };
  }

  if (signup_code !== process.env.TEACHER_SIGNUP_CODE) {
    return { statusCode: 403, body: JSON.stringify({ error: "가입 코드가 올바르지 않습니다." }) };
  }

  if (password.length < 4) {
    return { statusCode: 400, body: JSON.stringify({ error: "비밀번호는 4자 이상으로 입력해 주세요." }) };
  }

  const { data: existing } = await supabase
    .from("teachers")
    .select("id")
    .eq("login_id", login_id)
    .maybeSingle();

  if (existing) {
    return { statusCode: 409, body: JSON.stringify({ error: "이미 사용 중인 아이디입니다." }) };
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { data: teacher, error } = await supabase
    .from("teachers")
    .insert({ login_id, password_hash, name, school_name })
    .select("id, login_id, name, school_name")
    .single();

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "가입 처리 중 오류가 발생했습니다: " + error.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ teacher }) };
};
