import { useState, useEffect } from 'react';
import { examApi, submissionApi, scoreApi } from '../services/api';
import Layout from '../components/Layout';
import { PageLoader } from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

function BarChart({ data }) {
  if (!data || data.length === 0) {
    return <EmptyState title="No data available" description="Submit some exams to see analytics." />;
  }
  const max = Math.max(...data.map((d) => d.avg), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700 font-medium truncate max-w-xs">{item.label}</span>
            <span className="text-blue-700 font-bold ml-2">{item.avg.toFixed(1)}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-400 h-2.5 rounded-full transition-all duration-700"
              style={{ width: `${(item.avg / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [exams, setExams] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [avgScore, setAvgScore] = useState(null);
  const [suspiciousEvents, setSuspiciousEvents] = useState(0);
  const [flaggedSubmissions, setFlaggedSubmissions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    examApi.getAll()
      .then(async (r) => {
        const examList = r.data?.data || [];
        setExams(examList);

        // Fetch submissions and scores per exam
        let allScores = [];
        let suspiciousTotal = 0;
        let flaggedTotal = 0;
        const cd = [];

        await Promise.all(
          examList.map(async (exam) => {
            try {
              const subRes = await submissionApi.getByExamId(exam.id);
              const subs = subRes.data?.data || [];
              const submitted = subs.filter((s) => s.status === 'SUBMITTED' || s.status === 'AUTO_SUBMITTED');
              submitted.forEach((s) => {
                const suspicious = Number(s.suspiciousEventCount || 0);
                suspiciousTotal += suspicious;
                if (suspicious > 0) flaggedTotal += 1;
              });

              const scores = [];
              await Promise.all(
                submitted.map(async (s) => {
                  try {
                    const sRes = await scoreApi.getBySubmissionId(s.id);
                    const sc = sRes.data?.data?.totalScore;
                    if (sc != null) scores.push(sc);
                  } catch {
                    return null;
                  }
                })
              );

              if (scores.length > 0) {
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                cd.push({ label: exam.title, avg, count: scores.length });
                allScores = [...allScores, ...scores];
              }
            } catch {
              return null;
            }
          })
        );

        setChartData(cd.sort((a, b) => b.avg - a.avg));
        setTotalSubmissions(allScores.length);
        setSuspiciousEvents(suspiciousTotal);
        setFlaggedSubmissions(flaggedTotal);
        if (allScores.length > 0) {
          setAvgScore((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const kpis = [
    { label: 'Total Exams', value: exams.length, color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Exams', value: exams.filter((e) => e.status === 'ACTIVE').length, color: 'bg-green-50 text-green-600' },
    { label: 'Total Graded', value: totalSubmissions, color: 'bg-purple-50 text-purple-600' },
    { label: 'Avg Score', value: avgScore ?? '—', color: 'bg-amber-50 text-amber-600' },
    { label: 'Flagged Subs', value: flaggedSubmissions, color: 'bg-rose-50 text-rose-600' },
    { label: 'Suspicious Events', value: suspiciousEvents, color: 'bg-orange-50 text-orange-600' },
  ];

  if (loading) return <Layout><PageLoader /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-blue-800 to-blue-600 p-6 text-white">
          <p className="text-blue-200 text-sm uppercase tracking-wider mb-1">Platform Analytics</p>
          <h2 className="text-2xl font-bold">Performance Overview</h2>
          <p className="text-blue-100 mt-1 text-sm">Aggregated data across all exams and submissions.</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="card text-center">
              <p className={`text-3xl font-bold ${k.color.split(' ')[1]}`}>{k.value}</p>
              <p className="text-sm text-slate-500 mt-1">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="card">
          <h3 className="section-title mb-5">Average Score Per Exam</h3>
          <BarChart data={chartData} />
        </div>

        {/* Exam breakdown table */}
        {chartData.length > 0 && (
          <div className="card overflow-hidden !p-0">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm">Exam Breakdown</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Exam</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Graded</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Avg Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {chartData.map((d) => (
                  <tr key={d.label} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{d.label}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{d.count}</td>
                    <td className="px-4 py-3 text-center font-bold text-blue-700">{d.avg.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
