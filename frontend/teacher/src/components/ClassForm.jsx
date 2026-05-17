import { useState, useEffect } from 'react';
import { classApi, teacherApi } from '../services/api';

export default function ClassForm({ onClose, onSuccess }) {
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', teacherId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    teacherApi.getAll({ page: 0, size: 100 })
      .then((r) => {
        const data = r.data?.data;
        setTeachers(Array.isArray(data) ? data : (data?.items || []));
      })
      .catch(() => setTeachers([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const teacherId = parseInt(form.teacherId) || teachers[0]?.id;
      if (!teacherId) {
        setError('Please select a teacher');
        return;
      }
      await classApi.create({
        name: form.name,
        description: form.description || null,
        teacherId,
      });
      onSuccess?.();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create class');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-4">Create Class</h2>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm mb-1">Class Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
              placeholder="e.g. English 101"
              required
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1">Teacher</label>
            <select
              value={form.teacherId}
              onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
            >
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.fullName}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-600 text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
