import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { submissionApi } from '../services/api';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';

export default function SubmissionHistory() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    submissionApi.getMy()
      .then((r) => setSubmissions(r.data?.data || []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = submissions.filter((s) => {
    const name = (s.examTitle || `Exam #${s.examId}`).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="card !p-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by exam name..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No submissions found"
          description={search ? 'Try a different search.' : 'You have not submitted any exams yet.'}
          action={
            <Link to="/exams" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">
              Browse Exams
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden !p-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-700 text-sm">{filtered.length} submission{filtered.length !== 1 ? 's' : ''}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Exam</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Submitted</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {s.examTitle || `Exam #${s.examId}`}
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={s.status} label={s.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {s.submitTime ? new Date(s.submitTime).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.totalScore != null ? (
                        <span className="font-bold text-blue-700">{s.totalScore}</span>
                      ) : (
                        <span className="text-slate-300 text-xs">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(s.status === 'GRADED' || s.status === 'SUBMITTED') ? (
                        <Link
                          to={`/result/${s.id}`}
                          className="text-xs text-blue-600 font-semibold hover:underline"
                        >
                          View →
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
