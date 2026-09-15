import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function TeacherSettingsPage() {
  const { session, teacher } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    setSaving(true);
    try {
      const res = await fetch("/.netlify/functions/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ target: "self", old_password: oldPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "변경에 실패했습니다.");
        return;
      }
      setMsg("비밀번호가 바뀌었어요.");
      setOldPassword("");
      setNewPassword("");
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
      <div className="login-card" style={{ margin: "0 auto" }}>
        <h1>내 계정 설정</h1>
        <p className="sub">
          {teacher?.name} ({teacher?.login_id}) · {teacher?.school_name}
        </p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="old_password">현재 비밀번호</label>
            <input
              id="old_password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new_password">새 비밀번호</label>
            <input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          {msg && <p style={{ color: "var(--sage)", fontSize: 13, marginTop: -8, marginBottom: 16 }}>{msg}</p>}
          {error && <p className="error-text">{error}</p>}
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? "변경하는 중..." : "비밀번호 변경"}
          </button>
        </form>
      </div>
    </div>
  );
}
