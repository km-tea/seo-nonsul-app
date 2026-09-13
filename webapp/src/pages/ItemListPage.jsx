import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const SUBJECTS = ["국어", "수학", "영어", "사회", "과학", "도덕", "음악", "미술", "체육", "실과", "학교자율시간"];
const GRADE_BANDS = [
  { label: "전체", value: "" },
  { label: "3~4학년", value: "3-4" },
  { label: "5~6학년", value: "5-6" },
  { label: "중학교", value: "중학교" },
  { label: "고등학교", value: "고등학교" },
];

export default function ItemListPage() {
  const { supabase } = useAuth();
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [gradeBand, setGradeBand] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      let query = supabase
        .from("items")
        .select("id, grade, grade_band, subject, domain, title, submissions(score, attempt_no)")
        .eq("subject", subject)
        .order("grade", { ascending: true })
        .order("id", { ascending: true });

      if (gradeBand) query = query.eq("grade_band", gradeBand);

      const { data, error: err } = await query;
      if (cancelled) return;
      if (err) {
        setError("문항을 불러오지 못했습니다: " + err.message);
        setItems([]);
      } else {
        setItems(data ?? []);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, subject, gradeBand]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 18 }}>오늘은 어떤 문제를 풀어볼까요?</h1>

      <div className="filters">
        {SUBJECTS.map((s) => (
          <button
            key={s}
            className={`chip ${subject === s ? "active" : ""}`}
            onClick={() => setSubject(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="filters">
        {GRADE_BANDS.map((g) => (
          <button
            key={g.value}
            className={`chip ${gradeBand === g.value ? "active" : ""}`}
            onClick={() => setGradeBand(g.value)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {loading && <p className="loading-line">불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="empty-state">이 조건에 맞는 문항이 아직 없어요. 다른 과목이나 학년을 골라보세요.</div>
      )}

      {!loading && items.length > 0 && (
        <ul className="item-list">
          {items.map((item) => {
            const attempts = item.submissions ?? [];
            const done = attempts.length > 0;
            const best = done ? Math.max(...attempts.map((a) => a.score ?? 0)) : null;
            return (
              <li key={item.id}>
                <Link className="item-row" to={`/items/${item.id}/solve`}>
                  <div className="item-main">
                    <div className="item-domain">{item.domain || item.grade_band}</div>
                    <div className="item-title">{item.title || "제목 없음"}</div>
                  </div>
                  <span className={`status-badge ${done ? "done" : "todo"}`}>
                    {done ? `풀었어요${best != null ? ` · ${best}점` : ""}` : "안 풀었어요"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
