import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
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

  const fetchRoleAndOwner = useCallback(async (userId: string) => {
    try {
      // 1. Fetch Role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (roleError) {
        console.error(`[AuthContext] Error fetching role:`, roleError.message);
        return { role: null, ownerId: null };
      }

      const userRole = roleData?.role ?? null;

      // 2. Fetch Owner ID based on role
      let userOwnerId: string | null = null;
      
      if (userRole === "owner") {
        userOwnerId = userId;
      } else if (userRole === "super_admin" || userRole === "umkm" || !userRole) {
        userOwnerId = null;
      } else {
        // For team members (admin, admin_input, lapangan, nib), get their owner
        const { data: ownerData, error: ownerError } = await supabase
          .from("owner_teams")
          .select("owner_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (ownerError) {
          console.error(`[AuthContext] Error fetching owner:`, ownerError.message);
        } else {
          userOwnerId = ownerData?.owner_id ?? null;
        }
      }

      return { role: userRole, ownerId: userOwnerId };
    } catch (err) {
      console.error(`[AuthContext] Unexpected error in fetchRoleAndOwner:`, err);
      return { role: null, ownerId: null };
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Get initial session
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("[AuthContext] Session error:", sessionError.message);
        }

        if (!isMounted) return;

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          
          const { role: userRole, ownerId: userOwnerId } = await fetchRoleAndOwner(initialSession.user.id);
          
          if (isMounted) {
            setRole(userRole);
            setOwnerId(userOwnerId);
          }
        } else {
          setSession(null);
          setUser(null);
          setRole(null);
          setOwnerId(null);
        }
      } catch (err) {
        console.error("[AuthContext] Initialization failed:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log(`[AuthContext] Auth event: ${event}`);
      
      if (!isMounted) return;

      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        
        // Fetch additional data
        const { role: userRole, ownerId: userOwnerId } = await fetchRoleAndOwner(currentSession.user.id);
        
        if (isMounted) {
          setRole(userRole);
          setOwnerId(userOwnerId);
          setLoading(false);
        }
      } else {
        setSession(null);
        setUser(null);
        setRole(null);
        setOwnerId(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchRoleAndOwner]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[AuthContext] Sign out error:", err);
    } finally {
      setUser(null);
      setSession(null);
      setRole(null);
      setOwnerId(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, role, ownerId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
