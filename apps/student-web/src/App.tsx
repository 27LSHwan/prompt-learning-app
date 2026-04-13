import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './hooks/useToast';
import Toast from './components/Toast';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import ProblemsPage from './pages/ProblemsPage';
import ProblemWorkPage from './pages/ProblemWorkPage';
import SubmissionResultPage from './pages/SubmissionResultPage';
import RiskPage from './pages/RiskPage';
import HistoryPage from './pages/HistoryPage';
import RecommendPage from './pages/RecommendPage';

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Protected (guarded by Layout) */}
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/problems" element={<ProblemsPage />} />
              <Route path="/problems/:problemId/work" element={<ProblemWorkPage />} />
              <Route path="/submissions/:submissionId/result" element={<SubmissionResultPage />} />
              <Route path="/risk" element={<RiskPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/recommend" element={<RecommendPage />} />
            </Route>

            {/* Default */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          <Toast />
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
