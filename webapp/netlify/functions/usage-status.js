// Gemini API 키는 이 앱 전체(모든 학교·모든 반)가 함께 쓰는 무료 키라서,
// 하루 요청 한도를 넘기지 않았는지 교사가 미리 가늠할 수 있도록 오늘 채점된
// 전체 건수를 보여준다. 학생별로 나뉘어 보이는 대시보드와 달리, 이건 교사
// 누구나 "오늘 전체 앱 사용량"을 볼 수 있게 한다(RLS를 우회하는 service_role 사용).

const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DAILY_LIMIT_ESTIMATE = Number(process.env.GEMINI_DAILY_ESTIMATED_LIMIT || 300);

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

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfToday.toISOString());

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "사용량을 불러오지 못했습니다: " + error.message }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      today_count: count || 0,
      estimated_daily_limit: DAILY_LIMIT_ESTIMATE,
    }),
  };
};
