import { useState } from 'react';
import Button from '../components/common/Button';

/**
 * Reusable ExamForm component.
 *
 * Props:
 *   exam       {object|null}  — if provided, pre-fills form fields (edit mode)
 *   onSubmit   {Function}     — called with { title, description, durationMinutes, status }
 *   onCancel   {Function}     — called when Cancel is clicked
 *   loading    {boolean}      — shows spinner on submit button
 */
export default function ExamForm({ exam = null, onSubmit, onCancel, loading = false }) {
  const [form, setForm] = useState({
    title: exam?.title || '',
    description: exam?.description || '',
    durationMinutes: exam?.durationMinutes || 60,
    status: exam?.status || 'DRAFT',
  });

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.({
      ...form,
      durationMinutes: parseInt(form.durationMinutes, 10),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Title <span className="text-rose-400">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={set('title')}
          required
          placeholder="e.g. Mid-term English Test"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800
                     placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
        <textarea
          value={form.description}
          onChange={set('description')}
          rows={3}
          placeholder="Optional instructions or notes for students"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800
                     placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
        />
      </div>

      {/* Duration + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Duration (min) <span className="text-rose-400">*</span>
          </label>
          <input
            type="number"
            value={form.durationMinutes}
            onChange={set('durationMinutes')}
            min={1}
            max={480}
            required
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800
                       focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
          <select
            value={form.status}
            onChange={set('status')}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800
                       focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-1">
        {onCancel && (
          <Button variant="secondary" type="button" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="primary" type="submit" loading={loading}>
          {exam ? 'Update Exam' : 'Create Exam'}
        </Button>
      </div>
    </form>
  );
}