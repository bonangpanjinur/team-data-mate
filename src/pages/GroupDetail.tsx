import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Plus, Users, FileText, Trash2, Download, Loader2, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import DataEntryForm from "@/components/DataEntryForm";
import type { Tables, Enums } from "@/integrations/supabase/types";

type DataEntry = Tables<"data_entries">;

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  belum_lengkap: { label: "Belum Lengkap", variant: "destructive", icon: Clock },
  lengkap: { label: "Lengkap", variant: "secondary", icon: CheckCircle2 },
  terverifikasi: { label: "Terverifikasi", variant: "default", icon: ShieldCheck },
};

interface MemberWithProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
}

export default function GroupDetail() {
  const { id: groupId } = useParams<{ id: string }>();
  const { role, user } = useAuth();
  const [group, setGroup] = useState<Tables<"groups"> | null>(null);
  const [entries, setEntries] = useState<DataEntry[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DataEntry | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; email: string | null; full_name: string | null }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  // Download state
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const canDownload = role === "super_admin" || role === "admin";

  const fetchGroup = async () => {
    if (!groupId) return;
    const { data } = await supabase.from("groups").select("*").eq("id", groupId).single();
    setGroup(data);
  };

  const fetchEntries = async () => {
    if (!groupId) return;
    const { data } = await supabase.from("data_entries").select("*").eq("group_id", groupId).order("created_at", { ascending: false });
    setEntries(data ?? []);
  };

  const fetchMembers = async () => {
    if (!groupId) return;
    const { data: gm } = await supabase.from("group_members").select("*").eq("group_id", groupId);
    if (!gm) return;

    const userIds = gm.map((m) => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);
    const { data: roles } = await supabase.from("user_roles").select("*").in("user_id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]));
    const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]));

    setMembers(
      gm.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        full_name: profileMap.get(m.user_id)?.full_name ?? null,
        email: profileMap.get(m.user_id)?.email ?? null,
        role: roleMap.get(m.user_id) ?? null,
      }))
    );
  };

  const fetchAvailableUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: existing } = await supabase.from("group_members").select("user_id").eq("group_id", groupId ?? "");
    const existingIds = new Set(existing?.map((e) => e.user_id));
    setAvailableUsers((profiles ?? []).filter((p) => !existingIds.has(p.id)));
  };

  useEffect(() => {
    fetchGroup();
    fetchEntries();
    fetchMembers();
  }, [groupId]);

  const handleAddMember = async () => {
    if (!selectedUserId || !groupId) return;
    const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: selectedUserId });
    if (error) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Anggota ditambahkan" });
      setAddMemberOpen(false);
      setSelectedUserId("");
      fetchMembers();
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    await supabase.from("group_members").delete().eq("id", memberId);
    fetchMembers();
  };

  const handleDeleteEntry = async (entryId: string) => {
    await supabase.from("data_entries").delete().eq("id", entryId);
    fetchEntries();
  };

  const handleStatusChange = async (entryId: string, status: string) => {
    const { error } = await supabase.from("data_entries").update({ status } as any).eq("id", entryId);
    if (error) {
      toast({ title: "Gagal mengubah status", description: error.message, variant: "destructive" });
    } else {
      setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, status } as any : e));
    }
  };

  const handleEntrySaved = () => {
    setShowEntryForm(false);
    setEditingEntry(null);
    fetchEntries();
  };

  // Download handlers
  const toggleEntry = (id: string) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedEntries.size === entries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(entries.map((e) => e.id)));
    }
  };

  const handleDownload = async (ids: string[]) => {
    setDownloading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-entries`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ entry_ids: ids }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Download gagal");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || "data.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ title: "Download berhasil" });
      setSelectedEntries(new Set());
    } catch (err: any) {
      toast({ title: "Download gagal", description: err.message, variant: "destructive" });
    }
    setDownloading(false);
  };

  if (!group) return <div className="text-muted-foreground">Memuat...</div>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{group.name}</h1>

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries" className="gap-2"><FileText className="h-4 w-4" /> Data Entri</TabsTrigger>
          {(role === "super_admin" || role === "admin") && (
            <TabsTrigger value="members" className="gap-2"><Users className="h-4 w-4" /> Anggota</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="entries" className="mt-4">
          {showEntryForm || editingEntry ? (
            <DataEntryForm
              groupId={groupId!}
              entry={editingEntry}
              onCancel={() => { setShowEntryForm(false); setEditingEntry(null); }}
              onSaved={handleEntrySaved}
            />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Button onClick={() => setShowEntryForm(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Tambah Data
                </Button>
                {canDownload && selectedEntries.size > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => handleDownload([...selectedEntries])}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Download {selectedEntries.size} data
                  </Button>
                )}
              </div>
              {entries.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">Belum ada data</CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {canDownload && (
                            <TableHead className="w-10">
                              <Checkbox
                                checked={selectedEntries.size === entries.length && entries.length > 0}
                                onCheckedChange={toggleAll}
                              />
                            </TableHead>
                          )}
                          <TableHead>Nama</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Alamat</TableHead>
                          <TableHead>No HP</TableHead>
                          <TableHead>KTP</TableHead>
                          <TableHead>NIB</TableHead>
                          <TableHead>Produk</TableHead>
                          <TableHead>Verifikasi</TableHead>
                          <TableHead className="w-20"></TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map((e) => (
                          <TableRow key={e.id}>
                            {canDownload && (
                              <TableCell onClick={(ev) => ev.stopPropagation()}>
                                <Checkbox
                                  checked={selectedEntries.has(e.id)}
                                  onCheckedChange={() => toggleEntry(e.id)}
                                />
                              </TableCell>
                            )}
                            <TableCell className="font-medium cursor-pointer" onClick={() => setEditingEntry(e)}>{e.nama || "-"}</TableCell>
                            <TableCell>
                              {canDownload ? (
                                <Select
                                  value={(e as any).status || "belum_lengkap"}
                                  onValueChange={(v) => handleStatusChange(e.id, v)}
                                >
                                  <SelectTrigger className="h-8 w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                      <SelectItem key={key} value={key}>
                                        <span className="flex items-center gap-1">
                                          <cfg.icon className="h-3 w-3" />
                                          {cfg.label}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                (() => {
                                  const cfg = STATUS_CONFIG[(e as any).status || "belum_lengkap"];
                                  return <Badge variant={cfg.variant}><cfg.icon className="mr-1 h-3 w-3" />{cfg.label}</Badge>;
                                })()
                              )}
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate cursor-pointer" onClick={() => setEditingEntry(e)}>{e.alamat || "-"}</TableCell>
                            <TableCell className="cursor-pointer" onClick={() => setEditingEntry(e)}>{e.nomor_hp || "-"}</TableCell>
                            <TableCell>{e.ktp_url ? <Badge variant="secondary">✓</Badge> : "-"}</TableCell>
                            <TableCell>{e.nib_url ? <Badge variant="secondary">✓</Badge> : "-"}</TableCell>
                            <TableCell>{e.foto_produk_url ? <Badge variant="secondary">✓</Badge> : "-"}</TableCell>
                            <TableCell>{e.foto_verifikasi_url ? <Badge variant="secondary">✓</Badge> : "-"}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {canDownload && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDownload([e.id])}
                                    disabled={downloading}
                                    title="Download entri ini"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteEntry(e.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {(role === "super_admin" || role === "admin") && (
          <TabsContent value="members" className="mt-4">
            {role === "super_admin" && (
              <div className="mb-4">
                <Dialog open={addMemberOpen} onOpenChange={(o) => { setAddMemberOpen(o); if (o) fetchAvailableUsers(); }}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> Tambah Anggota</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Tambah Anggota</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger><SelectValue placeholder="Pilih user..." /></SelectTrigger>
                        <SelectContent>
                          {availableUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.full_name || u.email || u.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button className="w-full" onClick={handleAddMember} disabled={!selectedUserId}>
                        Tambahkan
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      {role === "super_admin" && <TableHead className="w-16"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.full_name || "-"}</TableCell>
                        <TableCell>{m.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.role?.replace("_", " ") ?? "-"}</Badge>
                        </TableCell>
                        {role === "super_admin" && (
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(m.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {members.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Belum ada anggota
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
