// items 테이블은 세 가지 서로 다른 소스가 섞여 있어 문항마다 내용이 들어있는
// 컬럼이 다르다. 여기서 어떤 모양인지 판별해서 화면 렌더링 방식을 나눈다.
//
// 1) raw_content 있음  -> 중고등(KICE 자료집 / 경기·정기시험) 문항.
//    raw_content = { 평가개요, 문항정보, 평가문항, 채점기준표, 채점유의점, 예시답안, 피드백유의점 }
// 2) staged_questions 있음 -> 초등 3~4학년 스캐폴딩(3단계) 문항.
//    staged_questions = [{ stage, label, points, prompt, conditions?, rubric_elements? }, ...]
// 3) question 있음 -> 초등 5~6학년 직접형 문항.
//    question = { prompt, conditions }, scoring_5_6 = { base_score, min_criteria }
// 4) 위 세 가지가 다 없고 stimulus_images만 있음 -> 텍스트 지문 없이 스캔 이미지로만
//    제공되는 문항(2026 중등 정기시험 자료 일부). 문제/채점기준이 전부 이미지 안에 있다.

export function getItemShape(item) {
  if (!item) return "unknown";
  if (item.raw_content) return "raw_content";
  if (item.staged_questions && item.staged_questions.length > 0) return "staged";
  if (item.question) return "direct";
  if (item.stimulus_images && item.stimulus_images.length > 0) return "image_only";
  return "unknown";
}
