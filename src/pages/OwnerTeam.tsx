import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Users, Loader2, KeyRound, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface TeamMember {
  id: string;
  user_id: string;
  owner_id: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string | null;
  };
  role?: AppRole;
}

const TEAM_ROLES: { key: AppRole; label: string }[] = [
  { key: "admin", label: "Admin" },
  { key: "admin_input", label: "Admin Input" },
  { key: "lapangan", label: "Lapangan" },
  { key: "nib", label: "NIB" },
];

export default function OwnerTeam() {
  const { user, role } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("admin");

  const fetchTeam = async () => {
    if (!user) return;
    setLoading(true);

    const { data: members } = await supabase
      .from("owner_teams")
      .select("*")
      .eq("owner_id", user.id);

    if (members && members.length > 0) {
      const userIds = members.map((m) => m.user_id);
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const enriched = members.map((m) => ({
        ...m,
        profile: profiles?.find((p) => p.id === m.user_id),
        role: roles?.find((r) => r.user_id === m.user_id)?.role,
      }));

      setTeamMembers(enriched);
    } else {
      setTeamMembers([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchTeam();
  }, [user]);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("create-user", {
        body: { email, password, fullName, role: selectedRole },
      });

      let errorMessage = null;
      if (invokeError) {
        try {
          const body = await invokeError.context.json();
          errorMessage = body.error || invokeError.message;
        } catch {
          errorMessage = invokeError.message;
        }
      } else if (data?.error) {
        errorMessage = data.error;
      }

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      const newUserId = data.user?.id;
      if (!newUserId) throw new Error("User ID tidak ditemukan");

      const { error: teamError } = await supabase
        .from("owner_teams")
        .insert({ owner_id: user.id, user_id: newUserId });

      if (teamError) {
        toast({ title: "User dibuat tapi gagal ditambahkan ke tim", description: teamError.message, variant: "destructive" });
      } else {
        toast({ title: "Anggota tim berhasil ditambahkan" });
      }

      setOpen(false);
      setEmail("");
      setPassword("");
      setFullName("");
      setSelectedRole("admin");
      
      setTimeout(fetchTeam, 500);
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    }

    setCreating(false);
  };

  const handleChangeRole = async (member: TeamMember, newRole: AppRole) => {
    setChangingRole(member.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("update-user-role", {
        body: { user_id: member.user_id, new_role: newRole },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Gagal mengubah role");
      }

      toast({ title: "Role berhasil diubah" });
      fetchTeam();
    } catch (err: any) {
      toast({ title: "Gagal mengubah role", description: err.message, variant: "destructive" });
    }
    setChangingRole(null);
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword) return;
    setResettingPassword(true);

    try {
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { user_id: resetTarget.user_id, new_password: newPassword },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Gagal reset password");
      }

      toast({ title: "Password berhasil diubah" });
      setResetTarget(null);
      setNewPassword("");
    } catch (err: any) {
      toast({ title: "Gagal reset password", description: err.message, variant: "destructive" });
    }

    setResettingPassword(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const { error } = await supabase
      .from("owner_teams")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Anggota tim dihapus dari tim Anda" });
      fetchTeam();
    }
    setDeleteTarget(null);
  };

  if (role !== "owner") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Hanya Owner yang bisa mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Kelola Tim
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tambah dan kelola anggota tim Anda (admin, admin input, lapangan, NIB)
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Tambah Anggota
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Anggota Tim</DialogTitle>
              <DialogDescription>
                Buat akun baru untuk anggota tim Anda
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateMember} className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Anda hanya bisa membuat anggota tim dengan role: Admin, Admin Input, Lapangan, atau NIB.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>Nama Lengkap</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap" required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" required />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 karakter" minLength={6} required />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEAM_ROLES.map((r) => (
                      <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creating} className="w-full">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {creating ? "Membuat..." : "Buat Anggota"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Anggota Tim ({teamMembers.length})</CardTitle>
          <CardDescription>Semua anggota tim yang terdaftar di bawah Anda</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : teamMembers.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Belum ada anggota tim. Klik "Tambah Anggota" untuk menambahkan.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Bergabung</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.profile?.full_name || "-"}
                    </TableCell>
                    <TableCell>{member.profile?.email || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={member.role || ""}
                        onValueChange={(v) => handleChangeRole(member, v as AppRole)}
                        disabled={changingRole === member.user_id}
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          {changingRole === member.user_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {TEAM_ROLES.map((r) => (
                            <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(member.created_at).toLocaleDateString("id-ID")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setResetTarget(member)} title="Reset Password">
                          <KeyRound className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(member)} title="Hapus dari Tim">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus dari Tim?</DialogTitle>
            <DialogDescription>
              Anggota "{deleteTarget?.profile?.full_name || deleteTarget?.profile?.email}" akan dihapus dari tim Anda.
              Akun mereka tetap ada, tapi tidak bisa mengakses data Anda lagi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus dari Tim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) { setResetTarget(null); setNewPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Ganti password untuk "{resetTarget?.profile?.full_name || resetTarget?.profile?.email}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Password Baru</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 karakter"
                minLength={6}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setResetTarget(null); setNewPassword(""); }}>Batal</Button>
            <Button onClick={handleResetPassword} disabled={resettingPassword || newPassword.length < 6}>
              {resettingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {resettingPassword ? "Menyimpan..." : "Simpan Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}