import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function TeacherClassStatsPage() {
  const { supabase, session } = useAuth();
  const [searchParams] = useSearchParams();
  const presetClassId = searchParams.get("class_id");

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(presetClassId || "");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("classes")
      .select("id, class_name, grade")
      .order("grade", { ascending: true })
      .then(({ data }) => {
        setClasses(data ?? []);
        if (!classId && data && data.length > 0) setClassId(data[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/.netlify/functions/class-stats?class_id=${classId}`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const data = await res.json();
        if (!cancelled) {
          if (!res.ok) setError(data.error || "통계를 불러오지 못했습니다.");
          else setItems(data.items);
        }
      } catch {
        if (!cancelled) setError("서버에 연결할 수 없습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [classId, session]);

  return (
    <div>
      <Link to="/teacher" className="btn-secondary" style={{ display: "inline-block", marginBottom: 18 }}>
        ← 대시보드로
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 18 }}>학급 통계</h1>

      <div className="field">
        <label htmlFor="classSelect">학급</label>
        <select id="classSelect" value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.grade}학년 {c.class_name}
            </option>
          ))}
        </select>
      </div>

      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>
        평균 점수가 낮은 문항부터 보여줘요 — 반 전체가 어려워하는 부분을 짚어보는 데 참고하세요.
      </p>

      {loading && <p className="loading-line">불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && items.length === 0 && !error && (
        <div className="empty-state">아직 제출된 답안이 없어요.</div>
      )}

      {items.map((it) => (
        <div key={it.item_id} className="stats-row">
          <div className="stats-bar-track">
            <div
              className={`stats-bar-fill ${it.avg_percent < 50 ? "low" : it.avg_percent < 75 ? "mid" : "high"}`}
              style={{ width: `${it.avg_percent}%` }}
            />
          </div>
          <div className="stats-row-info">
            <div>
              <span className="item-domain">{it.subject}</span>
              <div className="item-title">{it.title}</div>
            </div>
            <div className="stats-row-pct">
              {it.avg_percent}% <span className="stats-row-attempts">({it.attempts}건)</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
