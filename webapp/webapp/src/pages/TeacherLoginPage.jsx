import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function TeacherLoginPage() {
  const { isLoggedIn, isTeacher, loginAsTeacher } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isLoggedIn && isTeacher) return <Navigate to="/teacher" replace />;
  if (isLoggedIn && !isTeacher) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/.netlify/functions/teacher-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_id: loginId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "로그인에 실패했습니다.");
        return;
      }
      loginAsTeacher(data.token, data.teacher);
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-card">
      <h1>교사 로그인</h1>
      <p className="sub">아이디와 비밀번호로 로그인하세요.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login_id">아이디</label>
          <input
            id="login_id"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "확인하는 중..." : "로그인"}
        </button>
      </form>
      <p className="switch-role-link">
        학생인가요? <Link to="/login">학생 로그인</Link>
      </p>
    </div>
  );
}
