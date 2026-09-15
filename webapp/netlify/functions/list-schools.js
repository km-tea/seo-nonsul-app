// 학생 로그인 화면의 "학교 선택" 드롭다운에 쓸 학교 목록을 돌려준다.
// 로그인하기 전에 호출되는 화면이라 인증 없이 열려있다(학교 이름만 보여주는
// 것이라 민감 정보는 아님).

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async () => {
  const { data, error } = await supabase.from("teachers").select("school_name");

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  const schools = [...new Set((data || []).map((t) => t.school_name).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );

  return { statusCode: 200, body: JSON.stringify({ schools }) };
};
