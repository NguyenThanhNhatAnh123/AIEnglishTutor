import { useState, useEffect } from 'react';
import { examApi } from '../services/api';
import Layout from '../components/Layout';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { useToast } from '../context/ToastContext';

function ExamFormModal({ exam, onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: exam?.title || '',
    description: exam?.description || '',
    durationMinutes: exam?.durationMinutes || 60,
    status: exam?.status || 'DRAFT',
  });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, durationMinutes: parseInt(form.durationMinutes, 10) };
      if (exam) {
        await examApi.update(exam.id, payload);
        toast.success('Exam updated.');
      } else {
        await examApi.create(payload);
        toast.success('Exam created.');
      }
      onSuccess();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to save exam.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
        <input
          type="text"
          value={form.title}
          onChange={set('title')}
          required
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
        <textarea
          value={form.description}
          onChange={set('description')}
          rows={3}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration (min)</label>
          <input
            type="number"
            value={form.durationMinutes}
            onChange={set('durationMinutes')}
            min={1}
            required
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
          <select
            value={form.status}
            onChange={set('status')}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" loading={loading}>
          {exam ? 'Update' : 'Create'} Exam
        </Button>
      </div>
    </form>
  );
}

export default function ExamManagement() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editExam, setEditExam] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [search, setSearch] = useState('');
  const toast = useToast();

  const load = () => {
    setLoading(true);
    examApi
      .getAll()
      .then((r) => setExams(r.data?.data || []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await examApi.delete(deleteTarget.id);
      toast.success('Exam deleted.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to delete exam.';
      toast.error(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  // FIX: use PATCH with only { status } — avoid sending non-ExamRequest fields
  const handlePublish = async (exam) => {
    try {
      await examApi.patch(exam.id, { status: 'ACTIVE' });
      toast.success('Exam published!');
      load();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to publish exam.';
      toast.error(msg);
    }
  };

  const filtered = exams.filter((e) =>
    e.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-3">
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
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <Button
            variant="primary"
            onClick={() => { setEditExam(null); setShowForm(true); }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Exam
          </Button>
        </div>

        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState title="No exams found" description="Create your first exam." />
        ) : (
          <div className="card overflow-hidden !p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Duration</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{e.title}</td>
                    <td className="px-4 py-3">
                      <Badge status={e.status} label={e.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-400">{e.durationMinutes} min</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {e.status === 'DRAFT' && (
                          <Button variant="ghost" size="sm" onClick={() => handlePublish(e)}>
                            Publish
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => { setEditExam(e); setShowForm(true); }}
                        >
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => setDeleteTarget(e)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editExam ? 'Edit Exam' : 'Create Exam'}
      >
        <ExamFormModal
          exam={editExam}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); load(); }}
        />
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Exam?"
      >
        <p className="text-slate-600 text-sm">
          Are you sure you want to delete <strong>{deleteTarget?.title}</strong>?
          This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleteLoading} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}