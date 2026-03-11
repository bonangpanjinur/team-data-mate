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
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.warn(`[AuthContext] Error fetching role for user ${userId}:`, error.message);
        setRole(null);
        return null;
      }

      setRole(data?.role ?? null);
      return data?.role ?? null;
    } catch (err) {
      console.error(`[AuthContext] Unexpected error fetching role:`, err);
      setRole(null);
      return null;
    }
  };

  const fetchOwnerId = async (userId: string, userRole: AppRole | null) => {
    try {
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
      const { data, error } = await supabase
        .from("owner_teams")
        .select("owner_id")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.warn(`[AuthContext] Error fetching owner for user ${userId}:`, error.message);
        setOwnerId(null);
        return;
      }

      setOwnerId(data?.owner_id ?? null);
    } catch (err) {
      console.error(`[AuthContext] Unexpected error fetching owner:`, err);
      setOwnerId(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!isMounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        // Fetch role and owner only if user exists
        if (currentSession?.user) {
          const userRole = await fetchRole(currentSession.user.id);
          if (isMounted) {
            await fetchOwnerId(currentSession.user.id, userRole);
          }
        } else {
          if (isMounted) {
            setRole(null);
            setOwnerId(null);
          }
        }
      } catch (err) {
        console.error(`[AuthContext] Error during initialization:`, err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Initialize auth state
    initializeAuth();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const userRole = await fetchRole(session.user.id);
          if (isMounted) {
            await fetchOwnerId(session.user.id, userRole);
          }
        } else {
          if (isMounted) {
            setRole(null);
            setOwnerId(null);
          }
        }

        if (isMounted) {
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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
