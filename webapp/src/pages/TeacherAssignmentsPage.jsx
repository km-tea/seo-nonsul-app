import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const SUBJECTS = ["국어", "수학", "영어", "사회", "과학", "도덕", "음악", "미술", "체육", "실과", "학교자율시간"];

const LEVEL_TO_GRADE_BANDS = {
  초등학교: ["3-4", "5-6"],
  중학교: ["중학교"],
  고등학교: ["고등학교"],
};

export default function TeacherAssignmentsPage() {
  const { supabase, session } = useAuth();
  const [searchParams] = useSearchParams();
  const presetClassId = searchParams.get("class_id");

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(presetClassId || "");
  const [assignments, setAssignments] = useState([]);

  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedClass = classes.find((c) => c.id === classId);

  useEffect(() => {
    supabase
      .from("classes")
      .select("id, class_name, grade, school_level")
      .order("grade", { ascending: true })
      .then(({ data }) => {
        setClasses(data ?? []);
        if (!classId && data && data.length > 0) setClassId(data[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    if (!classId) return;
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function loadAssignments() {
    const { data } = await supabase
      .from("assignments")
      .select("id, title, due_date, created_at, assignment_items(item_id, items(title))")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });
    setAssignments(data ?? []);
  }

  useEffect(() => {
    if (!selectedClass) return;
    let cancelled = false;
    async function search() {
      let q = supabase.from("items").select("id, title, domain, grade_band").eq("subject", subject);
      const bands = LEVEL_TO_GRADE_BANDS[selectedClass.school_level];
      if (bands) q = q.in("grade_band", bands);
      if (keyword.trim()) q = q.ilike("title", `%${keyword.trim()}%`);
      const { data } = await q.order("id", { ascending: true }).limit(50);
      if (!cancelled) setItems(data ?? []);
    }
    search();
    return () => {
      cancelled = true;
    };
  }, [supabase, subject, keyword, selectedClass]);

  function toggleItem(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleCreate() {
    setError("");
    setMsg("");
    if (selectedIds.length === 0) {
      setError("문항을 한 개 이상 골라주세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/.netlify/functions/create-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ class_id: classId, item_ids: selectedIds, title, due_date: dueDate || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "과제 생성에 실패했습니다.");
        return;
      }
      setMsg("과제를 냈어요!");
      setSelectedIds([]);
      setTitle("");
      setDueDate("");
      loadAssignments();
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link to="/teacher" className="btn-secondary" style={{ display: "inline-block", marginBottom: 18 }}>
        ← 대시보드로
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 18 }}>과제 지정</h1>

      <div className="field">
        <label htmlFor="classSelect">학급</label>
        <select id="classSelect" value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.grade}학년 {c.class_name} ({c.school_level || "학교급 미지정"})
            </option>
          ))}
        </select>
      </div>

      {selectedClass && !selectedClass.school_level && (
        <p className="missing-content-note">
          이 학급은 학교급이 지정 안 되어 있어서, 모든 학교급 문항이 다 보여요. 학생 등록 화면에서
          학교급을 지정하면 그 학교급 문항만 보이게 좁혀져요.
        </p>
      )}

      <div className="explain-section">
        <h3>새 과제 만들기</h3>
        <div className="field">
          <label htmlFor="assignTitle">과제 제목(선택)</label>
          <input id="assignTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 이번 주 국어 과제" />
        </div>
        <div className="field">
          <label htmlFor="dueDate">마감일(선택)</label>
          <input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div className="filters">
          {SUBJECTS.map((s) => (
            <button key={s} className={`chip ${subject === s ? "active" : ""}`} onClick={() => setSubject(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="field">
          <input
            placeholder="문항 제목으로 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <ul className="item-list">
          {items.map((item) => (
            <li key={item.id}>
              <label className="item-row assignment-pick-row">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleItem(item.id)}
                />
                <div className="item-main">
                  <div className="item-domain">{item.domain || item.grade_band}</div>
                  <div className="item-title">{item.title}</div>
                </div>
              </label>
            </li>
          ))}
        </ul>
        {items.length === 0 && <p className="loading-line">조건에 맞는 문항이 없어요.</p>}

        <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>{selectedIds.length}개 선택됨</p>

        {error && <p className="error-text">{error}</p>}
        {msg && <p style={{ color: "var(--sage)", fontSize: 13 }}>{msg}</p>}

        <div className="submit-row">
          <button className="btn-primary" style={{ width: "auto" }} onClick={handleCreate} disabled={saving}>
            {saving ? "만드는 중..." : "이 문항들로 과제 내기"}
          </button>
        </div>
      </div>

      <div className="explain-section">
        <h3>이 학급에 낸 과제들</h3>
        {assignments.length === 0 && <p className="loading-line">아직 낸 과제가 없어요.</p>}
        {assignments.map((a) => (
          <div key={a.id} className="submission-card">
            <div className="submission-card-head">
              <div>
                <div className="item-title">{a.title || "(제목 없음)"}</div>
                <div className="item-domain">
                  {a.due_date ? `마감: ${a.due_date}` : "마감일 없음"} · 문항 {a.assignment_items?.length ?? 0}개
                </div>
              </div>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {(a.assignment_items || []).map((ai) => (
                <li key={ai.item_id} style={{ fontSize: 14 }}>
                  {ai.items?.title}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
