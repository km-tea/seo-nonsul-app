import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function TeacherDashboardPage() {
  const { supabase, teacher, session } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadUsage() {
      try {
        const res = await fetch("/.netlify/functions/usage-status", {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const data = await res.json();
        if (!cancelled && res.ok) setUsage(data);
      } catch {
        // 사용량 표시는 실패해도 나머지 화면에는 영향 없게 조용히 넘어간다.
      }
    }
    loadUsage();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    async function loadClasses() {
      setLoading(true);
      setError("");
      const { data, error: err } = await supabase
        .from("classes")
        .select("id, class_name, grade")
        .order("grade", { ascending: true });
      if (cancelled) return;
      if (err) {
        setError("학급을 불러오지 못했습니다: " + err.message);
      } else {
        setClasses(data ?? []);
        if (data && data.length > 0) setSelectedClassId(data[0].id);
      }
      setLoading(false);
    }
    loadClasses();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    let cancelled = false;
    async function loadStudents() {
      setLoading(true);
      setError("");
      const { data, error: err } = await supabase
        .from("students")
        .select(
          "id, student_number, name, submissions(score, max_score, item_id, graded_at, items(title, subject))"
        )
        .eq("class_id", selectedClassId)
        .order("student_number", { ascending: true });
      if (cancelled) return;
      if (err) {
        setError("학생을 불러오지 못했습니다: " + err.message);
        setStudents([]);
      } else {
        setStudents(data ?? []);
      }
      setLoading(false);
    }
    loadStudents();
    return () => {
      cancelled = true;
    };
  }, [supabase, selectedClassId]);

  function downloadCsv() {
    const cls = classes.find((c) => c.id === selectedClassId);
    const rows = [["학번", "이름", "과목", "문항명", "점수", "만점", "채점일시"]];
    students.forEach((s) => {
      const subs = s.submissions ?? [];
      if (subs.length === 0) {
        rows.push([s.student_number, s.name, "", "", "", "", ""]);
        return;
      }
      subs.forEach((sub) => {
        rows.push([
          s.student_number,
          s.name,
          sub.items?.subject ?? "",
          sub.items?.title ?? "",
          sub.score ?? "",
          sub.max_score ?? "",
          sub.graded_at ? new Date(sub.graded_at).toLocaleString("ko-KR") : "",
        ]);
      });
    });
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `성적_${cls ? cls.grade + "학년_" + cls.class_name : "전체"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{teacher?.name ?? teacher?.login_id}님의 학급</h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 18 }}>{teacher?.school_name}</p>

      <div className="dashboard-actions">
        <Link to="/teacher/students/new" className="btn-secondary">
          + 학생 일괄 등록
        </Link>
        <Link to="/teacher/assignments" className="btn-secondary">
          과제 지정
        </Link>
        <Link to="/teacher/stats" className="btn-secondary">
          학급 통계
        </Link>
        <Link to="/teacher/settings" className="btn-secondary">
          내 계정 설정
        </Link>
        {students.length > 0 && (
          <button className="btn-secondary" onClick={downloadCsv}>
            성적 다운로드(CSV)
          </button>
        )}
      </div>

      {usage && <UsageBanner today={usage.today_count} limit={usage.estimated_daily_limit} />}

      {classes.length === 0 && !loading && (
        <div className="empty-state">
          아직 등록된 학급이 없어요. 학급과 학생 등록은 관리자에게 문의해 주세요.
        </div>
      )}

      {classes.length > 0 && (
        <div className="filters">
          {classes.map((c) => (
            <button
              key={c.id}
              className={`chip ${selectedClassId === c.id ? "active" : ""}`}
              onClick={() => setSelectedClassId(c.id)}
            >
              {c.grade}학년 {c.class_name}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="loading-line">불러오는 중...</p>}

      {!loading && students.length > 0 && (
        <table className="student-table">
          <thead>
            <tr>
              <th>학번</th>
              <th>이름</th>
              <th>제출 문항 수</th>
              <th>평균 점수</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const subs = s.submissions ?? [];
              const solvedItems = new Set(subs.map((x) => x.item_id)).size;
              const avg =
                subs.length > 0
                  ? Math.round((subs.reduce((sum, x) => sum + (x.score ?? 0), 0) / subs.length) * 10) / 10
                  : null;
              return (
                <tr key={s.id}>
                  <td>{s.student_number}</td>
                  <td>{s.name}</td>
                  <td>{solvedItems}</td>
                  <td>{avg != null ? `${avg}점` : "-"}</td>
                  <td>
                    <Link to={`/teacher/students/${s.id}`} className="btn-secondary table-view-btn">
                      보기
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {!loading && classes.length > 0 && students.length === 0 && !error && (
        <div className="empty-state">이 학급에는 아직 등록된 학생이 없어요.</div>
      )}
    </div>
  );
}

function UsageBanner({ today, limit }) {
  const ratio = limit > 0 ? today / limit : 0;
  const level = ratio >= 0.9 ? "danger" : ratio >= 0.6 ? "warn" : "ok";
  const messages = {
    ok: "오늘 AI 채점 사용량은 여유가 있어요.",
    warn: "오늘 AI 채점 사용량이 꽤 쌓였어요. 몰리는 시간대엔 채점이 잠깐 늦어질 수 있어요.",
    danger: "오늘 AI 채점 사용량이 무료 한도에 가까워요. 채점 오류가 늘어날 수 있어요.",
  };
  return (
    <div className={`usage-banner usage-${level}`}>
      <span className="usage-count">
        오늘 전체 채점 건수: {today}건 (예상 한도 약 {limit}건)
      </span>
      <span className="usage-message">{messages[level]}</span>
    </div>
  );
}
