import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  status: "ativo" | "inativo";
}

export interface RoleData {
  id: string;
  nome: string;
  is_admin: boolean;
  is_system: boolean;
  pode_ver_dashboard: boolean;
  pode_ver_contatos: boolean;
  pode_gerenciar_contatos: boolean;
  pode_ver_automacoes: boolean;
  pode_gerenciar_automacoes: boolean;
  pode_enviar_mensagens: boolean;
  pode_gerenciar_numeros: boolean;
  pode_gerenciar_usuarios: boolean;
  pode_gerenciar_integracoes: boolean;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: RoleData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasPermission: (perm: keyof RoleData) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nome: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<RoleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchProfileAndRole(userId: string) {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).single(),
      supabase
        .from("user_roles")
        .select("roles(*)")
        .eq("user_id", userId)
        .single(),
    ]);
    setProfile(profileRes.data as Profile | null);
    const r = (roleRes.data as { roles: RoleData | null } | null)?.roles ?? null;
    setRole(r);
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfileAndRole(session.user.id), 0);
        } else {
          setProfile(null);
          setRole(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndRole(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, nome: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome }, emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const hasPermission = (perm: keyof RoleData): boolean => {
    if (!role) return false;
    if (role.is_admin) return true;
    return Boolean(role[perm]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading,
        isAuthenticated: !!session,
        isAdmin: role?.is_admin ?? false,
        hasPermission,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
