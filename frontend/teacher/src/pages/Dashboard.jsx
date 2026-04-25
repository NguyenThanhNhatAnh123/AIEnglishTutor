import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { classApi, examApi, questionApi, API_ORIGIN } from '../services/api';
import Layout from '../components/Layout';
import { PageLoader } from '../components/common/LoadingSpinner';

function KpiCard({ label, value, icon, color, to }) {
  const inner = (
    <div className={`card flex items-center gap-4 hover:shadow-md transition-shadow ${to ? 'cursor-pointer' : ''}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value ?? '—'}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function Dashboard() {
  const [stats, setStats] = useState({ classes: 0, exams: 0, pending: 0 });
  const [recentExams, setRecentExams] = useState([]);
  const [audioQuestions, setAudioQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      classApi.getAll().then((r) => r.data?.data || []),
      examApi.getAll().then((r) => r.data?.data || []),
      questionApi.getAll().then((r) => r.data?.data || []),
    ])
      .then(([classes, exams, questions]) => {
        const activeExams = exams.filter((e) => e.status === 'ACTIVE');
        const listeningWithAudio = questions.filter(
          (q) => q.questionType === 'LISTENING' && typeof q.listeningAudioUrl === 'string' && q.listeningAudioUrl.length > 0
        );
        setStats({
          classes: classes.length,
          exams: activeExams.length,
          total: exams.length,
          listeningAudio: listeningWithAudio.length,
        });
        setRecentExams(exams.slice(0, 5));
        setAudioQuestions(listeningWithAudio.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Layout>
      <PageLoader />
    </Layout>
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome */}
        <div className="rounded-2xl bg-gradient-to-r from-blue-800 to-blue-600 p-6 text-white">
          <p className="text-blue-200 text-sm font-medium uppercase tracking-wider mb-1">Teacher Dashboard</p>
          <h2 className="text-2xl font-bold">Welcome back! 👋</h2>
          <p className="text-blue-100 mt-1 text-sm">Here&apos;s an overview of your platform activity.</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Classes" value={stats.classes} to="/classes"
            color="bg-blue-50 text-blue-600"
            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
          />
          <KpiCard label="Active Exams" value={stats.exams} to="/exams"
            color="bg-green-50 text-green-600"
            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"/></svg>}
          />
          <KpiCard label="Total Exams" value={stats.total} to="/exams"
            color="bg-purple-50 text-purple-600"
            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>}
          />
          <KpiCard label="View Analytics" value="→" to="/analytics"
            color="bg-amber-50 text-amber-600"
            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title">Listening Audio (MP3 ready)</h3>
            <Link to="/questions" className="text-sm text-blue-600 hover:underline font-medium">Manage questions →</Link>
          </div>
          <div className="card space-y-3">
            <p className="text-sm text-slate-600">
              Total listening questions with audio: <strong>{stats.listeningAudio ?? 0}</strong>
            </p>
            {audioQuestions.length === 0 ? (
              <p className="text-sm text-slate-400">No listening audio found yet.</p>
            ) : (
              audioQuestions.map((q) => {
                const src = q.listeningAudioUrl?.startsWith('http')
                  ? q.listeningAudioUrl
                  : `${API_ORIGIN}${q.listeningAudioUrl?.startsWith('/') ? '' : '/'}${q.listeningAudioUrl || ''}`;
                return (
                  <div key={q.id} className="border border-slate-100 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">{q.examTitle || 'Exam'} · {q.sectionName || 'Section'}</p>
                    <p className="text-sm text-slate-700 line-clamp-2 mb-2">{q.questionText}</p>
                    <audio controls className="w-full" src={src} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent exams table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title">Recent Exams</h3>
            <Link to="/exams" className="text-sm text-blue-600 hover:underline font-medium">View all →</Link>
          </div>
          <div className="card overflow-hidden !p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Duration</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentExams.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-400">No exams yet.</td></tr>
                ) : recentExams.map((e) => {
                  const canManage = e.canManage !== false;
                  return (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{e.title}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        e.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        e.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-600'
                      }`}>{e.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">{e.durationMinutes} min</td>
                    <td className="px-4 py-3 text-right text-xs">
                      {canManage ? (
                        <>
                          <Link to="/exams" className="text-blue-600 hover:underline font-medium mr-2">Exams</Link>
                          <Link to={`/questions?examId=${e.id}`} className="text-blue-600 hover:underline font-medium">Questions</Link>
                        </>
                      ) : (
                        <span className="text-slate-400">View only</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
