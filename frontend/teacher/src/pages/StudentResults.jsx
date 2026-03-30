import { useState, useEffect } from 'react';
import { examApi, submissionApi, scoreApi } from '../services/api';
import Layout from '../components/Layout';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';

function ScoreDetailModal({ submission, onClose }) {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    scoreApi.getBySubmissionId(submission.id)
      .then((r) => setScore(r.data?.data))
      .catch(() => setScore(null))
      .finally(() => setLoading(false));
  }, [submission.id]);

  return (
    <Modal isOpen onClose={onClose} title={`Score – ${submission.studentName || `Student #${submission.userId}`}`} maxWidth="max-w-lg">
      {loading ? <PageLoader /> : !score ? (
        <p className="text-slate-400 text-sm">Score not yet available for this submission.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Score', value: score.totalScore, color: 'text-blue-700' },
              { label: 'MC Score', value: score.mcScore, color: 'text-slate-700' },
              { label: 'Writing Score', value: score.writingScore, color: 'text-purple-700' },
              { label: 'Speaking Score', value: score.speakingScore, color: 'text-green-700' },
            ].filter((x) => x.value != null).map((item) => (
              <div key={item.label} className="card text-center !p-4">
                <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-slate-400 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
          {score.feedback && (
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">AI Feedback</p>
              <p className="text-sm text-slate-700">{score.feedback}</p>
            </div>
          )}
          <div className="text-xs text-slate-400">
            Submitted: {submission.submitTime ? new Date(submission.submitTime).toLocaleString() : '—'}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function StudentResults() {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [selectedSub, setSelectedSub] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    examApi.getAll()
      .then((r) => setExams(r.data?.data || []))
      .catch(() => setExams([]));
  }, []);

  useEffect(() => {
    if (!selectedExamId) { setSubmissions([]); return; }
    setLoadingSubs(true);
    submissionApi.getByExamId(parseInt(selectedExamId))
      .then((r) => setSubmissions(r.data?.data || []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoadingSubs(false));
  }, [selectedExamId]);

  const filtered = submissions.filter((s) => {
    const name = (s.studentName || `Student #${s.userId}`).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <Layout>
      <div className="space-y-5">
        <div className="card !p-4 flex flex-col sm:flex-row gap-3">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select an exam...</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          {selectedExamId && (
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students..."
                className="pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
        </div>

        {!selectedExamId ? (
          <EmptyState title="Select an exam" description="Choose an exam above to view student submissions." />
        ) : loadingSubs ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState title="No submissions" description="No students have submitted this exam yet." />
        ) : (
          <div className="card overflow-hidden !p-0">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">{filtered.length} submission{filtered.length !== 1 ? 's' : ''}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Submitted</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Score</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{s.studentName || `Student #${s.userId}`}</td>
                    <td className="px-4 py-3"><Badge status={s.status} label={s.status} /></td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{s.submitTime ? new Date(s.submitTime).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-center font-bold text-blue-700">{s.totalScore ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedSub(s)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedSub && <ScoreDetailModal submission={selectedSub} onClose={() => setSelectedSub(null)} />}
    </Layout>
  );
}
