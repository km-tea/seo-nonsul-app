import React from "react";
import TableInput, { emptyTable } from "./TableInput.jsx";

// 답 한 칸: "글로 쓰기" / "표로 쓰기" 중 골라서 작성할 수 있다.
// value: { type: "text"|"table", text?: string, table?: {headers, rows} }
export default function AnswerBlock({ label, value, onChange }) {
  const type = value?.type || "text";

  function setType(newType) {
    if (newType === "table" && !value?.table) {
      onChange({ ...value, type: newType, table: emptyTable() });
    } else {
      onChange({ ...value, type: newType });
    }
  }

  return (
    <div className="answer-block-item">
      {label && <div className="answer-block-label">{label}</div>}
      <div className="answer-type-toggle">
        <button
          type="button"
          className={`toggle-chip ${type === "text" ? "active" : ""}`}
          onClick={() => setType("text")}
        >
          글로 쓰기
        </button>
        <button
          type="button"
          className={`toggle-chip ${type === "table" ? "active" : ""}`}
          onClick={() => setType("table")}
        >
          표로 쓰기
        </button>
      </div>
      {type === "table" ? (
        <TableInput
          value={value?.table}
          onChange={(table) => onChange({ ...value, type: "table", table })}
        />
      ) : (
        <textarea
          value={value?.text || ""}
          onChange={(e) => onChange({ ...value, type: "text", text: e.target.value })}
        />
      )}
    </div>
  );
}
