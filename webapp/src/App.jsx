import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import TopBar from "./components/TopBar.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import TeacherLoginPage from "./pages/TeacherLoginPage.jsx";
import TeacherSignupPage from "./pages/TeacherSignupPage.jsx";
import TeacherDashboardPage from "./pages/TeacherDashboardPage.jsx";
import TeacherAddStudentsPage from "./pages/TeacherAddStudentsPage.jsx";
import TeacherStudentDetailPage from "./pages/TeacherStudentDetailPage.jsx";
import TeacherSettingsPage from "./pages/TeacherSettingsPage.jsx";
import StudentMyPage from "./pages/StudentMyPage.jsx";
import ItemListPage from "./pages/ItemListPage.jsx";
import SolvePage from "./pages/SolvePage.jsx";
import ExplainPage from "./pages/ExplainPage.jsx";

function RequireStudent({ children }) {
  const { isLoggedIn, isStudent } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!isStudent) return <Navigate to="/teacher" replace />;
  return children;
}

function RequireTeacher({ children }) {
  const { isLoggedIn, isTeacher } = useAuth();
  if (!isLoggedIn) return <Navigate to="/teacher/login" replace />;
  if (!isTeacher) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { isLoggedIn } = useAuth();

  return (
    <div className="app-shell">
      {isLoggedIn && <TopBar />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/teacher/login" element={<TeacherLoginPage />} />
        <Route path="/teacher/signup" element={<TeacherSignupPage />} />

        <Route
          path="/"
          element={
            <RequireStudent>
              <ItemListPage />
            </RequireStudent>
          }
        />
        <Route
          path="/items/:itemId/solve"
          element={
            <RequireStudent>
              <SolvePage />
            </RequireStudent>
          }
        />
        <Route
          path="/items/:itemId/explain"
          element={
            <RequireStudent>
              <ExplainPage />
            </RequireStudent>
          }
        />
        <Route
          path="/mypage"
          element={
            <RequireStudent>
              <StudentMyPage />
            </RequireStudent>
          }
        />

        <Route
          path="/teacher"
          element={
            <RequireTeacher>
              <TeacherDashboardPage />
            </RequireTeacher>
          }
        />
        <Route
          path="/teacher/students/new"
          element={
            <RequireTeacher>
              <TeacherAddStudentsPage />
            </RequireTeacher>
          }
        />
        <Route
          path="/teacher/students/:studentId"
          element={
            <RequireTeacher>
              <TeacherStudentDetailPage />
            </RequireTeacher>
          }
        />
        <Route
          path="/teacher/settings"
          element={
            <RequireTeacher>
              <TeacherSettingsPage />
            </RequireTeacher>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
