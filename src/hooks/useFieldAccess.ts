import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FieldAccess {
  field_name: string;
  can_view: boolean;
  can_edit: boolean;
}

export function useFieldAccess(targetRole?: string) {
  const { role, ownerId, loading: authLoading } = useAuth();
  const [fields, setFields] = useState<FieldAccess[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveRole = targetRole || role;
  // Super roles and owner role should have full access by default
  const isSuperRole = effectiveRole === "super_admin" || effectiveRole === "admin" || effectiveRole === "owner";

  useEffect(() => {
    // Wait for AuthContext to finish loading before fetching field access
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!effectiveRole) {
      setFields([]);
      setLoading(false);
      return;
    }

    if (isSuperRole) {
      setFields([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchAccess = async () => {
      setLoading(true);

      try {
        // If user has an owner (team member or owner themselves), use owner_field_access
        if (ownerId) {
          const { data: ownerAccess } = await supabase
            .from("owner_field_access")
            .select("field_name, can_view, can_edit")
            .eq("owner_id", ownerId)
            .eq("role", effectiveRole as any);

          // If owner has custom settings, use those
          if (ownerAccess && ownerAccess.length > 0) {
            if (isMounted) {
              setFields(ownerAccess as FieldAccess[]);
              setLoading(false);
            }
            return;
          }
        }

        // Fallback to global field_access (default settings)
        const { data } = await supabase
          .from("field_access")
          .select("field_name, can_view, can_edit")
          .eq("role", effectiveRole as any);
        
        if (isMounted) {
          setFields((data as FieldAccess[]) ?? []);
          setLoading(false);
        }
      } catch (err) {
        console.error("[useFieldAccess] Error fetching field access:", err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAccess();

    return () => {
      isMounted = false;
    };
  }, [effectiveRole, ownerId, isSuperRole, authLoading]);

  const canView = (field: string) => {
    if (isSuperRole) return true;
    return fields.find((f) => f.field_name === field)?.can_view ?? false;
  };
  const canEdit = (field: string) => {
    if (isSuperRole) return true;
    return fields.find((f) => f.field_name === field)?.can_edit ?? false;
  };

  return { fields, loading, canView, canEdit };
}

export function useAllFieldAccess() {
  const [allAccess, setAllAccess] = useState<Record<string, FieldAccess[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetch = async () => {
      try {
        setLoading(true);
        const { data } = await supabase.from("field_access").select("*");
        const grouped: Record<string, FieldAccess[]> = {};
        (data ?? []).forEach((row: any) => {
          if (!grouped[row.role]) grouped[row.role] = [];
          grouped[row.role].push({
            field_name: row.field_name,
            can_view: row.can_view,
            can_edit: row.can_edit,
          });
        });
        if (isMounted) {
          setAllAccess(grouped);
          setLoading(false);
        }
      } catch (err) {
        console.error("[useAllFieldAccess] Error fetching field access:", err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetch();

    return () => {
      isMounted = false;
    };
  }, []);

  const refetch = async () => {
    try {
      const { data } = await supabase.from("field_access").select("*");
      const grouped: Record<string, FieldAccess[]> = {};
      (data ?? []).forEach((row: any) => {
        if (!grouped[row.role]) grouped[row.role] = [];
        grouped[row.role].push({
          field_name: row.field_name,
          can_view: row.can_view,
          can_edit: row.can_edit,
        });
      });
      setAllAccess(grouped);
    } catch (err) {
      console.error("[useAllFieldAccess] Error refetching field access:", err);
    }
  };

  return { allAccess, loading, refetch };
}

// Hook for owner to manage their team's field access
export function useOwnerFieldAccess(ownerIdParam?: string) {
  const { user, ownerId: contextOwnerId, loading: authLoading } = useAuth();
  const [allAccess, setAllAccess] = useState<Record<string, FieldAccess[]>>({});
  const [loading, setLoading] = useState(true);

  const effectiveOwnerId = ownerIdParam || contextOwnerId || user?.id;

  const fetchAccess = async () => {
    if (!effectiveOwnerId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    try {
      setLoading(true);
      const { data } = await supabase
        .from("owner_field_access")
        .select("*")
        .eq("owner_id", effectiveOwnerId);
      
      const grouped: Record<string, FieldAccess[]> = {};
      (data ?? []).forEach((row: any) => {
        if (!grouped[row.role]) grouped[row.role] = [];
        grouped[row.role].push({
          field_name: row.field_name,
          can_view: row.can_view,
          can_edit: row.can_edit,
        });
      });
      
      if (isMounted) {
        setAllAccess(grouped);
        setLoading(false);
      }
    } catch (err) {
      console.error("[useOwnerFieldAccess] Error fetching owner field access:", err);
      if (isMounted) {
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
    };
  };

  useEffect(() => {
    // Wait for AuthContext to finish loading
    if (authLoading) {
      setLoading(true);
      return;
    }

    fetchAccess();
  }, [effectiveOwnerId, authLoading]);

  return { allAccess, loading, refetch: fetchAccess, ownerId: effectiveOwnerId };
}
