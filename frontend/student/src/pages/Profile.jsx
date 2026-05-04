import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { submissionApi, studentApi } from '../services/api';
import Badge from '../components/common/Badge';
import { PageLoader } from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

function parseDob(value) {
  if (value == null || value === '') return null;
  if (Array.isArray(value) && value.length >= 3) {
    const [y, mo = 1, d = 1] = value;
    return new Date(Number(y), Number(mo) - 1, Number(d));
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ageFromDob(dob) {
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

function fmtDate(value) {
  const d = parseDob(value);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(value) {
  if (value == null || value === '') return '—';
  if (Array.isArray(value) && value.length >= 3) {
    const [y, mo = 1, d = 1, h = 0, mi = 0, s = 0] = value;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    if (!Number.isNaN(dt.getTime())) return dt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Profile() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([submissionApi.getMy(), studentApi.getMe().catch(() => null)])
      .then(([subRes, meRes]) => {
        if (cancelled) return;
        setSubmissions(subRes.data?.data || []);
        setProfile(meRes?.data?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setSubmissions([]);
          setProfile(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dobDate = useMemo(() => parseDob(profile?.dateOfBirth), [profile?.dateOfBirth]);
  const age = useMemo(() => ageFromDob(dobDate), [dobDate]);

  const displayName = profile?.fullName || user?.fullName || user?.username || 'Student';
  const displayEmail = profile?.email || user?.email;
  const displayUsername = user?.username;
  const studentCode = profile?.studentCode;
  const createdAt = profile?.createdAt;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="card flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {displayName[0]?.toUpperCase() || 'S'}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-800 truncate">{displayName}</h2>
          {displayUsername && <p className="text-slate-500 text-sm">@{displayUsername}</p>}
          {displayEmail && <p className="text-slate-400 text-sm truncate">{displayEmail}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge status="ACTIVE" label={user?.role || 'STUDENT'} />
            {studentCode && (
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                {studentCode}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="section-title">Student record</h3>
        {loading ? (
          <PageLoader />
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between gap-4 py-2 border-b border-slate-50">
              <dt className="text-slate-500">Full name</dt>
              <dd className="font-medium text-slate-800 text-right">{profile?.fullName || user?.fullName || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2 border-b border-slate-50">
              <dt className="text-slate-500">Student code</dt>
              <dd className="font-mono text-slate-800 text-right">{studentCode || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2 border-b border-slate-50">
              <dt className="text-slate-500">Date of birth</dt>
              <dd className="text-slate-800 text-right">{fmtDate(profile?.dateOfBirth)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2 border-b border-slate-50">
              <dt className="text-slate-500">Age</dt>
              <dd className="text-slate-800 text-right">{age != null ? `${age}` : '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2 border-b border-slate-50 sm:col-span-2">
              <dt className="text-slate-500">Account created</dt>
              <dd className="text-slate-800 text-right">{fmtDateTime(createdAt)}</dd>
            </div>
          </dl>
        )}
        {!loading && !profile && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3">
            Your student profile could not be loaded from the server. Showing sign-in details only.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-blue-600">{submissions.length}</p>
          <p className="text-xs text-slate-400 mt-1">Total submissions</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">
            {submissions.filter((s) => s.status === 'SUBMITTED' || s.status === 'AUTO_SUBMITTED').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Completed</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-amber-600">
            {submissions.filter((s) => s.status === 'IN_PROGRESS').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">In progress</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">Recent submissions</h3>
          <Link to="/submissions" className="text-sm text-blue-600 hover:underline">View all</Link>
        </div>
        {loading ? (
          <PageLoader />
        ) : submissions.length === 0 ? (
          <EmptyState title="No submissions yet" description="Complete an exam to see your results here." />
        ) : (
          <div className="card overflow-hidden !p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Exam</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {submissions.slice(0, 5).map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{s.examTitle || `Exam #${s.examId}`}</td>
                    <td className="px-4 py-3"><Badge status={s.status} label={s.status} /></td>
                    <td className="px-4 py-3 text-slate-400">{s.submitTime ? new Date(s.submitTime).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {s.totalScore != null ? (
                        <Link to={`/result/${s.id}`} className="text-blue-600 font-bold hover:underline">
                          {Math.round(s.totalScore * 10) / 10}
                        </Link>
                      ) : (s.status === 'SUBMITTED' || s.status === 'AUTO_SUBMITTED') ? (
                        <span className="text-slate-500 text-xs font-semibold">N/A</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
