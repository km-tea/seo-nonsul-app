# 서논술형 학습장

학생이 문제를 풀고 제출하면 Gemini가 채점하고, 제출 후에만 채점 기준과 예시 답안(해설)을
볼 수 있는 학습 웹앱입니다. 교사는 별도 로그인으로 자기 학급 학생들의 제출 현황을 볼 수 있습니다.
React + Vite + Netlify Functions + Supabase로 만들었습니다.

## 폴더 구조

```
webapp/
  src/
    pages/
      LoginPage.jsx / TeacherLoginPage.jsx   학생/교사 로그인
      ItemListPage.jsx                       문항 목록(학생)
      SolvePage.jsx / ExplainPage.jsx        풀이 / 해설(학생)
      TeacherDashboardPage.jsx               학급·학생·점수 현황(교사)
    components/            공용 컴포넌트(TopBar, ImageGrid, TextBlock 등)
    context/AuthContext    로그인 상태(학생/교사 겸용) + 커스텀 JWT를 실은 Supabase 클라이언트
    lib/itemShape.js       문항 형태(원본 이미지 / 중고등 텍스트 / 초등 3단계 / 초등 직접형) 판별
  netlify/functions/
    login.js               학번+비밀번호 검증 -> 학생용 JWT 발급
    teacher-login.js        아이디+비밀번호 검증 -> 교사용 JWT 발급(app_role: "teacher")
    grade-answer.js         Gemini 채점(텍스트/이미지 모두 지원) -> submissions 저장
    create-students.js      학생 일괄 등록(교사 본인 토큰 또는 ADMIN_SECRET으로 호출) - 학번은
                             같은 학교 안에서만 유일하면 됨(다른 학교끼리는 겹쳐도 됨)
    list-schools.js         로그인 화면의 "학교 선택" 드롭다운용 학교 목록 조회(비로그인 접근 가능)
    update-submission.js    교사가 AI 채점 점수/피드백을 직접 수정
    reset-password.js       학생 비밀번호 재설정(교사가) / 교사 본인 비밀번호 변경
    usage-status.js         오늘 전체 채점 건수 조회(대시보드 사용량 배너용)
  scripts/hash-password.cjs  계정 1명 수동 생성할 때 쓰는 비밀번호 해시 도구
```

## 문항 데이터 형태 (중요)

`items` 테이블에는 서로 다른 출처의 문항이 섞여 있습니다.

| 형태 | 판별 조건 | 표시 방식 |
|---|---|---|
| 원본 페이지 이미지가 있는 문항 | `stimulus_images`가 비어있지 않음 | 이미지 그대로 표시(가장 우선) |
| 중고등(KICE 자료집 / 경기·정기시험) 텍스트 | `raw_content`가 있고 이미지 없음 | `raw_content.평가문항` 등 텍스트 |
| 초등 3~4학년(3단계 스캐폴딩) | `staged_questions`가 있음 | 단계별 prompt |
| 초등 5~6학년(직접형) | `question`이 있음 | `question.prompt` 등 |

`src/lib/itemShape.js`의 `getItemShape(item)`이 판별하고, `SolvePage`/`ExplainPage`가 그 결과에
따라 다른 컴포넌트를 렌더링합니다. 이미지가 있는 문항은 형태와 무관하게 이미지를 우선 표시합니다.

## 로그인 방식 (학생/교사 공통 원리)

Supabase Auth(가입/로그인)를 쓰지 않고, Netlify Function이 직접 아이디/비밀번호를 검증한 뒤
Supabase 프로젝트의 JWT Secret으로 토큰을 발급합니다.

- 학생 토큰: `sub = students.id`, `role: "authenticated"`
- 교사 토큰: `sub = teachers.id`, `role: "authenticated"`, `app_role: "teacher"`, `teacher_id: teachers.id`

`app_role` 클레임으로 학생/교사 권한을 구분하므로, RLS 정책도 이 값을 확인합니다
(`supabase_schema.sql` 실행 후 `webapp_teacher_patch.sql`도 반드시 실행해야 교사 로그인이
정상 작동합니다 - 아래 설정 순서 참고).

## 처음 설정하는 순서

### 1) Supabase

아래 순서대로 SQL을 실행합니다(전부 몇 번을 재실행해도 안전하게 작성돼 있습니다).

1. `supabase_schema.sql` - 테이블 + 기본 RLS 정책
2. `webapp_teacher_patch.sql` - 교사 로그인용 RLS 정책 보강
3. `webapp_patch2.sql` - 교사가 채점 결과를 수정했는지 표시하는 컬럼 추가
4. `webapp_patch3.sql` - 학생 로그인에 학교 선택 추가(학번을 "학교 단위"로 구분) (**신규, 꼭 실행**)
3. 문항 시드 데이터 (`items_전체_통합_시드.sql` 등, 이미 넣으셨다면 생략)
4. 이미지 연결 update문들 (`*_update.sql`, 이미 넣으셨다면 생략)

### 2) 환경변수 준비

`.env.example`을 복사해 `.env`로 만들고 값을 채웁니다.

```
cp .env.example .env
```

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: Supabase 프로젝트 Settings > API
- `SUPABASE_SERVICE_ROLE_KEY`: 같은 화면의 service_role 키 (절대 프론트엔드에 넣지 않기)
- `SUPABASE_JWT_SECRET`: Settings > API > JWT Settings의 Legacy JWT secret
- `GEMINI_API_KEY`: Google AI Studio에서 발급 (모델은 `GEMINI_MODEL`로 조정 가능)
- `ADMIN_SECRET`: 교사 계정이 하나도 없을 때 최초 교사 계정을 만들기 위한 비상용 키
- `TEACHER_SIGNUP_CODE`: 교사가 `/teacher/signup`에서 스스로 가입할 때 입력해야 하는 코드 (필요한 사람에게만 알려주기)
- `GEMINI_DAILY_ESTIMATED_LIMIT`: 교사 대시보드에 "오늘 전체 채점 건수 / 예상 한도"를 보여줄 때 쓰는 기준값(기본 300, 무료 키 상황에 맞게 조정 가능)

### 3) 로컬 설치 및 실행

```
npm install
cd netlify/functions && npm install && cd ../..
npm install -g netlify-cli   # 한 번만
netlify dev
```

`http://localhost:8888`로 접속합니다. (`npm run dev`만 쓰면 화면만 뜨고 로그인/채점이
동작하지 않습니다 - 반드시 `netlify dev`로 실행하세요.)

### 4) 테스트 계정 만들기

**학생 계정** (교사 계정을 먼저 만든 뒤, 그 학교명과 똑같이 맞춰서 넣어야 로그인 화면의
학교 목록에서 선택할 수 있습니다)

```
node scripts/hash-password.cjs 테스트비번1234
```

출력된 해시값을 TablePlus(SQL Editor)에서:

```sql
insert into public.students (student_number, password_hash, name, grade, school_name)
values ('10101', '<위에서 나온 해시>', '테스트학생', 1, '<교사 계정 만들 때 쓴 학교명과 정확히 동일하게>');
```

**교사 계정 만들기 - 두 가지 방법**

방법 A) **회원가입 화면 사용(권장)** — `/teacher/signup`에서 아이디/비밀번호/이름/학교명과
`.env`의 `TEACHER_SIGNUP_CODE`에 정해둔 가입 코드를 입력하면 바로 계정이 만들어집니다.
이 코드는 필요한 선생님에게만 알려주세요.

방법 B) SQL로 직접 만들기(최초 1명을 코드 공유 없이 만들고 싶을 때)

```
node scripts/hash-password.cjs 교사비번1234 teacher
```

출력된 안내를 참고해서:

```sql
insert into public.teachers (login_id, password_hash, name, school_name)
values ('teacher01', '<위에서 나온 해시>', '홍길동', '○○초등학교');
```

**학급 만들고 학생을 그 학급에 넣기** (교사가 로그인한 뒤 사용할 기능이지만,
지금은 SQL로 직접 만들어도 됩니다)

```sql
insert into public.classes (teacher_id, class_name, grade)
select id, '1반', 1 from public.teachers where login_id = 'teacher01'
returning id;
-- 위에서 나온 class id를 학생에게 연결
update public.students set class_id = '<위 class id>' where student_number = '10101';
```

이후 학생을 더 추가하고 싶으면 교사로 로그인한 상태에서
`POST /.netlify/functions/create-students`를 호출해도 됩니다(교사 토큰이면
`teacher_login_id` 없이 본인 학급으로 바로 생성됨).

### 5) 확인

- `http://localhost:8888/login` - 학생 로그인 후 문항 풀이/채점/해설 확인
- `http://localhost:8888/teacher/login` - 교사 로그인 후 학급별 학생 목록·평균 점수 확인

## Netlify 실제 배포 절차

1. **GitHub에 코드 올리기**: 이 `webapp` 폴더를 GitHub 저장소에 push(웹에서 드래그 업로드도 가능)
2. **Netlify에서 새 사이트 만들기**: Netlify 로그인 → "Add new site" → "Import an existing project"
   → 방금 만든 GitHub 저장소 선택 → Build command `npm run build`, Publish directory `dist`
   (모두 `netlify.toml`에 이미 지정돼 있어 자동으로 채워집니다)
3. **환경변수 등록**: Site configuration → Environment variables에서 `.env`에 채운 값들을
   그대로 하나씩 등록 (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `ADMIN_SECRET`,
   `TEACHER_SIGNUP_CODE`, `GEMINI_DAILY_ESTIMATED_LIMIT`)
4. **배포**: 저장하면 자동으로 빌드/배포가 시작됩니다. 완료되면 `https://무작위이름.netlify.app`
   주소가 생깁니다 - Site configuration에서 이름을 바꾸거나 커스텀 도메인을 연결할 수 있습니다.
5. **이후 업데이트**: GitHub 저장소에 새 코드를 push할 때마다 자동으로 재배포됩니다
   (로컬에서 코드를 고친 뒤, 같은 방식으로 GitHub에 다시 올리면 됩니다).

## 문항/이미지에 문제가 보이면

특정 문항의 텍스트가 깨져 보이거나 이미지가 잘못 연결된 경우, 해당 문항의 id와 무엇이
이상한지 알려주시면 그 항목만 다시 렌더링해서 이미지+SQL을 드릴 수 있습니다(전체를 다시
할 필요 없음).

## 아직 안 만든 것 (다음 단계 후보)

- 재시도(여러 번 풀기) 이력 비교, 학급 전체 통계/그래프
- 학생이 직접 비밀번호를 바꾸는 기능(현재는 교사가 대신 재설정)
- 문항 자체를 교사가 화면에서 새로 추가/수정하는 기능(지금은 SQL로만 가능)
