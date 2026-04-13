import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './hooks/useToast';
import Toast from './components/Toast';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import StudentDetailPage from './pages/StudentDetailPage';
import InterventionPage from './pages/InterventionPage';
import InterventionsListPage from './pages/InterventionsListPage';
import ProblemsManagePage from './pages/ProblemsManagePage';
import PromiRuleUpdatesPage from './pages/PromiRuleUpdatesPage';

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected (guarded by Layout) */}
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/students/:studentId" element={<StudentDetailPage />} />
              <Route path="/interventions" element={<InterventionPage />} />
              <Route path="/interventions/new" element={<InterventionPage />} />
              <Route path="/interventions-list" element={<InterventionsListPage />} />
              <Route path="/promi-rules" element={<PromiRuleUpdatesPage />} />
              <Route path="/problems" element={<ProblemsManagePage />} />
            </Route>

            {/* Default */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toast />
      </ToastProvider>
    </ErrorBoundary>
  );
}
