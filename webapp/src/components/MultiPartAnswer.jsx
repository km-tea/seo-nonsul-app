import React from "react";
import AnswerBlock from "./AnswerBlock.jsx";

export const emptyPart = () => ({ type: "text", text: "" });

// mode="auto": 문항에 미리 정해진 조건(labels) 개수만큼 답 칸을 고정으로 보여준다(추가/삭제 없음).
// mode="manual": 답 칸 1개로 시작하고, 학생이 "+ 답 칸 추가"로 직접 늘릴 수 있다(이미지 문항처럼
// 조건이 데이터로 안 잡혀 있는 경우).
export default function MultiPartAnswer({ mode, labels, parts, setParts }) {
  function updatePart(i, newVal) {
    setParts((prev) => prev.map((p, idx) => (idx === i ? newVal : p)));
  }
  function addPart() {
    setParts((prev) => [...prev, emptyPart()]);
  }
  function removePart(i) {
    setParts((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="multipart-answer">
      {parts.map((p, i) => (
        <div key={i} className="multipart-row">
          <AnswerBlock
            label={mode === "auto" ? `${i + 1}. ${labels?.[i] || ""}` : `답 ${i + 1}`}
            value={p}
            onChange={(v) => updatePart(i, v)}
          />
          {mode === "manual" && parts.length > 1 && (
            <button type="button" className="remove-part-btn" onClick={() => removePart(i)}>
              이 답 칸 삭제
            </button>
          )}
        </div>
      ))}
      {mode === "manual" && (
        <button type="button" className="btn-secondary add-part-btn" onClick={addPart}>
          + 답 칸 추가
        </button>
      )}
    </div>
  );
}
