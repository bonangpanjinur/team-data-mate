import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, KeyRound, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole | null;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("lapangan");
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editRole, setEditRole] = useState<AppRole>("lapangan");
  const [updatingRole, setUpdatingRole] = useState(false);
  const [resetUser, setResetUser] = useState<UserWithRole | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");

    const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]));
    const merged: UserWithRole[] = (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      role: roleMap.get(p.id) ?? null,
    }));
    setUsers(merged);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    // Use edge function to create user (super admin creates accounts)
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { email: newEmail, password: newPassword, full_name: newName, role: newRole },
    });

    setCreating(false);

    if (error || data?.error) {
      toast({ title: "Gagal membuat user", description: error?.message || data?.error, variant: "destructive" });
    } else {
      toast({ title: "User berhasil dibuat" });
      setOpen(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      // Delay to allow DB trigger to create profile
      await new Promise((r) => setTimeout(r, 800));
      fetchUsers();
    }
  };

  const handleDelete = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("delete-user", {
      body: { user_id: userId },
    });
    if (error || data?.error) {
      toast({ title: "Gagal menghapus user", description: error?.message || data?.error, variant: "destructive" });
    } else {
      toast({ title: "User dihapus" });
      fetchUsers();
    }
  };

  const handleUpdateRole = async () => {
    if (!editingUser) return;
    setUpdatingRole(true);
    // Upsert: delete old role, insert new
    await supabase.from("user_roles").delete().eq("user_id", editingUser.id);
    const { error } = await supabase.from("user_roles").insert({ user_id: editingUser.id, role: editRole });
    setUpdatingRole(false);
    if (error) {
      toast({ title: "Gagal update role", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role berhasil diubah" });
      setEditingUser(null);
      fetchUsers();
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    setResettingPassword(true);
    const { data, error } = await supabase.functions.invoke("reset-password", {
      body: { user_id: resetUser.id, new_password: resetPassword },
    });
    setResettingPassword(false);
    if (error || data?.error) {
      toast({ title: "Gagal reset password", description: error?.message || data?.error, variant: "destructive" });
    } else {
      toast({ title: "Password berhasil direset" });
      setResetUser(null);
      setResetPassword("");
    }
  };

  const roleBadgeVariant = (role: AppRole | null) => {
    switch (role) {
      case "super_admin": return "default";
      case "admin": return "secondary";
      case "admin_input": return "secondary";
      case "lapangan": return "outline";
      case "nib": return "outline";
      default: return "outline";
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kelola User</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Buat User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat User Baru</DialogTitle>
              <DialogDescription>Isi data untuk membuat akun user baru.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Lengkap</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="admin_input">Admin Input</SelectItem>
                    <SelectItem value="lapangan">Lapangan</SelectItem>
                    <SelectItem value="nib">NIB</SelectItem>
                    <SelectItem value="umkm">UMKM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Membuat..." : "Buat User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row gap-3 p-4 border-b">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama atau email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Semua Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Role</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="admin_input">Admin Input</SelectItem>
                <SelectItem value="lapangan">Lapangan</SelectItem>
                <SelectItem value="nib">NIB</SelectItem>
                <SelectItem value="umkm">UMKM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users
                .filter((u) => {
                  const q = searchQuery.toLowerCase();
                  const matchSearch = !q || (u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
                  const matchRole = filterRole === "all" || u.role === filterRole;
                  return matchSearch && matchRole;
                })
                .map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "-"}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant(u.role)}>
                      {u.role?.replace("_", " ") ?? "No role"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.role !== "super_admin" && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingUser(u); setEditRole(u.role || "lapangan"); }}>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setResetUser(u); setResetPassword(""); }}>
                          <KeyRound className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Yakin ingin menghapus {u.full_name || u.email}? Tindakan ini tidak bisa dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(u.id)}>Hapus</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Belum ada user
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(v) => !v && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Role</DialogTitle>
            <DialogDescription>Ubah role untuk {editingUser?.full_name || editingUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role Baru</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="admin_input">Admin Input</SelectItem>
                  <SelectItem value="lapangan">Lapangan</SelectItem>
                  <SelectItem value="nib">NIB</SelectItem>
                  <SelectItem value="umkm">UMKM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleUpdateRole} disabled={updatingRole}>
              {updatingRole ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={(v) => !v && setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set password baru untuk {resetUser?.full_name || resetUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Password Baru</Label>
              <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} minLength={6} placeholder="Minimal 6 karakter" />
            </div>
            <Button className="w-full" onClick={handleResetPassword} disabled={resettingPassword || resetPassword.length < 6}>
              {resettingPassword ? "Menyimpan..." : "Reset Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
