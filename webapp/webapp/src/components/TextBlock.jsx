import React from "react";

// 원문 PDF에서 한 줄 폭에 맞춰 줄바꿈되어 있던 흔적(문장이 끝나지 않았는데 줄이 바뀐 것)을
// 화면에 그대로 보여주면 문장 중간이 뚝뚝 끊긴 것처럼 보인다. 아래 규칙으로 정리한다.
//  - 이전 줄이 문장을 끝맺는 기호(다./요./:. 등)로 끝나면 -> 줄바꿈 유지(새 문장/조건)
//  - 다음 줄이 목록 표시(•, -, ①, 1), <, [ 등)로 시작하면 -> 줄바꿈 유지(새 항목)
//  - 그 외(문장이 안 끝났는데 줄만 바뀐 경우) -> 공백으로 이어붙임(원래 한 문장)
function normalizeSoftWraps(text) {
  const lines = String(text).split("\n");
  const result = [];
  for (const rawLine of lines) {
    if (result.length === 0) {
      result.push(rawLine);
      continue;
    }
    const prev = result[result.length - 1];
    const prevTrim = prev.trimEnd();
    const curTrim = rawLine.trim();
    const eitherLooksLikeTable = /( {3,}|\t)/.test(rawLine) || / {3,}|\t/.test(prev);
    const prevEndsSentence = prevTrim === "" || /[.!?다요임함됨:)〉」』】"'”’]\s*$/.test(prevTrim);
    const curStartsNewItem =
      curTrim === "" || /^([•∙\-*]|[①-⑩]|\d+[).]|[가-힣]\)|[<\[])/.test(curTrim);
    if (eitherLooksLikeTable || prevEndsSentence || curStartsNewItem) {
      result.push(rawLine);
    } else {
      result[result.length - 1] = prev.replace(/\s+$/, "") + " " + curTrim;
    }
  }
  return result.join("\n");
}

// 문항 원문에는 스페이스로 줄을 맞춘 표(조어법 유형표 같은 것)가 섞여 있는 경우가 있다.
// 일반 글꼴로 그대로 보여주면 정렬이 다 깨지므로, 문단 단위로 나눠서
// "표처럼 보이는 문단"(공백 3칸 이상 또는 탭이 있는 문단)만 고정폭 글꼴로 보여준다.
export default function TextBlock({ text }) {
  if (!text) return null;
  const normalized = normalizeSoftWraps(text);
  const paragraphs = normalized.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((p, i) => {
        const looksLikeTable = /( {3,}|\t)/.test(p);
        return (
          <p key={i} className={looksLikeTable ? "mono-block" : "text-block"}>
            {p}
          </p>
        );
      })}
    </>
  );
}

