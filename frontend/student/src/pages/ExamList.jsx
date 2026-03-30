import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { examApi } from '../services/api';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';

export default function ExamList() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    examApi.getAll()
      .then((r) => setExams(r.data?.data || []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, []);

  const statuses = ['ALL', 'ACTIVE', 'DRAFT', 'CLOSED'];

  const filtered = exams.filter((e) => {
    const matchSearch = e.title?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || e.status === filter;
    return matchSearch && matchFilter;
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="card !p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exams..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                filter === s
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No exams found"
          description={search ? 'Try a different search term.' : 'There are no exams available yet.'}
        />
      ) : (
        <>
          <p className="text-sm text-slate-400">{filtered.length} exam{filtered.length !== 1 ? 's' : ''} found</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((exam) => (
              <Link
                key={exam.id}
                to={`/exam/${exam.id}`}
                className="card hover:shadow-md hover:border-blue-200 border border-slate-100 transition-all group flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <Badge status={exam.status} label={exam.status} />
                </div>
                <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors mb-1">
                  {exam.title}
                </h3>
                {exam.description && (
                  <p className="text-sm text-slate-400 line-clamp-2 flex-1">{exam.description}</p>
                )}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {exam.durationMinutes} min
                  </div>
                  <span className="text-xs text-blue-600 font-medium group-hover:underline">
                    Start exam →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
