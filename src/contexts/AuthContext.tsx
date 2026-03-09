import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  ownerId: string | null; // For team members, this is their owner's ID
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  ownerId: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    setRole(data?.role ?? null);
    return data?.role ?? null;
  };

  const fetchOwnerId = async (userId: string, userRole: AppRole | null) => {
    // If user is owner, their ownerId is themselves
    if (userRole === "owner") {
      setOwnerId(userId);
      return;
    }
    // If user is super_admin or umkm, no owner context
    if (userRole === "super_admin" || userRole === "umkm" || !userRole) {
      setOwnerId(null);
      return;
    }
    // For team members (admin, admin_input, lapangan, nib), get their owner
    const { data } = await supabase
      .from("owner_teams")
      .select("owner_id")
      .eq("user_id", userId)
      .single();
    setOwnerId(data?.owner_id ?? null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(async () => {
            const userRole = await fetchRole(session.user.id);
            await fetchOwnerId(session.user.id, userRole);
          }, 0);
        } else {
          setRole(null);
          setOwnerId(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const userRole = await fetchRole(session.user.id);
        await fetchOwnerId(session.user.id, userRole);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setOwnerId(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, ownerId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
