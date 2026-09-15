import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import TextBlock from "../components/TextBlock.jsx";

export default function TeacherStudentDetailPage() {
  const { studentId } = useParams();
  const { supabase, session } = useAuth();

  const [student, setStudent] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const [{ data: stu, error: stuErr }, { data: subs, error: subErr }] = await Promise.all([
      supabase.from("students").select("id, student_number, name, grade").eq("id", studentId).maybeSingle(),
      supabase
        .from("submissions")
        .select("id, item_id, answer_text, score, max_score, ai_feedback, teacher_edited, attempt_no, graded_at, items(title, subject, domain)")
        .eq("student_id", studentId)
        .order("graded_at", { ascending: false }),
    ]);
    if (stuErr || subErr) {
      setError("불러오지 못했습니다: " + (stuErr?.message || subErr?.message));
    } else {
      setStudent(stu);
      setSubmissions(subs ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  if (loading) return <p className="loading-line">불러오는 중...</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!student) return null;

  return (
    <div>
      <Link to="/teacher" className="btn-secondary" style={{ display: "inline-block", marginBottom: 18 }}>
        ← 목록으로
      </Link>

      <h1 style={{ fontSize: 20, marginBottom: 4 }}>
        {student.name} <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>({student.student_number})</span>
      </h1>

      <button className="btn-secondary" style={{ marginBottom: 20 }} onClick={() => setResetOpen((v) => !v)}>
        비밀번호 재설정
      </button>
      {resetOpen && (
        <ResetPasswordForm
          studentId={student.id}
          session={session}
          onDone={() => setResetOpen(false)}
        />
      )}

      {submissions.length === 0 && <div className="empty-state">아직 제출한 문항이 없어요.</div>}

      {submissions.map((s) => (
        <SubmissionCard key={s.id} submission={s} session={session} onSaved={load} />
      ))}
    </div>
  );
}

function ResetPasswordForm({ studentId, session, onDone }) {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/.netlify/functions/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ target: "student", student_id: studentId, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "실패했습니다.");
        return;
      }
      setMsg(`새 비밀번호로 변경됐어요: "${password}" — 학생에게 알려주세요.`);
      setPassword("");
    } catch {
      setMsg("서버에 연결할 수 없습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="inline-form">
      <input
        type="text"
        placeholder="새 비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button className="btn-primary" style={{ width: "auto" }} type="submit" disabled={saving}>
        {saving ? "저장 중..." : "저장"}
      </button>
      {msg && <p className="inline-form-msg">{msg}</p>}
    </form>
  );
}

function SubmissionCard({ submission, session, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState(submission.score ?? "");
  const [maxScore, setMaxScore] = useState(submission.max_score ?? "");
  const [feedback, setFeedback] = useState(submission.ai_feedback ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/.netlify/functions/update-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          submission_id: submission.id,
          score: score === "" ? null : Number(score),
          max_score: maxScore === "" ? null : Number(maxScore),
          feedback,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "저장 실패");
        return;
      }
      setEditing(false);
      onSaved();
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="submission-card">
      <div className="submission-card-head">
        <div>
          <div className="item-domain">{submission.items?.subject} · {submission.items?.domain}</div>
          <div className="item-title">{submission.items?.title}</div>
        </div>
        <div className="submission-score">
          {submission.score ?? "-"} / {submission.max_score ?? "?"}점
          {submission.teacher_edited && <span className="edited-badge">교사 수정됨</span>}
        </div>
      </div>

      <div className="explain-section">
        <h3>학생 답안</h3>
        <div className="answer-block">
          <TextBlock text={submission.answer_text} />
        </div>
      </div>

      {!editing ? (
        <>
          <div className="explain-section">
            <h3>AI 피드백</h3>
            <div className="feedback-block">
              <TextBlock text={submission.ai_feedback} />
            </div>
          </div>
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            점수/피드백 수정
          </button>
        </>
      ) : (
        <div className="edit-submission-form">
          <div className="edit-score-row">
            <label>
              점수
              <input type="number" value={score} onChange={(e) => setScore(e.target.value)} />
            </label>
            <label>
              만점
              <input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
            </label>
          </div>
          <label className="edit-feedback-label">
            피드백
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </label>
          {error && <p className="error-text">{error}</p>}
          <div className="submit-row">
            <button className="btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
              취소
            </button>
            <button className="btn-primary" style={{ width: "auto" }} onClick={save} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
