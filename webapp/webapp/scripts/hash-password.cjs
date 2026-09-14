// 학생 1명만 테스트용으로 SQL Editor에서 직접 만들고 싶을 때 쓰는 스크립트.
// 사용법: npm install 을 먼저 한 번 실행한 뒤,
//   node scripts/hash-password.cjs 원하는비밀번호
// 를 실행하면 bcrypt 해시가 출력된다. 그 값을 아래처럼 SQL로 직접 넣으면 된다.
//
// insert into public.students (student_number, password_hash, name, grade)
// values ('10101', '<여기에 출력된 해시>', '홍길동', 1);

const bcrypt = require("bcryptjs");

const password = process.argv[2];
const kind = process.argv[3] || "student"; // student | teacher (둘 다 같은 해시 방식, 안내 문구만 다름)
if (!password) {
  console.error("사용법: node scripts/hash-password.cjs <비밀번호> [student|teacher]");
  process.exit(1);
}

bcrypt.hash(password, 10).then((hash) => {
  console.log(hash);
  if (kind === "teacher") {
    console.log("\n교사 계정 SQL 예시:");
    console.log(
      `insert into public.teachers (login_id, password_hash, name, school_name)\nvalues ('teacher01', '${"<위 해시>"}', '홍길동', '○○초등학교');`
    );
  }
});
