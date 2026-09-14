import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function TeacherSignupPage() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    login_id: "",
    password: "",
    name: "",
    school_name: "",
    signup_code: "",
  });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isLoggedIn) return <Navigate to="/" replace />;

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/.netlify/functions/teacher-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "가입에 실패했습니다.");
        return;
      }
      setDone(true);
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="login-card">
        <h1>가입 완료</h1>
        <p className="sub">
          <strong>{form.login_id}</strong> 아이디로 가입이 완료됐어요. 이제 로그인해 주세요.
        </p>
        <button className="btn-primary" onClick={() => navigate("/teacher/login")}>
          로그인하러 가기
        </button>
      </div>
    );
  }

  return (
    <div className="login-card">
      <h1>교사 회원가입</h1>
      <p className="sub">담당 관리자에게 받은 가입 코드가 필요해요.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login_id">아이디</label>
          <input
            id="login_id"
            value={form.login_id}
            onChange={(e) => update("login_id", e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="name">이름</label>
          <input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="school_name">학교명</label>
          <input
            id="school_name"
            value={form.school_name}
            onChange={(e) => update("school_name", e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="signup_code">가입 코드</label>
          <input
            id="signup_code"
            value={form.signup_code}
            onChange={(e) => update("signup_code", e.target.value)}
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "가입하는 중..." : "가입하기"}
        </button>
      </form>
      <p className="switch-role-link">
        이미 계정이 있으신가요? <Link to="/teacher/login">교사 로그인</Link>
      </p>
    </div>
  );
}
