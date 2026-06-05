import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from '../../packages/ui/ErrorBoundary';
import { APP_BASE_PATH } from '../../packages/utils/constants.js';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ClassManagement = lazy(() => import('./pages/ClassManagement'));
const Teachers = lazy(() => import('./pages/Teachers'));
const Students = lazy(() => import('./pages/Students'));
const ExamManagement = lazy(() => import('./pages/ExamManagement'));
const QuestionBank = lazy(() => import('./pages/QuestionBank'));
const OcrWorkspace = lazy(() => import('./pages/OcrWorkspace'));
const StudentResults = lazy(() => import('./pages/StudentResults'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Profile = lazy(() => import('./pages/Profile'));

function PageFallback() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
      Loading...
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'ADMIN' ? children : <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/teachers" element={<AdminRoute><Teachers /></AdminRoute>} />
      <Route path="/classes" element={<PrivateRoute><ClassManagement /></PrivateRoute>} />
      <Route path="/students" element={<PrivateRoute><Students /></PrivateRoute>} />
      <Route path="/exams" element={<PrivateRoute><ExamManagement /></PrivateRoute>} />
      <Route path="/questions" element={<PrivateRoute><QuestionBank /></PrivateRoute>} />
      <Route path="/ocr" element={<PrivateRoute><OcrWorkspace /></PrivateRoute>} />
      <Route path="/results" element={<PrivateRoute><StudentResults /></PrivateRoute>} />
      <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
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
