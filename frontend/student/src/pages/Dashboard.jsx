import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { examApi, submissionApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/common/Badge';
import { PageLoader } from '../components/common/LoadingSpinner';

function StatCard({ label, value, icon, color }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      examApi.getAll().then((r) => r.data?.data || []),
      submissionApi.getMy().then((r) => r.data?.data || []).catch(() => []),
    ])
      .then(([e, s]) => { setExams(e); setSubmissions(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const completed = submissions.filter((s) => s.status === 'SUBMITTED' || s.status === 'GRADED').length;
  const pending = exams.filter((e) => e.status === 'ACTIVE').length - completed;
  const recentExams = exams.filter((e) => e.status === 'ACTIVE').slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 p-6 text-white">
        <p className="text-blue-200 text-sm font-medium uppercase tracking-wider mb-1">Welcome back,</p>
        <h2 className="text-2xl font-bold">{user?.username || 'Student'} 👋</h2>
        <p className="text-blue-100 mt-1 text-sm">Ready to practice your English today?</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Exams"
          value={exams.length}
          color="bg-blue-50 text-blue-600"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          label="Completed"
          value={completed}
          color="bg-green-50 text-green-600"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <StatCard
          label="Pending"
          value={Math.max(0, pending)}
          color="bg-amber-50 text-amber-600"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Recent exams */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Available Exams</h3>
          <Link to="/exams" className="text-sm text-blue-600 hover:underline font-medium">
            View all →
          </Link>
        </div>
        {recentExams.length === 0 ? (
          <div className="card text-center py-10 text-slate-400 text-sm">No exams available right now.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recentExams.map((exam) => (
              <Link
                key={exam.id}
                to={`/exam/${exam.id}`}
                className="card hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <Badge status={exam.status} label={exam.status} />
                </div>
                <h4 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{exam.title}</h4>
                {exam.description && (
                  <p className="text-sm text-slate-400 mt-1 line-clamp-2">{exam.description}</p>
                )}
                <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {exam.durationMinutes} minutes
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
