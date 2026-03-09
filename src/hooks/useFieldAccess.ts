import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FieldAccess {
  field_name: string;
  can_view: boolean;
  can_edit: boolean;
}

export function useFieldAccess(targetRole?: string) {
  const { role, ownerId } = useAuth();
  const [fields, setFields] = useState<FieldAccess[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveRole = targetRole || role;
  const isSuperRole = effectiveRole === "super_admin" || effectiveRole === "admin";

  useEffect(() => {
    if (!effectiveRole) return;
    if (isSuperRole) {
      setFields([]);
      setLoading(false);
      return;
    }

    const fetchAccess = async () => {
      setLoading(true);

      // If user has an owner (team member or owner themselves), use owner_field_access
      if (ownerId) {
        const { data: ownerAccess } = await supabase
          .from("owner_field_access")
          .select("field_name, can_view, can_edit")
          .eq("owner_id", ownerId)
          .eq("role", effectiveRole as any);

        // If owner has custom settings, use those
        if (ownerAccess && ownerAccess.length > 0) {
          setFields(ownerAccess as FieldAccess[]);
          setLoading(false);
          return;
        }
      }

      // Fallback to global field_access (default settings)
      const { data } = await supabase
        .from("field_access")
        .select("field_name, can_view, can_edit")
        .eq("role", effectiveRole as any);
      setFields((data as FieldAccess[]) ?? []);
      setLoading(false);
    };

    fetchAccess();
  }, [effectiveRole, ownerId]);

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
    const fetch = async () => {
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
      setAllAccess(grouped);
      setLoading(false);
    };
    fetch();
  }, []);

  return { allAccess, loading, refetch: () => {
    const fetch = async () => {
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
    };
    fetch();
  }};
}

// Hook for owner to manage their team's field access
export function useOwnerFieldAccess(ownerIdParam?: string) {
  const { user, ownerId: contextOwnerId } = useAuth();
  const [allAccess, setAllAccess] = useState<Record<string, FieldAccess[]>>({});
  const [loading, setLoading] = useState(true);

  const effectiveOwnerId = ownerIdParam || contextOwnerId || user?.id;

  const fetchAccess = async () => {
    if (!effectiveOwnerId) return;
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
    setAllAccess(grouped);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccess();
  }, [effectiveOwnerId]);

  return { allAccess, loading, refetch: fetchAccess, ownerId: effectiveOwnerId };
}
