import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { scoreApi } from '../services/api';
import { PageLoader } from '../components/common/LoadingSpinner';

function ScoreCircle({ value, max = 100, label, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const colors = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    amber: 'text-amber-600',
  };
  return (
    <div className="card text-center">
      <p className={`text-4xl font-extrabold ${colors[color]}`}>{value ?? '—'}</p>
      <p className="text-xs text-slate-400 mt-1 font-medium uppercase tracking-wider">{label}</p>
      {max !== 100 && <p className="text-xs text-slate-300 mt-0.5">/ {max}</p>}
    </div>
  );
}

function GradeLabel({ score }) {
  if (score === null || score === undefined) return null;
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F';
  const colors = { 'A+': 'text-green-600', A: 'text-green-500', B: 'text-blue-600', C: 'text-amber-600', D: 'text-orange-600', F: 'text-red-600' };
  return <span className={`text-6xl font-black ${colors[grade]}`}>{grade}</span>;
}

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
        <p className="text-blue-200 text-sm font-medium uppercase tracking-wider mb-2">Exam Result</p>
        <GradeLabel score={score?.totalScore} />
        <p className="text-5xl font-bold mt-2">{score?.totalScore ?? '—'}<span className="text-2xl text-blue-200 font-normal"> / 100</span></p>
        <p className="text-blue-200 mt-2 text-sm">
          {score ? 'Great work! Check your skill breakdown below.' : 'Score is not yet available.'}
        </p>
      </div>

      {score && (
        <>
          {/* Skill breakdown */}
          <h3 className="section-title">Skill Breakdown</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {score.mcScore != null && (
              <ScoreCircle value={score.mcScore} label="Multiple Choice" color="blue" />
            )}
            {score.writingScore != null && (
              <ScoreCircle value={score.writingScore} label="Writing" color="purple" />
            )}
            {score.speakingScore != null && (
              <ScoreCircle value={score.speakingScore} label="Speaking" color="green" />
            )}
          </div>

          {/* AI feedback */}
          {score.feedback && (
            <div className="card border-l-4 border-blue-500">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h4 className="font-semibold text-slate-800">AI Feedback</h4>
              </div>
              <p className="text-sm text-slate-600">{score.feedback}</p>
            </div>
          )}
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
