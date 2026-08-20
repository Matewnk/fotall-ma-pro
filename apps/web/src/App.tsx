import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SuperAdminRoute } from './components/SuperAdminRoute';
import { SuperAdminShell } from './components/SuperAdminShell';
import { BrandingPage } from './pages/BrandingPage';
import { CashPage } from './pages/CashPage';
import { ClientsPage } from './pages/ClientsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { OrdersPage } from './pages/OrdersPage';
import { RegisterPage } from './pages/RegisterPage';
import { ReportsPage } from './pages/ReportsPage';
import { ServicesPage } from './pages/ServicesPage';
import { SuperAdminDashboardPage } from './pages/SuperAdminDashboardPage';
import { SuperAdminLoginPage } from './pages/SuperAdminLoginPage';
import { SuperAdminTenantDetailPage } from './pages/SuperAdminTenantDetailPage';
import { SuperAdminTenantsPage } from './pages/SuperAdminTenantsPage';
import { TicketsPage } from './pages/TicketsPage';
import { UsersPage } from './pages/UsersPage';

export function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/inscription" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <DashboardPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/commandes"
        element={
          <ProtectedRoute>
            <AppShell>
              <OrdersPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            <AppShell>
              <ClientsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/services"
        element={
          <ProtectedRoute>
            <AppShell>
              <ServicesPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/caisse"
        element={
          <ProtectedRoute>
            <AppShell>
              <CashPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tickets"
        element={
          <ProtectedRoute>
            <AppShell>
              <TicketsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rapports"
        element={
          <ProtectedRoute>
            <AppShell>
              <ReportsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/utilisateurs"
        element={
          <ProtectedRoute>
            <AppShell>
              <UsersPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/branding"
        element={
          <ProtectedRoute>
            <AppShell>
              <BrandingPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="/super-admin/connexion" element={<SuperAdminLoginPage />} />
      <Route
        path="/super-admin"
        element={
          <SuperAdminRoute>
            <SuperAdminShell>
              <SuperAdminDashboardPage />
            </SuperAdminShell>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/super-admin/tenants"
        element={
          <SuperAdminRoute>
            <SuperAdminShell>
              <SuperAdminTenantsPage />
            </SuperAdminShell>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/super-admin/tenants/:id"
        element={
          <SuperAdminRoute>
            <SuperAdminShell>
              <SuperAdminTenantDetailPage />
            </SuperAdminShell>
          </SuperAdminRoute>
        }
      />
    </Routes>
  );
}
