import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SuperAdminRoute } from './components/SuperAdminRoute';
import { SuperAdminShell } from './components/SuperAdminShell';
import { AuditPage } from './pages/AuditPage';
import { BrandingPage } from './pages/BrandingPage';
import { CashPage } from './pages/CashPage';
import { ClientsPage } from './pages/ClientsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { OrderCheckoutPage } from './pages/OrderCheckoutPage';
import { OrdersPage } from './pages/OrdersPage';
import { RegisterPage } from './pages/RegisterPage';
import { ReportsPage } from './pages/ReportsPage';
import { ServicesPage } from './pages/ServicesPage';
import { StocksPage } from './pages/StocksPage';
import { SuperAdminAuditPage } from './pages/SuperAdminAuditPage';
import { SuperAdminDashboardPage } from './pages/SuperAdminDashboardPage';
import { SuperAdminLoginPage } from './pages/SuperAdminLoginPage';
import { SuperAdminPlansPage } from './pages/SuperAdminPlansPage';
import { SuperAdminSupportPage } from './pages/SuperAdminSupportPage';
import { SuperAdminSupportTicketDetailPage } from './pages/SuperAdminSupportTicketDetailPage';
import { SuperAdminTenantDetailPage } from './pages/SuperAdminTenantDetailPage';
import { SuperAdminTenantsPage } from './pages/SuperAdminTenantsPage';
import { SuperAdminUsersPage } from './pages/SuperAdminUsersPage';
import { SupportPage } from './pages/SupportPage';
import { SupportTicketDetailPage } from './pages/SupportTicketDetailPage';
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
        path="/commandes/:id/encaisser"
        element={
          <ProtectedRoute>
            <AppShell>
              <OrderCheckoutPage />
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
        path="/stocks"
        element={
          <ProtectedRoute>
            <AppShell>
              <StocksPage />
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
      <Route
        path="/audit"
        element={
          <ProtectedRoute>
            <AppShell>
              <AuditPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/support"
        element={
          <ProtectedRoute>
            <AppShell>
              <SupportPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/support/:id"
        element={
          <ProtectedRoute>
            <AppShell>
              <SupportTicketDetailPage />
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
        path="/super-admin/utilisateurs"
        element={
          <SuperAdminRoute>
            <SuperAdminShell>
              <SuperAdminUsersPage />
            </SuperAdminShell>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/super-admin/plans"
        element={
          <SuperAdminRoute>
            <SuperAdminShell>
              <SuperAdminPlansPage />
            </SuperAdminShell>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/super-admin/audit"
        element={
          <SuperAdminRoute>
            <SuperAdminShell>
              <SuperAdminAuditPage />
            </SuperAdminShell>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/super-admin/support-tickets"
        element={
          <SuperAdminRoute>
            <SuperAdminShell>
              <SuperAdminSupportPage />
            </SuperAdminShell>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/super-admin/support-tickets/:id"
        element={
          <SuperAdminRoute>
            <SuperAdminShell>
              <SuperAdminSupportTicketDetailPage />
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
