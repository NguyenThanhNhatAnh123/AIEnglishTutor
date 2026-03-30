import { useState, useEffect } from 'react';
import { questionApi, examApi } from '../services/api';
import Layout from '../components/Layout';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { useToast } from '../context/ToastContext';

function AddQuestionModal({ onClose, onSuccess }) {
  const [exams, setExams] = useState([]);
  const [sections, setSections] = useState([]);
  const [form, setForm] = useState({ sectionId: '', questionText: '', questionType: 'MULTIPLE_CHOICE', points: 1, options: [{ optionText: '', isCorrect: false }, { optionText: '', isCorrect: false }] });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    examApi.getAll().then((r) => {
      const list = r.data?.data || [];
      setExams(list);
      if (list[0]) {
        examApi.getById(list[0].id).then((res) => {
          const secs = res.data?.data?.sections || [];
          setSections(secs);
          if (secs[0]) setForm((f) => ({ ...f, sectionId: secs[0].id }));
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const updateOption = (i, field, val) => setForm((f) => ({ ...f, options: f.options.map((o, j) => j === i ? { ...o, [field]: val } : o) }));
  const addOption = () => setForm((f) => ({ ...f, options: [...f.options, { optionText: '', isCorrect: false }] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await questionApi.create({ ...form, sectionId: parseInt(form.sectionId), options: form.options.filter((o) => o.optionText.trim()) });
      toast.success('Question added!');
      onSuccess();
    } catch {
      toast.error('Failed to add question.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Section</label>
        <select value={form.sectionId} onChange={(e) => setForm((f) => ({ ...f, sectionId: e.target.value }))}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Question</label>
        <textarea value={form.questionText} onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))} rows={3} required
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
          <select value={form.questionType} onChange={(e) => setForm((f) => ({ ...f, questionType: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="MULTIPLE_CHOICE">Multiple Choice</option>
            <option value="WRITING">Writing</option>
            <option value="SPEAKING">Speaking</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Points</label>
          <input type="number" value={form.points} min={1} onChange={(e) => setForm((f) => ({ ...f, points: parseInt(e.target.value) || 1 }))}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      {form.questionType === 'MULTIPLE_CHOICE' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Options</label>
          <div className="space-y-2">
            {form.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={o.optionText} onChange={(e) => updateOption(i, 'optionText', e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
                  <input type="checkbox" checked={o.isCorrect} onChange={(e) => updateOption(i, 'isCorrect', e.target.checked)} className="accent-blue-600" />
                  Correct
                </label>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addOption}>+ Add Option</Button>
          </div>
        </div>
      )}
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" loading={loading}>Add Question</Button>
      </div>
    </form>
  );
}

export default function QuestionBank() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    questionApi.getAll()
      .then((r) => setQuestions(r.data?.data || []))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const types = ['ALL', 'MULTIPLE_CHOICE', 'WRITING', 'SPEAKING'];
  const filtered = questions.filter((q) => {
    const matchType = filter === 'ALL' || q.questionType === filter;
    const matchSearch = q.questionText?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <Layout>
      <div className="space-y-5">
        <div className="card !p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2">
            {types.map((t) => (
              <button key={t} onClick={() => setFilter(t)} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${filter === t ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                {t === 'MULTIPLE_CHOICE' ? 'MC' : t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>+ Add</Button>
          </div>
        </div>

        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState title="No questions found" description="Add questions to your question bank." />
        ) : (
          <div className="card overflow-hidden !p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Question</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Points</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((q, idx) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 text-slate-800 max-w-xs">
                      <p className="truncate">{q.questionText}</p>
                    </td>
                    <td className="px-4 py-3"><Badge status={q.questionType} label={q.questionType?.replace('_', ' ')} /></td>
                    <td className="px-4 py-3 text-center text-slate-600 font-semibold">{q.points}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setPreview(q)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Question" maxWidth="max-w-2xl">
        <AddQuestionModal onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); load(); }} />
      </Modal>

      <Modal isOpen={!!preview} onClose={() => setPreview(null)} title="Question Preview">
        {preview && (
          <div className="space-y-3">
            <Badge status={preview.questionType} label={preview.questionType?.replace('_', ' ')} />
            <p className="text-slate-800">{preview.questionText}</p>
            <p className="text-xs text-slate-400">{preview.points} point{preview.points !== 1 ? 's' : ''}</p>
            {preview.options?.length > 0 && (
              <div className="space-y-1.5 mt-3">
                {preview.options.map((o) => (
                  <div key={o.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${o.isCorrect ? 'bg-green-50 text-green-700 font-medium' : 'bg-slate-50 text-slate-600'}`}>
                    {o.isCorrect && <span className="text-green-500">✓</span>}
                    {o.optionText}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
