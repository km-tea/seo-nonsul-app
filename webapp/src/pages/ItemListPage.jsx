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
  const { supabase, student } = useAuth();
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [gradeBand, setGradeBand] = useState("");
  const [keyword, setKeyword] = useState("");
  const [bookmarkOnly, setBookmarkOnly] = useState(false);
  const [items, setItems] = useState([]);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("bookmarks")
      .select("item_id")
      .then(({ data }) => setBookmarkedIds(new Set((data ?? []).map((b) => b.item_id))));
  }, [supabase]);

  useEffect(() => {
    supabase
      .from("assignments")
      .select("id, title, due_date, assignment_items(item_id, items(title, subject, domain))")
      .order("due_date", { ascending: true })
      .then(({ data }) => setAssignments(data ?? []));
  }, [supabase]);

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
      if (keyword.trim()) query = query.ilike("title", `%${keyword.trim()}%`);

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
  }, [supabase, subject, gradeBand, keyword]);

  async function toggleBookmark(itemId, e) {
    e.preventDefault();
    e.stopPropagation();
    const isBookmarked = bookmarkedIds.has(itemId);
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isBookmarked) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
    if (isBookmarked) {
      await supabase.from("bookmarks").delete().eq("item_id", itemId).eq("student_id", student.id);
    } else {
      await supabase.from("bookmarks").insert({ item_id: itemId, student_id: student.id });
    }
  }

  const visibleItems = bookmarkOnly ? items.filter((it) => bookmarkedIds.has(it.id)) : items;

  // 과제 안의 문항이 이미 풀렸는지 확인하기 위해, 과제 아이템에도 submissions 정보가 필요하다.
  // 목록 화면에서 가져온 items의 submissions만으론 다른 과목 과제 문항을 커버 못 하므로,
  // 과제 문항 각각은 별도로 "이미 푼 문항 id" 집합을 구해 표시한다.
  const [solvedItemIds, setSolvedItemIds] = useState(new Set());
  useEffect(() => {
    supabase
      .from("submissions")
      .select("item_id")
      .then(({ data }) => setSolvedItemIds(new Set((data ?? []).map((s) => s.item_id))));
  }, [supabase]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 18 }}>오늘은 어떤 문제를 풀어볼까요?</h1>

      {assignments.length > 0 && (
        <div className="assignments-box">
          <div className="assignments-box-title">📌 이번 과제</div>
          {assignments.map((a) => (
            <div key={a.id} className="assignment-item-group">
              <div className="assignment-item-group-head">
                {a.title || "과제"} {a.due_date && <span className="assignment-due">마감 {a.due_date}</span>}
              </div>
              {(a.assignment_items || []).map((ai) => (
                <Link key={ai.item_id} to={`/items/${ai.item_id}/solve`} className="assignment-link-row">
                  <span>{ai.items?.title}</span>
                  <span className={`status-badge ${solvedItemIds.has(ai.item_id) ? "done" : "todo"}`}>
                    {solvedItemIds.has(ai.item_id) ? "풀었어요" : "안 풀었어요"}
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}

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
        <button
          className={`chip ${bookmarkOnly ? "active" : ""}`}
          onClick={() => setBookmarkOnly((v) => !v)}
        >
          ★ 즐겨찾기만
        </button>
      </div>
      <div className="field" style={{ marginBottom: 18 }}>
        <input
          placeholder="문항 제목으로 검색"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      {loading && <p className="loading-line">불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && visibleItems.length === 0 && (
        <div className="empty-state">이 조건에 맞는 문항이 아직 없어요. 다른 과목이나 학년을 골라보세요.</div>
      )}

      {!loading && visibleItems.length > 0 && (
        <ul className="item-list">
          {visibleItems.map((item) => {
            const attempts = item.submissions ?? [];
            const done = attempts.length > 0;
            const best = done ? Math.max(...attempts.map((a) => a.score ?? 0)) : null;
            const isBookmarked = bookmarkedIds.has(item.id);
            return (
              <li key={item.id}>
                <Link className="item-row" to={`/items/${item.id}/solve`}>
                  <button
                    type="button"
                    className={`bookmark-star ${isBookmarked ? "active" : ""}`}
                    onClick={(e) => toggleBookmark(item.id, e)}
                    aria-label="즐겨찾기"
                  >
                    {isBookmarked ? "★" : "☆"}
                  </button>
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
