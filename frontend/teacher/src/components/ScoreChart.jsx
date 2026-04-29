import { useState, useEffect } from 'react';
import { scoreApi } from '../services/api';

export default function ScoreChart({ submissionId }) {
  const [score, setScore] = useState(null);
  const [loadedSubmissionId, setLoadedSubmissionId] = useState(null);

  useEffect(() => {
    if (!submissionId || loadedSubmissionId === submissionId) {
      return;
    }
    let cancelled = false;
    scoreApi.getBySubmissionId(submissionId)
      .then((r) => {
        if (!cancelled) {
          setScore(r.data?.data ?? null);
          setLoadedSubmissionId(submissionId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScore(null);
          setLoadedSubmissionId(submissionId);
        }
      });
    return () => { cancelled = true; };
  }, [loadedSubmissionId, submissionId]);

  const loading = Boolean(submissionId) && loadedSubmissionId !== submissionId;

  if (!submissionId) {
    return <p className="text-slate-500">Enter a submission ID to view scores.</p>;
  }
  if (loading) return <p className="text-slate-400">Loading...</p>;
  if (!score) return <p className="text-slate-500">Score not found.</p>;

  const items = [
    { label: 'MC Score', value: score.mcScore },
    { label: 'Writing Score', value: score.writingScore },
    { label: 'Speaking Score', value: score.speakingScore },
    { label: 'Total Score', value: score.totalScore },
  ].filter((i) => i.value != null);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="p-5 rounded-xl bg-slate-800 border border-slate-700">
          <p className="text-slate-400 text-sm">{item.label}</p>
          <p className="text-2xl font-bold text-white mt-2">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
