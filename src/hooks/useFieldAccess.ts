import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FieldAccess {
  field_name: string;
  can_view: boolean;
  can_edit: boolean;
}

export function useFieldAccess(targetRole?: string) {
  const { role } = useAuth();
  const [fields, setFields] = useState<FieldAccess[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveRole = targetRole || role;

  useEffect(() => {
    if (!effectiveRole) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("field_access")
        .select("field_name, can_view, can_edit")
        .eq("role", effectiveRole as any);
      setFields((data as FieldAccess[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, [effectiveRole]);

  const canView = (field: string) => fields.find((f) => f.field_name === field)?.can_view ?? false;
  const canEdit = (field: string) => fields.find((f) => f.field_name === field)?.can_edit ?? false;

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
