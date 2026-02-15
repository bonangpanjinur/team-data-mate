import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Copy, QrCode, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type SharedLink = Tables<"shared_links">;

interface GroupOption {
  id: string;
  name: string;
}

export default function ShareLinks() {
  const { user } = useAuth();
  const [links, setLinks] = useState<(SharedLink & { group_name?: string })[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchLinks = async () => {
    if (!user) return;
    const { data } = await supabase.from("shared_links").select("*").eq("user_id", user.id);
    if (data) {
      const groupIds = [...new Set(data.map((l) => l.group_id))];
      const { data: groupData } = await supabase.from("groups").select("id, name").in("id", groupIds);
      const gMap = new Map(groupData?.map((g) => [g.id, g.name]));
      setLinks(data.map((l) => ({ ...l, group_name: gMap.get(l.group_id) })));
    }
  };

  const fetchGroups = async () => {
    const { data } = await supabase.from("groups").select("id, name");
    setGroups(data ?? []);
  };

  useEffect(() => {
    fetchLinks();
    fetchGroups();
  }, [user]);

  const handleCreate = async () => {
    if (!user || !selectedGroup) return;
    setCreating(true);
    const { error } = await supabase.from("shared_links").insert({
      user_id: user.id,
      group_id: selectedGroup,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Link dibuat" });
      setSelectedGroup("");
      fetchLinks();
    }
  };

  const toggleActive = async (link: SharedLink) => {
    await supabase.from("shared_links").update({ is_active: !link.is_active }).eq("id", link.id);
    fetchLinks();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("shared_links").delete().eq("id", id);
    fetchLinks();
  };

  const getShareUrl = (token: string) => `${window.location.origin}/public-form/${token}`;

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getShareUrl(token));
    toast({ title: "Link disalin!" });
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Share Link</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Buat Link Baru</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Pilih group..." /></SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleCreate} disabled={!selectedGroup || creating}>
              <Plus className="mr-2 h-4 w-4" /> Buat
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead className="w-32">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.group_name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={l.is_active ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => toggleActive(l)}
                    >
                      {l.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString("id-ID")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => copyLink(l.token)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getShareUrl(l.token))}`, "_blank")}>
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {links.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Belum ada link
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
