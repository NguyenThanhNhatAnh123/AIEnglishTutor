import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authApi } from '../services/api';
import Layout from '../components/Layout';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';

export default function Profile() {
  const { user } = useAuth();
  const toast = useToast();
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const displayName = user?.fullName || user?.username || 'Teacher';
  const initials = (user?.fullName?.slice(0, 2) || user?.username?.slice(0, 2) || 'TC').toUpperCase();
  const setPasswordField = (field) => (event) => {
    setPasswordForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submitPasswordChange = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Password confirmation does not match.');
      return;
    }
    setChangingPassword(true);
    try {
      await authApi.changePassword(passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl space-y-6">
        {/* Profile card */}
        <div className="card flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-700 to-blue-500 flex items-center justify-center text-white text-2xl font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-800">{displayName}</h2>
            {user?.fullName && user?.username && (
              <p className="text-slate-500 text-sm">@{user.username}</p>
            )}
            <p className="text-slate-400 text-sm">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge status="ACTIVE" label={user?.role || 'TEACHER'} />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="card space-y-4">
          <h3 className="section-title">Account Information</h3>
          {[
            { label: 'Full name', value: user?.fullName },
            { label: 'Username', value: user?.username },
            { label: 'Email', value: user?.email },
            { label: 'Role', value: user?.role },
            { label: 'User ID', value: user?.userId },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <span className="text-sm text-slate-500">{label}</span>
              <span className="text-sm font-medium text-slate-800">{value || '—'}</span>
            </div>
          ))}
        </div>

        <form className="card space-y-3" onSubmit={submitPasswordChange}>
          <h3 className="section-title">Change password</h3>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            value={passwordForm.currentPassword}
            onChange={setPasswordField('currentPassword')}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              minLength={6}
              value={passwordForm.newPassword}
              onChange={setPasswordField('newPassword')}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm password"
              minLength={6}
              value={passwordForm.confirmPassword}
              onChange={setPasswordField('confirmPassword')}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={changingPassword}>Update password</Button>
          </div>
        </form>

        <div className="card">
          <h3 className="section-title mb-1">Quick Links</h3>
          <p className="text-sm text-slate-400 mb-4">Navigate to key sections of your portal.</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'My Exams', to: '/exams' },
              { label: 'My Classes', to: '/classes' },
              { label: 'Analytics', to: '/analytics' },
            ].map(({ label, to }) => (
              <a key={to} href={to}
                className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition">
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
