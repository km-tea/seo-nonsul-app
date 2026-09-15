import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// 교사가 학급 이름/학년과, 줄바꿈으로 구분된 "학번,이름,비밀번호" 목록을 입력하면
// 한 번에 학급+학생 계정을 만든다. 학교 구분은 이 교사 계정 자체(teachers.school_name)에
// 이미 들어있으므로 여기서 따로 입력받지 않는다 - 로그인 화면에도 학교 선택은 없다.
export default function TeacherAddStudentsPage() {
  const { session, teacher } = useAuth();
  const [className, setClassName] = useState("");
  const [grade, setGrade] = useState("");
  const [schoolLevel, setSchoolLevel] = useState("초등학교");
  const [rawList, setRawList] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function parseRows(text) {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(",").map((s) => s.trim());
        const [student_number, name, password] = parts;
        return { student_number, name, password };
      });
  }

  const preview = parseRows(rawList);
  const previewErrors = preview.filter((p) => !p.student_number || !p.password);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!className.trim()) {
      setError("학급 이름을 입력해 주세요.");
      return;
    }
    if (preview.length === 0) {
      setError("학생을 한 명 이상 입력해 주세요.");
      return;
    }
    if (previewErrors.length > 0) {
      setError("학번과 비밀번호가 비어있는 줄이 있어요. '학번,이름,비밀번호' 형식을 확인해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/.netlify/functions/create-students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          class_name: className,
          grade: grade ? Number(grade) : null,
          school_level: schoolLevel,
          students: preview,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "학생 등록 중 문제가 생겼습니다.");
        return;
      }
      setResult({ created: data.created, failures: data.failures || [] });
      setClassName("");
      setGrade("");
      setRawList("");
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link to="/teacher" className="btn-secondary" style={{ display: "inline-block", marginBottom: 18 }}>
        ← 대시보드로
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>학생 일괄 등록</h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 18 }}>
        {teacher?.school_name} 소속으로 등록됩니다. 학생은 로그인할 때 학교를 따로 고르지 않고
        학번과 비밀번호만 입력하면 돼요.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="className">학급 이름</label>
          <input
            id="className"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="예: 3반"
          />
        </div>
        <div className="field">
          <label htmlFor="schoolLevel">학교급 (과제 지정 시 이 학교급 문항만 고를 수 있어요)</label>
          <select id="schoolLevel" value={schoolLevel} onChange={(e) => setSchoolLevel(e.target.value)}>
            <option value="초등학교">초등학교</option>
            <option value="중학교">중학교</option>
            <option value="고등학교">고등학교</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="grade">학년(선택)</label>
          <input
            id="grade"
            type="number"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="예: 6"
          />
        </div>
        <div className="field">
          <label htmlFor="rawList">학생 목록 — 한 줄에 한 명씩, "학번,이름,비밀번호"</label>
          <textarea
            id="rawList"
            value={rawList}
            onChange={(e) => setRawList(e.target.value)}
            placeholder={"60101,김민준,1234\n60102,이서연,5678\n60103,박도윤,9012"}
            style={{ minHeight: 200, fontFamily: "monospace" }}
          />
        </div>

        {preview.length > 0 && (
          <div className="explain-section">
            <h3>미리보기 ({preview.length}명)</h3>
            <table className="student-table">
              <thead>
                <tr>
                  <th>학번</th>
                  <th>이름</th>
                  <th>비밀번호</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i}>
                    <td style={{ color: p.student_number ? "inherit" : "var(--red)" }}>
                      {p.student_number || "(비어있음)"}
                    </td>
                    <td>{p.name || "-"}</td>
                    <td style={{ color: p.password ? "inherit" : "var(--red)" }}>
                      {p.password || "(비어있음)"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <div className="submit-row">
          <button className="btn-primary" style={{ width: "auto" }} type="submit" disabled={submitting}>
            {submitting ? "등록하는 중..." : "일괄 등록"}
          </button>
        </div>
      </form>

      {result && (
        <div className="explain-section">
          <h3>등록 완료 ({result.created.length}명)</h3>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 10 }}>
            학생들에게 학번과 방금 입력한 비밀번호를 알려주세요(비밀번호는 암호화되어 저장되므로
            여기서 다시 확인할 수 없어요 — 나눠준 목록을 따로 보관해 두시는 걸 권장합니다).
          </p>
          {result.created.length > 0 && (
            <table className="student-table">
              <thead>
                <tr>
                  <th>학번</th>
                  <th>이름</th>
                </tr>
              </thead>
              <tbody>
                {result.created.map((r) => (
                  <tr key={r.id}>
                    <td>{r.student_number}</td>
                    <td>{r.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {result.failures.length > 0 && (
            <>
              <h3 style={{ color: "var(--red)" }}>등록 실패 ({result.failures.length}명)</h3>
              <table className="student-table">
                <thead>
                  <tr>
                    <th>학번</th>
                    <th>사유</th>
                  </tr>
                </thead>
                <tbody>
                  {result.failures.map((f, i) => (
                    <tr key={i}>
                      <td>{f.student_number}</td>
                      <td style={{ color: "var(--red)" }}>{f.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
