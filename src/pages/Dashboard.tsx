import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FolderOpen, FileText, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { role, user } = useAuth();
  const [stats, setStats] = useState({ groups: 0, entries: 0, users: 0, links: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [groupsRes, entriesRes] = await Promise.all([
        supabase.from("groups").select("id", { count: "exact", head: true }),
        supabase.from("data_entries").select("id", { count: "exact", head: true }),
      ]);

      let usersCount = 0;
      let linksCount = 0;

      if (role === "super_admin") {
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
        usersCount = count ?? 0;
      }

      if (role === "lapangan") {
        const { count } = await supabase.from("shared_links").select("id", { count: "exact", head: true }).eq("user_id", user?.id ?? "");
        linksCount = count ?? 0;
      }

      setStats({
        groups: groupsRes.count ?? 0,
        entries: entriesRes.count ?? 0,
        users: usersCount,
        links: linksCount,
      });
    };
    fetchStats();
  }, [role, user]);

  const cards = [
    { label: "Group Halal", value: stats.groups, icon: FolderOpen, show: true },
    { label: "Data Entri", value: stats.entries, icon: FileText, show: true },
    { label: "Total User", value: stats.users, icon: Users, show: role === "super_admin" },
    { label: "Link Aktif", value: stats.links, icon: Link2, show: role === "lapangan" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.filter(c => c.show).map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
