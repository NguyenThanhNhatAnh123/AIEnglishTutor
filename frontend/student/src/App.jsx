import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/layout/Layout';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import ExamList from './pages/ExamList';
import ExamRoom from './pages/ExamRoom';
import ExamResult from './pages/ExamResult';
import Profile from './pages/Profile';
import SubmissionHistory from './pages/SubmissionHistory';

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
        <Route path="/submissions" element={<SubmissionHistory />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* Full-screen exam routes (no sidebar) */}
      <Route
        path="/exam/:id"
        element={
          <RequireAuth>
            <ExamRoom />
          </RequireAuth>
        }
      />
      <Route
        path="/result/:submissionId"
        element={
          <RequireAuth>
            <div className="min-h-screen bg-slate-50">
              <div className="max-w-3xl mx-auto px-6 py-8">
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
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
