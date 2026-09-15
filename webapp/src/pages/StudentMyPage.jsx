import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function StudentMyPage() {
  const { supabase, student } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const { data, error: err } = await supabase
        .from("submissions")
        .select("id, item_id, score, max_score, graded_at, items(title, subject, domain)")
        .order("graded_at", { ascending: false });
      if (cancelled) return;
      if (err) {
        setError("불러오지 못했습니다: " + err.message);
      } else {
        setSubmissions(data ?? []);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const solvedItems = new Set(submissions.map((s) => s.item_id)).size;
  const overallAvg =
    submissions.length > 0
      ? Math.round((submissions.reduce((sum, s) => sum + (s.score ?? 0), 0) / submissions.length) * 10) / 10
      : null;

  const bySubject = {};
  submissions.forEach((s) => {
    const subj = s.items?.subject || "기타";
    if (!bySubject[subj]) bySubject[subj] = [];
    bySubject[subj].push(s);
  });

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{student?.name ?? student?.student_number}님의 마이페이지</h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 20 }}>
        지금까지 푼 문항과 점수를 한눈에 볼 수 있어요.
      </p>

      <div className="mypage-summary">
        <div className="mypage-stat">
          <div className="mypage-stat-num">{solvedItems}</div>
          <div className="mypage-stat-label">푼 문항 수</div>
        </div>
        <div className="mypage-stat">
          <div className="mypage-stat-num">{overallAvg != null ? overallAvg : "-"}</div>
          <div className="mypage-stat-label">전체 평균 점수</div>
        </div>
      </div>

      {Object.keys(bySubject).length > 0 && (
        <div className="mypage-subject-grid">
          {Object.entries(bySubject).map(([subj, subs]) => {
            const avg =
              Math.round((subs.reduce((sum, s) => sum + (s.score ?? 0), 0) / subs.length) * 10) / 10;
            return (
              <div className="mypage-subject-card" key={subj}>
                <div className="mypage-subject-name">{subj}</div>
                <div className="mypage-subject-avg">{avg}점</div>
                <div className="mypage-subject-count">{subs.length}회 제출</div>
              </div>
            );
          })}
        </div>
      )}

      {loading && <p className="loading-line">불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && submissions.length === 0 && (
        <div className="empty-state">아직 푼 문항이 없어요. 문항을 풀어보세요!</div>
      )}

      {!loading && submissions.length > 0 && (
        <ul className="item-list">
          {submissions.map((s) => (
            <li key={s.id}>
              <Link className="item-row" to={`/items/${s.item_id}/explain`}>
                <div className="item-main">
                  <div className="item-domain">{s.items?.subject} · {s.items?.domain}</div>
                  <div className="item-title">{s.items?.title}</div>
                </div>
                <span className="status-badge done">
                  {s.score ?? "-"} / {s.max_score ?? "?"}점
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
