import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import UsersManagement from "@/pages/UsersManagement";
import Groups from "@/pages/Groups";
import GroupDetail from "@/pages/GroupDetail";
import ShareLinks from "@/pages/ShareLinks";
import PublicForm from "@/pages/PublicForm";
import TrackingPage from "@/pages/TrackingPage";
import PublicStats from "@/pages/PublicStats";
import Profile from "@/pages/Profile";
import AppSettings from "@/pages/AppSettings";
import Komisi from "@/pages/Komisi";
import UmkmDashboard from "@/pages/UmkmDashboard";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";
import OwnerInvoices from "@/pages/OwnerInvoices";
import OwnerCommissionRates from "@/pages/OwnerCommissionRates";
import FinancialReport from "@/pages/FinancialReport";
import { ReactNode } from "react";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { user, role, loading } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role === "umkm") {
    if (allowedRoles && !allowedRoles.includes("umkm")) return <Navigate to="/umkm" replace />;
    return <AppLayout>{children}</AppLayout>;
  }
  if (role === "owner") {
    if (allowedRoles && !allowedRoles.includes("owner")) return <Navigate to="/dashboard" replace />;
    return <AppLayout>{children}</AppLayout>;
  }
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/dashboard" replace />;

  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Memuat...</div>;
  if (user) {
    if (role === "umkm") return <Navigate to="/umkm" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
    <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />
    <Route path="/public-form/:token" element={<PublicForm />} />
    <Route path="/f/:slug" element={<PublicForm />} />
    <Route path="/tracking" element={<TrackingPage />} />
    <Route path="/tracking/:code" element={<TrackingPage />} />
    <Route path="/statistik" element={<PublicStats />} />
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/users" element={<ProtectedRoute allowedRoles={["super_admin"]}><UsersManagement /></ProtectedRoute>} />
    <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
    <Route path="/groups/:id" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
    <Route path="/share" element={<ProtectedRoute><ShareLinks /></ProtectedRoute>} />
    <Route path="/komisi" element={<ProtectedRoute><Komisi /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute allowedRoles={["super_admin"]}><AppSettings /></ProtectedRoute>} />
    <Route path="/umkm" element={<ProtectedRoute allowedRoles={["umkm"]}><UmkmDashboard /></ProtectedRoute>} />
    <Route path="/owner-invoices" element={<ProtectedRoute allowedRoles={["owner", "super_admin"]}><OwnerInvoices /></ProtectedRoute>} />
    <Route path="/owner-rates" element={<ProtectedRoute allowedRoles={["owner"]}><OwnerCommissionRates /></ProtectedRoute>} />
    <Route path="/financial-report" element={<ProtectedRoute allowedRoles={["owner", "super_admin"]}><FinancialReport /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" attribute="class">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
