import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from '../../packages/ui/ErrorBoundary';
import { APP_BASE_PATH } from '../../packages/utils/constants.js';

import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ClassManagement from './pages/ClassManagement';
import Students from './pages/Students';
import ExamManagement from './pages/ExamManagement';
import QuestionBank from './pages/QuestionBank';
import OcrWorkspace from './pages/OcrWorkspace';
import StudentResults from './pages/StudentResults';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
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
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
