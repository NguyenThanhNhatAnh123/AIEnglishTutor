import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from '../../packages/ui/ErrorBoundary';
import { APP_BASE_PATH } from '../../packages/utils/constants.js';
import Layout from './components/layout/Layout';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ExamList = lazy(() => import('./pages/ExamList'));
const ExamPage = lazy(() => import('./pages/ExamPage'));
const ExamResult = lazy(() => import('./pages/ExamResult'));
const Profile = lazy(() => import('./pages/Profile'));
const SubmissionHistory = lazy(() => import('./pages/SubmissionHistory'));
const Learning = lazy(() => import('./pages/Learning'));

function PageFallback() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
      Loading...
    </div>
  );
}

function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes using Layout shell */}
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/exams" element={<ExamList />} />
        <Route path="/learning" element={<Learning />} />
        <Route path="/submissions" element={<SubmissionHistory />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* Full-screen exam routes (no sidebar) */}
      <Route
        path="/exam/:id"
        element={
          <RequireAuth>
            <ExamPage />
          </RequireAuth>
        }
      />
      <Route
        path="/result/:submissionId"
        element={
          <RequireAuth>
            <div className="min-h-screen bg-slate-50">
              <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6">
                <ExamResult />
              </div>
            </div>
          </RequireAuth>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename={APP_BASE_PATH || undefined}>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<PageFallback />}>
              <AppRoutes />
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
