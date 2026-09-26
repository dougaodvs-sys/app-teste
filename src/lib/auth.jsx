import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function fmtErr(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === "string" ? d : d?.msg || JSON.stringify(d)))
      .join(", ");
  }
  if (typeof detail === "object") return detail.msg || JSON.stringify(detail);
  return String(detail);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      if (data?.token || data?.access_token) {
        localStorage.setItem("token", data.token || data.access_token);
      }
      setUser(data);
      return data;
    } catch {
      localStorage.removeItem("token");
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = async (identifier, password, studio_slug) => {
    const { data } = await api.post("/auth/login", {
      identifier,
      password,
      studio_slug: studio_slug || null,
    });
    if (data?.token || data?.access_token) {
      localStorage.setItem("token", data.token || data.access_token);
    }
    setUser(data);
    return data;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    if (data?.token || data?.access_token) {
      localStorage.setItem("token", data.token || data.access_token);
    }
    setUser(data);
    return data;
  };

  const registerStudio = async (payload) => {
    const { data } = await api.post("/public/studios/register", payload);
    if (data?.token || data?.access_token) {
      localStorage.setItem("token", data.token || data.access_token);
    }
    if (data?.user) {
      setUser(data.user);
    }
    return data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, registerStudio, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
