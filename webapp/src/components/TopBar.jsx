import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function TopBar() {
  const { student, teacher, isTeacher, logout } = useAuth();
  const homeHref = isTeacher ? "/teacher" : "/";
  const displayName = isTeacher
    ? teacher?.name ?? teacher?.login_id
    : student?.name ?? student?.student_number;

  return (
    <div className="topbar">
      <Link to={homeHref} className="brand" style={{ textDecoration: "none", color: "inherit" }}>
        서논술형 학습장{isTeacher ? " · 교사용" : ""}
      </Link>
      <div className="who">
        {!isTeacher && <Link to="/mypage">마이페이지</Link>}
        <span>{displayName}님</span>
        <button onClick={logout}>로그아웃</button>
      </div>
    </div>
  );
}
