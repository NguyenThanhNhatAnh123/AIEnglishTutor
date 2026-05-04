import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { examApi } from '../services/api';
import Layout from '../components/Layout';
import ExamSectionsModal from '../components/ExamSectionsModal';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { useToast } from '../context/ToastContext';

function formatExamCreated(value) {
  if (value == null || value === '') return '—';
  if (Array.isArray(value) && value.length >= 3) {
    const [y, mo = 1, d = 1, h = 0, mi = 0, s = 0] = value;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
  return '—';
}

function ExamFormModal({ exam, onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: exam?.title || '',
    description: exam?.description || '',
    durationMinutes: exam?.durationMinutes || 60,
    status: exam?.status || 'DRAFT',
    examType: exam?.examType || 'PRACTICE',
  });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        durationMinutes: parseInt(form.durationMinutes, 10),
        examType: form.examType || 'PRACTICE',
      };
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
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Exam type</label>
        <select
          value={form.examType}
          onChange={set('examType')}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
        >
          <option value="PRACTICE">Practice (multiple attempts)</option>
          <option value="OFFICIAL">Official (one completed attempt)</option>
        </select>
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
  const [sectionsExam, setSectionsExam] = useState(null);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    examApi
      .getAll()
      .then((r) => setExams(r.data?.data || []))
      .catch((err) => {
        setExams([]);
        const msg = err?.response?.data?.message || 'Failed to load exams.';
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

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

  const q = search.toLowerCase().trim();
  const filtered = exams.filter((e) => {
    if (!q) return true;
    const title = e.title?.toLowerCase() || '';
    const desc = e.description?.toLowerCase() || '';
    const owner = e.teacherName?.toLowerCase() || '';
    return title.includes(q) || desc.includes(q) || owner.includes(q);
  });

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
          <EmptyState
            title="No exams found"
            description={search.trim() ? 'Try another search.' : 'Create your first exam.'}
          />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">
              {filtered.length} exam{filtered.length !== 1 ? 's' : ''}
              {search.trim() ? ` matching “${search.trim()}”` : ''}
            </p>
            <div className="card overflow-hidden !p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase min-w-[200px]">
                    Exam
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Duration</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Sections</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">
                    Created
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((e) => {
                  const canManage = e.canManage !== false;
                  return (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 align-top max-w-xs lg:max-w-md">
                      <p className="font-medium text-slate-800">{e.title}</p>
                      {e.description ? (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{e.description}</p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1 italic">No description</p>
                      )}
                      {!canManage && e.teacherName && (
                        <p className="text-xs text-amber-700 mt-1.5">
                          Owner: {e.teacherName} (view only)
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge status={e.status} label={e.status} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                        e.examType === 'OFFICIAL' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                      }`}>
                        {e.examType === 'OFFICIAL' ? 'Official' : 'Practice'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 align-top whitespace-nowrap">
                      {e.durationMinutes} min
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 align-top tabular-nums">
                      {e.sectionCount != null ? e.sectionCount : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs align-top whitespace-nowrap hidden md:table-cell">
                      {formatExamCreated(e.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {canManage && e.status === 'DRAFT' && (
                          <Button variant="ghost" size="sm" onClick={() => handlePublish(e)}>
                            Publish
                          </Button>
                        )}
                        {canManage && (
                          <Button variant="ghost" size="sm" onClick={() => setSectionsExam(e)}>
                            Sections
                          </Button>
                        )}
                        {canManage && (
                          <Link
                            to={`/questions?examId=${e.id}`}
                            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            Questions
                          </Link>
                        )}
                        {canManage && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => { setEditExam(e); setShowForm(true); }}
                          >
                            Edit
                          </Button>
                        )}
                        {canManage && (
                          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(e)}>
                            Delete
                          </Button>
                        )}
                        {!canManage && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
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
        isOpen={!!sectionsExam}
        onClose={() => setSectionsExam(null)}
        title="Exam sections"
        maxWidth="max-w-3xl"
      >
        {sectionsExam && (
          <ExamSectionsModal
            examId={sectionsExam.id}
            examTitle={sectionsExam.title}
            onChanged={load}
          />
        )}
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