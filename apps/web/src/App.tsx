import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { OrdersPage } from './pages/OrdersPage';
import { RegisterPage } from './pages/RegisterPage';

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
    </Routes>
  );
}
