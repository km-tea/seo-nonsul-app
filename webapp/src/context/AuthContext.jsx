import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const AuthContext = createContext(null);

const STORAGE_KEY = "seo-nonsul-session";

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const payload = JSON.parse(atob(parsed.token.split(".")[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);

  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  // 학생/교사 모두 Netlify Function이 자체 검증 후 발급한 커스텀 JWT를 쓴다.
  // role로 어느 쪽 세션인지 구분한다("student" | "teacher").
  const supabase = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: session
        ? { headers: { Authorization: `Bearer ${session.token}` } }
        : {},
    });
  }, [session]);

  const loginAsStudent = (token, student) => setSession({ token, role: "student", profile: student });
  const loginAsTeacher = (token, teacher) => setSession({ token, role: "teacher", profile: teacher });
  const logout = () => setSession(null);

  const value = {
    session,
    role: session?.role ?? null,
    student: session?.role === "student" ? session.profile : null,
    teacher: session?.role === "teacher" ? session.profile : null,
    isLoggedIn: !!session,
    isTeacher: session?.role === "teacher",
    isStudent: session?.role === "student",
    supabase,
    loginAsStudent,
    loginAsTeacher,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}
