import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
  const { isLoggedIn, loginAsStudent } = useAuth();
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isLoggedIn) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/.netlify/functions/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_number: studentNumber, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "로그인에 실패했습니다.");
        return;
      }
      loginAsStudent(data.token, data.student);
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-card">
      <h1>서논술형 학습장</h1>
      <p className="sub">학번과 비밀번호로 로그인하세요.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="student_number">학번</label>
          <input
            id="student_number"
            value={studentNumber}
            onChange={(e) => setStudentNumber(e.target.value)}
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
        선생님이신가요? <Link to="/teacher/login">교사 로그인</Link>
      </p>
    </div>
  );
}
