import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/common/Button';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const data = res.data?.data;
      // Auth payload uses accessToken (not token)
      if (data?.accessToken) {
        const role = (data.role || '').toUpperCase();
        if (role === 'STUDENT') {
          toast.error('Please use the Student Portal to log in.');
          return;
        }
        login(data);
        navigate('/dashboard');
      } else {
        toast.error('Invalid response from server.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-blue-900 to-blue-700 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="font-bold text-lg">AI English Tutor</span>
        </div>

        <div>
          <h2 className="text-4xl font-bold leading-tight mb-4">Empower your<br />students with<br />AI grading</h2>
          <p className="text-blue-200 text-lg">Create exams, manage classes, and get deep insights into student performance all in one place.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Exam Types', value: 'MC · Writing · Speaking' },
            { label: 'AI Powered', value: 'Instant Grading' },
            { label: 'Analytics', value: 'Deep Insights' },
            { label: 'Classes', value: 'Easy Management' },
          ].map((s) => (
            <div key={s.label} className="bg-white/10 rounded-xl p-4">
              <p className="font-bold text-sm">{s.value}</p>
              <p className="text-blue-300 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right */}
      <div className="flex min-h-screen flex-1 flex-col justify-center overflow-y-auto bg-slate-50 p-6 sm:p-8">
        <div className="mx-auto w-full max-w-sm py-4">
          <div className="mb-8">
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="font-bold text-slate-800">AI English Tutor</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Teacher sign in</h1>
            <p className="mt-1 text-sm text-slate-500">Access your teacher dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="teacher-login-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="teacher-login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@example.com"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="teacher-login-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="teacher-login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-2 w-full">
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Are you a student?{' '}
            <a
              href={import.meta.env.VITE_STUDENT_PORTAL_URL || 'http://localhost:5173/login'}
              className="font-medium text-blue-600 hover:underline"
            >
              Open Student Portal
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}