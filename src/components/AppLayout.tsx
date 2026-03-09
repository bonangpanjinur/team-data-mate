import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  Link2,
  LogOut,
  Shield,
  UserCog,
  Sun,
  Moon,
  Settings,
  Wallet,
  ClipboardList,
  Bell,
  FileText,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = {
  super_admin: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Kelola User", icon: Users, path: "/users" },
    { label: "Group Halal", icon: FolderOpen, path: "/groups" },
    { label: "Share Link", icon: Link2, path: "/share" },
    { label: "Komisi", icon: Wallet, path: "/komisi" },
    { label: "Tagihan Owner", icon: FileText, path: "/owner-invoices" },
    { label: "Laporan", icon: BarChart3, path: "/financial-report" },
    { label: "Pengaturan", icon: Settings, path: "/settings" },
  ],
  admin: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Group Halal", icon: FolderOpen, path: "/groups" },
    { label: "Share Link", icon: Link2, path: "/share" },
    { label: "Komisi", icon: Wallet, path: "/komisi" },
  ],
  lapangan: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Group Halal", icon: FolderOpen, path: "/groups" },
    { label: "Share Link", icon: Link2, path: "/share" },
    { label: "Komisi", icon: Wallet, path: "/komisi" },
  ],
  nib: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Group Halal", icon: FolderOpen, path: "/groups" },
    { label: "Share Link", icon: Link2, path: "/share" },
    { label: "Komisi", icon: Wallet, path: "/komisi" },
  ],
  owner: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Group Halal", icon: FolderOpen, path: "/groups" },
    { label: "Share Link", icon: Link2, path: "/share" },
    { label: "Notifikasi", icon: Bell, path: "/notifications" },
    { label: "Kelola Tim", icon: Users, path: "/owner-team" },
    { label: "Akses Field", icon: Shield, path: "/owner-field-access" },
    { label: "Komisi Tim", icon: Wallet, path: "/owner-rates" },
    { label: "Tagihan", icon: FileText, path: "/owner-invoices" },
    { label: "Laporan", icon: BarChart3, path: "/financial-report" },
  ],
  admin_input: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Group Halal", icon: FolderOpen, path: "/groups" },
  ],
  umkm: [
    { label: "Status Saya", icon: ClipboardList, path: "/umkm" },
  ],
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const { role, signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [appName, setAppName] = useState("HalalTrack");
  const [logoUrl, setLogoUrl] = useState("");

  // Fetch app settings
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("app_settings").select("key, value");
      if (data) {
        data.forEach((row: any) => {
          if (row.key === "app_name" && row.value) setAppName(row.value);
          if (row.key === "logo_url" && row.value) setLogoUrl(row.value);
        });
      }
    };
    fetchSettings();
  }, []);

  const items = role ? NAV_ITEMS[role as keyof typeof NAV_ITEMS] ?? [] : [];

  // Fetch unread notification count for all roles
  useEffect(() => {
    if (!user) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("notifications" as any)
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      setUnreadCount(count ?? 0);
    };
    fetchCount();
    const channel = supabase
      .channel("user-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => fetchCount())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => fetchCount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  if (isMobile) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-5 w-5 rounded object-contain" />
            ) : (
              <Shield className="h-5 w-5 text-primary" />
            )}
            <span className="text-sm font-bold tracking-tight">{appName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/profile")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              {user?.email?.split("@")[0]}
            </button>
            <span className="text-xs text-muted-foreground capitalize">{role}</span>
            {unreadCount > 0 && (
              <Button variant="ghost" size="icon" className="relative" onClick={() => navigate(role === "umkm" ? "/umkm" : "/dashboard")}>
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Content - add padding bottom for sticky nav */}
        <main className="flex-1 overflow-auto p-4 pb-20">{children}</main>

        {/* Sticky Bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t bg-background shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors",
                location.pathname === item.path
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", location.pathname === item.path && "scale-110")} />
              <span className="truncate text-[10px]">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r bg-sidebar-background">
        <div className="flex items-center gap-2.5 border-b px-4 py-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-6 w-6 rounded object-contain" />
          ) : (
            <Shield className="h-6 w-6 text-sidebar-primary" />
          )}
          <span className="font-bold tracking-tight text-sidebar-primary-foreground">{appName}</span>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                location.pathname === item.path
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t p-3">
          <button
            onClick={() => navigate("/profile")}
            className="mb-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <UserCog className="h-4 w-4" />
            <div className="text-left">
              <div className="truncate text-xs">{user?.email}</div>
              <div className="text-xs font-medium capitalize">{role?.replace("_", " ")}</div>
            </div>
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mb-1"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            {theme === "dark" ? "Mode Terang" : "Mode Gelap"}
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Keluar
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
