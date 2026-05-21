import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import Button from '../components/common/Button';

export default function RegisterPage() {
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await authApi.register({
        fullName: form.fullName,
        username: form.username,
        email: form.email,
        password: form.password,
      });
      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { id: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Nguyen Van A' },
    { id: 'username', label: 'Username', type: 'text', placeholder: 'johndoe' },
    { id: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
    { id: 'password', label: 'Password', type: 'password', placeholder: 'Enter your password' },
    { id: 'confirmPassword', label: 'Confirm Password', type: 'password', placeholder: 'Re-enter your password' },
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-blue-800 to-blue-600 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <span className="font-bold text-lg">AI English Tutor</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Start your
            <br />
            English learning
            <br />
            journey today
          </h2>
          <p className="text-blue-200 text-lg">
            Join thousands of students improving their English skills with AI-powered exams and feedback.
          </p>
        </div>
        <ul className="space-y-3">
          {['Instant AI grading on writing & speaking', 'Detailed skill breakdown reports', 'Track your progress over time'].map((item) => (
            <li key={item} className="flex items-center gap-2 text-blue-100 text-sm">
              <svg className="w-5 h-5 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
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
            <h1 className="text-2xl font-bold text-slate-800">Create an account</h1>
            <p className="mt-1 text-sm text-slate-500">Get started with your free student account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map(({ id, label, type, placeholder }) => (
              <div key={id}>
                <label htmlFor={`register-${id}`} className="mb-1.5 block text-sm font-medium text-slate-700">
                  {label}
                </label>
                <input
                  id={`register-${id}`}
                  type={type}
                  autoComplete={
                    id === 'email' ? 'email'
                      : id === 'password' ? 'new-password'
                        : id === 'confirmPassword' ? 'new-password'
                          : id === 'username' ? 'username'
                            : 'name'
                  }
                  value={form[id]}
                  onChange={set(id)}
                  placeholder={placeholder}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-2">
              Create Account
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
