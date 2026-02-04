import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import ClientsPage from "@/pages/clients";
import ClientDetailPage from "@/pages/client-detail";
import ClientFormPage from "@/pages/client-form";
import BulkUpdatesPage from "@/pages/bulk-updates";
import ReportsPage from "@/pages/reports";
import PoolFundPage from "@/pages/pool-fund";
import SettingsPage from "@/pages/settings";
import UsersPage from "@/pages/users";
import AuditLogsPage from "@/pages/audit-logs";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ 
  component: Component, 
  requireSuperAdmin = false 
}: { 
  component: React.ComponentType; 
  requireSuperAdmin?: boolean;
}) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (requireSuperAdmin && user.role !== "super_admin") {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <PublicRoute component={LoginPage} />
      </Route>
      
      <Route path="/dashboard">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      
      <Route path="/clients/new">
        <ProtectedRoute component={ClientFormPage} />
      </Route>
      
      <Route path="/clients/:id/edit">
        <ProtectedRoute component={ClientFormPage} />
      </Route>
      
      <Route path="/clients/:id">
        <ProtectedRoute component={ClientDetailPage} />
      </Route>
      
      <Route path="/clients">
        <ProtectedRoute component={ClientsPage} />
      </Route>
      
      <Route path="/bulk-updates">
        <ProtectedRoute component={BulkUpdatesPage} />
      </Route>
      
      <Route path="/reports">
        <ProtectedRoute component={ReportsPage} />
      </Route>
      
      <Route path="/pool-fund">
        <ProtectedRoute component={PoolFundPage} />
      </Route>
      
      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>
      
      <Route path="/users">
        <ProtectedRoute component={UsersPage} requireSuperAdmin />
      </Route>
      
      <Route path="/audit-logs">
        <ProtectedRoute component={AuditLogsPage} requireSuperAdmin />
      </Route>
      
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
