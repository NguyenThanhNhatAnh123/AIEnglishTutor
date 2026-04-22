import { useState, useEffect } from 'react';
import { examApi, submissionApi, scoreApi, API_ORIGIN } from '../services/api';
import Layout from '../components/Layout';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import AudioPlayer from '../../../packages/ui/AudioPlayer.jsx';
import SpeakingWaveform from '../../../packages/ui/SpeakingWaveform.jsx';

function resolveMediaSrc(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

function formatDurationSeconds(sec) {
  if (sec == null || Number.isNaN(sec)) return '—';
  const n = Math.max(0, Math.floor(sec));
  const m = Math.floor(n / 60);
  const s = n % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function speakingAnswers(list) {
  return (list || []).filter((a) => {
    const t = (a.questionType || '').toUpperCase();
    if (t !== 'SPEAKING') return false;
    const u = a.speakingAudioUrl;
    return typeof u === 'string' && u.length > 0;
  });
}

function totalSpeakingSeconds(list) {
  return speakingAnswers(list).reduce((sum, a) => sum + (a.speakingDurationSeconds || 0), 0);
}

function formatCompletion(submission) {
  const pct = submission.completionPercent;
  const answered = submission.answeredQuestions;
  const total = submission.totalQuestions;
  if (pct != null && total != null && answered != null) return `${pct}% (${answered}/${total})`;
  if (pct != null) return `${pct}%`;
  return 'N/A';
}

function formatSuspicious(submission) {
  const total = Number(submission.suspiciousEventCount || 0);
  const tab = Number(submission.tabSwitchCount || 0);
  const focus = Number(submission.focusLossCount || 0);
  const cp = Number(submission.copyPasteCount || 0);
  const base = `${total} evt`;
  if (total <= 0) return base;
  return `${base} (tab ${tab}, focus ${focus}, copy/paste ${cp})`;
}

async function downloadSpeakingClip(submissionId, answerId) {
  const res = await submissionApi.downloadSpeaking(submissionId, answerId);
  const blob = res.data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `speaking-${submissionId}-${answerId}.mp3`;
  a.click();
  URL.revokeObjectURL(url);
}

function ScoreDetailModal({ submission, onClose }) {
  const [score, setScore] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [scoreRes, ansRes] = await Promise.all([
          scoreApi.getBySubmissionId(submission.id),
          submissionApi.getAnswers(submission.id),
        ]);
        if (!cancelled) {
          setScore(scoreRes.data?.data ?? null);
          setAnswers(ansRes.data?.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setScore(null);
          setAnswers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [submission.id]);

  return (
    <Modal isOpen onClose={onClose} title={`Score – ${submission.studentName || `Student #${submission.studentId}`}`} maxWidth="max-w-lg">
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
          {speakingAnswers(answers).length > 0 && (
            <div className="rounded-xl border border-slate-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Speaking</p>
              {speakingAnswers(answers).map((a) => (
                <div key={a.id} className="space-y-1">
                  <p className="text-xs text-slate-400">Question #{a.questionId}</p>
                  <AudioPlayer src={resolveMediaSrc(a.speakingAudioUrl)} disabled={false} />
                  <SpeakingWaveform src={resolveMediaSrc(a.speakingAudioUrl)} />
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => downloadSpeakingClip(submission.id, a.id)}
                  >
                    Download MP3
                  </button>
                  {a.speakingDurationSeconds != null && (
                    <p className="text-xs text-slate-400">{a.speakingDurationSeconds}s · {a.speakingFormat || 'mp3'}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {score.feedback && (
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">AI Feedback</p>
              <p className="text-sm text-slate-700">{score.feedback}</p>
            </div>
          )}
          <div className="text-xs text-slate-400 space-y-1">
            <p>Started: {submission.startTime ? new Date(submission.startTime).toLocaleString() : '—'}</p>
            <p>Ended: {submission.endTime ? new Date(submission.endTime).toLocaleString() : (submission.submitTime ? new Date(submission.submitTime).toLocaleString() : '—')}</p>
            <p>Time spent: {formatDurationSeconds(submission.durationSeconds)}</p>
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
  const [answerMap, setAnswerMap] = useState({});
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [minSpeakingSec, setMinSpeakingSec] = useState('');

  useEffect(() => {
    examApi.getAll()
      .then((r) => {
        const list = (r.data?.data || []).filter((ex) => ex.canManage !== false);
        setExams(list);
        setSelectedExamId((prev) =>
          prev && list.some((ex) => String(ex.id) === String(prev)) ? prev : ''
        );
      })
      .catch(() => setExams([]));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset dependent state when exam changes
    if (!selectedExamId) { setSubmissions([]); return; }
    setLoadingSubs(true);
    submissionApi.getByExamId(parseInt(selectedExamId))
      .then((r) => setSubmissions(r.data?.data || []))
      .catch((err) => {
        setSubmissions([]);
        if (err.response?.status === 403) {
          // Teacher doesn't own this exam — backend enforces ownership
          alert('You do not have permission to view submissions for this exam.');
        }
      })
      .finally(() => setLoadingSubs(false));
  }, [selectedExamId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear cached answers when list empties
    if (!submissions.length) {
      setAnswerMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      const map = {};
      await Promise.all(
        submissions.map(async (s) => {
          try {
            const r = await submissionApi.getAnswers(s.id);
            map[s.id] = r.data?.data || [];
          } catch {
            map[s.id] = [];
          }
        })
      );
      if (!cancelled) setAnswerMap(map);
    })();
    return () => { cancelled = true; };
  }, [submissions]);

  const filtered = submissions.filter((s) => {
    const name = (s.studentName || `Student #${s.studentId}`).toLowerCase();
    if (!name.includes(search.toLowerCase())) return false;
    if (minScore !== '' && (s.totalScore == null || Number(s.totalScore) < Number(minScore))) return false;
    if (maxScore !== '' && (s.totalScore == null || Number(s.totalScore) > Number(maxScore))) return false;
    if (minSpeakingSec !== '') {
      const sp = totalSpeakingSeconds(answerMap[s.id]);
      if (sp < Number(minSpeakingSec)) return false;
    }
    return true;
  });

  const selectedExamTitle = exams.find((e) => String(e.id) === String(selectedExamId))?.title || '';

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

        {selectedExamId && (
          <div className="card !p-4 flex flex-wrap gap-3 items-end">
            <label className="text-xs text-slate-500 block">Min score
              <input type="number" value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="0"
                className="mt-1 block w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            </label>
            <label className="text-xs text-slate-500 block">Max score
              <input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} placeholder="100"
                className="mt-1 block w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            </label>
            <label className="text-xs text-slate-500 block">Min speaking (sum sec)
              <input type="number" value={minSpeakingSec} onChange={(e) => setMinSpeakingSec(e.target.value)} placeholder="0"
                className="mt-1 block w-28 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            </label>
          </div>
        )}

        {!selectedExamId ? (
          <EmptyState
            title={exams.length === 0 ? 'No manageable exams' : 'Select an exam'}
            description={
              exams.length === 0
                ? 'You can only view submissions for exams you own.'
                : 'Choose an exam above to view student submissions.'
            }
          />
        ) : loadingSubs ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={submissions.length === 0 ? 'No submissions' : 'No matches'}
            description={submissions.length === 0 ? 'No students have submitted this exam yet.' : 'Adjust filters or search.'}
          />
        ) : (
          <div className="card overflow-hidden !p-0">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">
                {filtered.length} submission{filtered.length !== 1 ? 's' : ''}
                {selectedExamTitle ? ` · ${selectedExamTitle}` : ''}
              </p>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">End</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Duration</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Completion</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Suspicious</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Speaking</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Score</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{s.studentName || `Student #${s.studentId}`}</td>
                    <td className="px-4 py-3"><Badge status={s.status} label={s.status} /></td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{s.startTime ? new Date(s.startTime).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{(s.endTime || s.submitTime) ? new Date(s.endTime || s.submitTime).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{formatDurationSeconds(s.durationSeconds)}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{formatCompletion(s)}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs max-w-[240px]">
                      <span className={`font-semibold ${Number(s.suspiciousEventCount || 0) > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                        {formatSuspicious(s)}
                      </span>
                      {s.deviceType && (
                        <span className="block text-[11px] text-slate-400 mt-0.5">{s.deviceType}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {speakingAnswers(answerMap[s.id]).length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="flex flex-col gap-2 max-w-[220px]">
                          {speakingAnswers(answerMap[s.id]).map((a) => (
                            <div key={a.id} className="space-y-1 border-b border-slate-50 pb-2 last:border-0">
                              <AudioPlayer src={resolveMediaSrc(a.speakingAudioUrl)} disabled={false} />
                              <SpeakingWaveform src={resolveMediaSrc(a.speakingAudioUrl)} />
                              <button
                                type="button"
                                className="text-xs text-blue-600 hover:underline"
                                onClick={() => downloadSpeakingClip(s.id, a.id)}
                              >
                                Download MP3
                              </button>
                              {a.speakingDurationSeconds != null && (
                                <span className="text-xs text-slate-400 block">{a.speakingDurationSeconds}s</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-blue-700">{s.totalScore ?? '—'}</td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedSub(s)}>View</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={async () => {
                          if (!window.confirm('Delete this submission and remove all speaking files from the server?')) return;
                          try {
                            await submissionApi.delete(s.id);
                            setSubmissions((prev) => prev.filter((x) => x.id !== s.id));
                            setAnswerMap((prev) => {
                              const next = { ...prev };
                              delete next[s.id];
                              return next;
                            });
                          } catch {
                            alert('Delete failed.');
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {selectedSub && <ScoreDetailModal submission={selectedSub} onClose={() => setSelectedSub(null)} />}
    </Layout>
  );
}
