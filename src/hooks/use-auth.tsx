import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "student" | "lecturer" | "admin";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isLecturer: boolean;
  isStudent: boolean;
  isRestricted: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isRestricted, setIsRestricted] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (userId: string | undefined) => {
    if (!userId) { setRoles([]); setIsRestricted(false); return; }
    const [{ data: rData }, { data: pData }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("is_restricted").eq("id", userId).single()
    ]);
    setRoles((rData ?? []).map((r) => r.role as AppRole));
    setIsRestricted(pData?.is_restricted ?? false);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setTimeout(() => { loadRoles(s?.user?.id); }, 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadRoles(data.session?.user?.id).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    roles,
    loading,
    isAdmin: !loading && roles.includes("admin"),
    isLecturer: !loading && (roles.includes("lecturer") || roles.includes("admin")),
    // IMPORTANT: Use a POSITIVE check for "student" role, NOT a negative check.
    // A negative check (!includes lecturer && !includes admin) is true when roles=[],
    // which causes lecturers to be incorrectly blocked during the loading window.
    isStudent: !loading && roles.includes("student") && !roles.includes("lecturer") && !roles.includes("admin"),
    isRestricted,
    signOut: async () => { await supabase.auth.signOut(); },
    refreshRoles: () => loadRoles(session?.user?.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
