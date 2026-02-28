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
import Profile from "@/pages/Profile";
import AppSettings from "@/pages/AppSettings";
import NotFound from "@/pages/NotFound";
import { ReactNode } from "react";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { user, role, loading } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/dashboard" replace />;

  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Memuat...</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
    <Route path="/public-form/:token" element={<PublicForm />} />
    <Route path="/tracking" element={<TrackingPage />} />
    <Route path="/tracking/:code" element={<TrackingPage />} />
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/users" element={<ProtectedRoute allowedRoles={["super_admin"]}><UsersManagement /></ProtectedRoute>} />
    <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
    <Route path="/groups/:id" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
    <Route path="/share" element={<ProtectedRoute allowedRoles={["lapangan"]}><ShareLinks /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute allowedRoles={["super_admin"]}><AppSettings /></ProtectedRoute>} />
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
