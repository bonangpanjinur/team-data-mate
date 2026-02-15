import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  Link2,
  LogOut,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = {
  super_admin: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Kelola User", icon: Users, path: "/users" },
    { label: "Group Halal", icon: FolderOpen, path: "/groups" },
  ],
  admin: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Group Halal", icon: FolderOpen, path: "/groups" },
  ],
  lapangan: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Group Halal", icon: FolderOpen, path: "/groups" },
    { label: "Share Link", icon: Link2, path: "/share" },
  ],
  nib: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Group Halal", icon: FolderOpen, path: "/groups" },
  ],
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const { role, signOut, user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  const items = role ? NAV_ITEMS[role] : [];

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
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">Data Halal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground capitalize">{role}</span>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4">{children}</main>

        {/* Bottom nav */}
        <nav className="flex border-t bg-background">
          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors",
                location.pathname === item.path
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
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
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-semibold">Data Halal</span>
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
          <div className="mb-2 text-xs text-muted-foreground truncate">{user?.email}</div>
          <div className="mb-2 text-xs font-medium capitalize">{role?.replace("_", " ")}</div>
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
