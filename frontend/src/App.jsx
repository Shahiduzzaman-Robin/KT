import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LedgersPage from './pages/LedgersPage';
import LedgerDetailsPage from './pages/LedgerDetailsPage';
import UsersPage from './pages/UsersPage';
import AuditLogsPage from './pages/AuditLogsPage';
import DailyReportsPage from './pages/DailyReportsPage';
import DailyClosurePage from './pages/DailyClosurePage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ledgers"
          element={
            <ProtectedRoute>
              <LedgersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ledgers/:id"
          element={
            <ProtectedRoute>
              <LedgerDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute>
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <DailyReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/close-day"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DailyClosurePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
