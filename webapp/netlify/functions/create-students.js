// 학생 계정을 일괄 생성하는 함수. 두 가지 방법으로 호출할 수 있다.
//  1) 교사가 로그인한 상태에서 호출: Authorization: Bearer <교사 토큰> 헤더만 있으면 됨.
//     이때는 그 교사 자신의 학급/학생만 만들 수 있다(teacher_login_id를 안 보내도 됨).
//  2) 관리자가 ADMIN_SECRET으로 호출: x-admin-secret 헤더 + teacher_login_id로 임의 교사 지정 가능.
//
// 요청 형식:
// POST /.netlify/functions/create-students
// headers: { "Authorization": "Bearer <교사 토큰>" } 또는 { "x-admin-secret": "<ADMIN_SECRET>" }
// body: {
//   "class_name": "3학년 2반", "grade": 3, "teacher_login_id": "teacher01"(관리자 호출 시에만 필요),
//   "students": [{ "student_number": "30201", "name": "홍길동", "password": "임시비번1234" }, ...]
// }

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

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "요청 형식이 올바르지 않습니다." }) };
  }

  const teacherClaims = verifyTeacherToken(event);
  const adminSecret = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  const isAdmin = adminSecret && adminSecret === process.env.ADMIN_SECRET;

  if (!teacherClaims && !isAdmin) {
    return { statusCode: 401, body: JSON.stringify({ error: "권한이 없습니다." }) };
  }

  const { class_name, grade, school_level, students } = body;
  let teacher_login_id = body.teacher_login_id;

  if (!Array.isArray(students) || students.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "students 배열이 필요합니다." }) };
  }

  // 교사(또는 관리자가 지정한 교사)의 school_name을 먼저 확인해 둔다 -
  // class_name 유무와 관계없이 항상 필요하다.
  let teacherId = null;
  let schoolName = null;
  if (teacherClaims) {
    teacherId = teacherClaims.teacher_id;
    const { data: me } = await supabase
      .from("teachers")
      .select("school_name")
      .eq("id", teacherId)
      .maybeSingle();
    schoolName = me?.school_name ?? null;
  } else if (teacher_login_id) {
    const { data: teacher } = await supabase
      .from("teachers")
      .select("id, school_name")
      .eq("login_id", teacher_login_id)
      .maybeSingle();
    if (!teacher) {
      return { statusCode: 404, body: JSON.stringify({ error: "해당 교사 계정을 찾을 수 없습니다." }) };
    }
    teacherId = teacher.id;
    schoolName = teacher.school_name;
  } else if (isAdmin) {
    return { statusCode: 400, body: JSON.stringify({ error: "teacher_login_id가 필요합니다." }) };
  }

  // 학급이 지정됐으면 학급을 찾거나 만든다.
  let classId = null;
  if (class_name && teacherId) {
    // 이미 같은 이름의 학급이 있으면 재사용하고, 없을 때만 새로 만든다
    // (같은 학급에 학생을 여러 번 나눠서 등록할 수 있도록).
    const { data: existingCls } = await supabase
      .from("classes")
      .select("id")
      .eq("teacher_id", teacherId)
      .eq("class_name", class_name)
      .maybeSingle();

    if (existingCls) {
      classId = existingCls.id;
    } else {
      const { data: cls, error: clsErr } = await supabase
        .from("classes")
        .insert({ teacher_id: teacherId, class_name, grade, school_level: school_level || null })
        .select()
        .single();
      if (clsErr) {
        return { statusCode: 500, body: JSON.stringify({ error: "학급 생성 실패: " + clsErr.message }) };
      }
      classId = cls.id;
    }
  }

  const created = [];
  const failures = [];
  for (const s of students) {
    if (!s.student_number || !s.password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `학번과 비밀번호가 필요합니다: ${JSON.stringify(s)}` }),
      };
    }
    const password_hash = await bcrypt.hash(s.password, 10);

    // 학번은 "같은 학교 안"에서만 유일하면 되므로(webapp_patch3.sql 참고),
    // 다른 학교와 겹치는 건 전혀 문제 없다. 같은 학교 안에서 겹칠 때만 오류로 알려준다.
    const { data: row, error: insErr } = await supabase
      .from("students")
      .insert({
        student_number: s.student_number,
        password_hash,
        name: s.name || null,
        grade: grade || null,
        class_id: classId,
        school_name: schoolName,
      })
      .select("id, student_number, name")
      .single();

    if (row) {
      created.push(row);
    } else {
      const message =
        insErr?.code === "23505"
          ? "우리 학교에 이미 있는 학번이에요. 다른 번호를 써주세요."
          : insErr?.message || "등록 실패";
      failures.push({ student_number: s.student_number, error: message });
    }
  }

  return { statusCode: 200, body: JSON.stringify({ created, failures }) };
};
