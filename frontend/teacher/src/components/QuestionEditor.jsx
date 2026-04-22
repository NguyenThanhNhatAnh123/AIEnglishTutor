import { useState, useEffect } from 'react';
import { questionApi, examApi } from '../services/api';

export default function QuestionEditor({ onClose, onSuccess }) {
  const [sections, setSections] = useState([]);
  const [form, setForm] = useState({
    sectionId: '',
    questionText: '',
    questionType: 'MULTIPLE_CHOICE',
    points: 1,
    options: [
      { optionText: '', isCorrect: false },
      { optionText: '', isCorrect: false },
    ],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    examApi.getAll()
      .then((r) => {
        const list = r.data?.data || [];
        const first = list[0];
        if (first?.id) {
          examApi.getById(first.id)
            .then((res) => {
              const full = res.data?.data;
              const secs = full?.sections || [];
              setSections(secs);
              if (secs[0]) setForm((f) => ({ ...f, sectionId: secs[0].id }));
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await questionApi.create({
        ...form,
        sectionId: parseInt(form.sectionId),
        options: form.options.filter((o) => o.optionText.trim()),
      });
      onSuccess?.();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateOption = (i, field, val) => {
    setForm((f) => ({
      ...f,
      options: f.options.map((o, j) => (j === i ? { ...o, [field]: val } : o)),
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-slate-700 my-8">
        <h2 className="text-xl font-bold text-white mb-4">Add Question</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm mb-1">Section</label>
            <select
              value={form.sectionId}
              onChange={(e) => setForm((f) => ({ ...f, sectionId: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1">Question Text</label>
            <textarea
              value={form.questionText}
              onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
              rows={3}
              required
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1">Type</label>
            <select
              value={form.questionType}
              onChange={(e) => setForm((f) => ({ ...f, questionType: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
            >
              <option value="MULTIPLE_CHOICE">Multiple Choice</option>
              <option value="WRITING">Writing</option>
              <option value="SPEAKING">Speaking</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1">Points</label>
            <input
              type="number"
              value={form.points}
              onChange={(e) => setForm((f) => ({ ...f, points: parseInt(e.target.value) || 1 }))}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
            />
          </div>
          {form.questionType === 'MULTIPLE_CHOICE' && (
            <div>
              <label className="block text-slate-300 text-sm mb-2">Options</label>
              {form.options.map((o, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    value={o.optionText}
                    onChange={(e) => updateOption(i, 'optionText', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
                    placeholder={`Option ${i + 1}`}
                  />
                  <label className="flex items-center gap-1 text-slate-300 text-sm">
                    <input
                      type="checkbox"
                      checked={o.isCorrect}
                      onChange={(e) => updateOption(i, 'isCorrect', e.target.checked)}
                    />
                    Correct
                  </label>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-600 text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
