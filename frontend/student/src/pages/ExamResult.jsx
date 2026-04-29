import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { scoreApi } from '../services/api';
import { PageLoader } from '../components/common/LoadingSpinner';

export default function ExamResult() {
  const { submissionId } = useParams();
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    scoreApi.getBySubmissionId(submissionId)
      .then((r) => setScore(r.data?.data))
      .catch(() => setScore(null))
      .finally(() => setLoading(false));
  }, [submissionId]);

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header card */}
      <div className="card text-center bg-gradient-to-r from-blue-700 to-blue-500 text-white !p-8">
        <p className="text-blue-200 text-sm font-medium uppercase tracking-wider mb-2">Exam Completed</p>
        <p className="text-3xl font-bold mt-2">Suspicious Activity Report</p>
        <p className="text-blue-100 mt-2 text-sm">
          Chỉ hiển thị các hành động bất thường trong lúc làm bài.
        </p>
      </div>

      {score && (
        <>
          <h3 className="section-title">Abnormal Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card">
              <p className="text-sm text-slate-500">Total suspicious events</p>
              <p className="text-3xl font-extrabold text-amber-600 mt-1">{score.suspiciousEventCount ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Tab switch count</p>
              <p className="text-3xl font-extrabold text-slate-700 mt-1">{score.tabSwitchCount ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Focus loss count</p>
              <p className="text-3xl font-extrabold text-slate-700 mt-1">{score.focusLossCount ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Copy/paste attempts</p>
              <p className="text-3xl font-extrabold text-slate-700 mt-1">{score.copyPasteCount ?? 0}</p>
            </div>
          </div>
        </>
      )}

      <div className="flex gap-3">
        <Link
          to="/dashboard"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
        >
          ← Back to Dashboard
        </Link>
        <Link
          to="/submissions"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
        >
          View All Submissions
        </Link>
      </div>
    </div>
  );
}
