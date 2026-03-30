import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { submissionApi } from '../services/api';
import Badge from '../components/common/Badge';
import { PageLoader } from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

export default function Profile() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    submissionApi.getMy()
      .then((r) => setSubmissions(r.data?.data || []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Profile card */}
      <div className="card flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {user?.username?.[0]?.toUpperCase() || 'S'}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-800">{user?.username}</h2>
          <p className="text-slate-400 text-sm">{user?.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge status="ACTIVE" label={user?.role || 'STUDENT'} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-blue-600">{submissions.length}</p>
          <p className="text-xs text-slate-400 mt-1">Total Submissions</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">
            {submissions.filter((s) => s.status === 'GRADED').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Graded</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-amber-600">
            {submissions.filter((s) => s.status === 'SUBMITTED').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Pending</p>
        </div>
      </div>

      {/* Recent submissions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">Recent Submissions</h3>
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
                        <Link to={`/result/${s.id}`} className="text-blue-600 font-bold hover:underline">{s.totalScore}</Link>
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
