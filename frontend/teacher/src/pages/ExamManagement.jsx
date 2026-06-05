import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { examApi } from '../services/api';
import Layout from '../components/Layout';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SECTION_TYPES } from '../../../packages/utils/constants.js';

const SECTION_OPTIONS = Object.values(SECTION_TYPES);

function sectionToForm(section, index = 0) {
  return {
    clientId: section?.id ? `section-${section.id}` : `new-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    id: section?.id,
    name: section?.name || '',
    sectionType: section?.sectionType || SECTION_TYPES.READING,
    orderIndex: section?.orderIndex ?? index,
    questionCount: section?.questions?.length ?? section?.questionCount ?? 0,
  };
}

function formatExamCreated(value) {
  if (value == null || value === '') return '-';
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
  return '-';
}

function ExamFormModal({ exam, classOptions, teacherOptions, onClose, onSuccess }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [form, setForm] = useState({
    title: exam?.title || '',
    description: exam?.description || '',
    teacherId: exam?.teacherId ? String(exam.teacherId) : (user?.teacherId ? String(user.teacherId) : ''),
    durationMinutes: exam?.durationMinutes || 60,
    status: exam?.status || 'DRAFT',
    examType: exam?.examType || 'PRACTICE',
    maxAttempts: exam?.maxAttempts ?? (exam?.examType === 'OFFICIAL' ? 1 : ''),
    allowedClassIds: Array.isArray(exam?.allowedClasses) ? exam.allowedClasses.map((c) => c.id) : [],
    sections: Array.isArray(exam?.sections) ? exam.sections.map(sectionToForm) : [],
  });
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const toast = useToast();

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const toggleAllowedClass = (classId) => {
    setForm((prev) => {
      const exists = prev.allowedClassIds.includes(classId);
      return {
        ...prev,
        allowedClassIds: exists
          ? prev.allowedClassIds.filter((id) => id !== classId)
          : [...prev.allowedClassIds, classId],
      };
    });
  };

  useEffect(() => {
    if (!exam?.id) return;
    let alive = true;
    setDetailLoading(true);
    examApi
      .getById(exam.id)
      .then((r) => {
        if (!alive) return;
        const detail = r.data?.data || exam;
        setForm({
          title: detail.title || '',
          description: detail.description || '',
          teacherId: detail.teacherId ? String(detail.teacherId) : (user?.teacherId ? String(user.teacherId) : ''),
          durationMinutes: detail.durationMinutes || 60,
          status: detail.status || 'DRAFT',
          examType: detail.examType || 'PRACTICE',
          maxAttempts: detail.maxAttempts ?? (detail.examType === 'OFFICIAL' ? 1 : ''),
          allowedClassIds: Array.isArray(detail.allowedClasses) ? detail.allowedClasses.map((c) => c.id) : [],
          sections: Array.isArray(detail.sections) ? detail.sections.map(sectionToForm) : [],
        });
      })
      .catch(() => toast.error('Failed to load exam details.'))
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => { alive = false; };
  }, [exam, toast, user?.teacherId]);

  const addSection = () => {
    setForm((f) => ({
      ...f,
      sections: [...f.sections, sectionToForm({ orderIndex: f.sections.length }, f.sections.length)],
    }));
  };

  const updateSection = (clientId, patch) => {
    setForm((f) => ({
      ...f,
      sections: f.sections.map((section) => (
        section.clientId === clientId ? { ...section, ...patch } : section
      )),
    }));
  };

  const removeSection = (clientId) => {
    setForm((f) => ({
      ...f,
      sections: f.sections.filter((section) => section.clientId !== clientId),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const parsedDuration = parseInt(form.durationMinutes, 10);
      const parsedMaxAttempts = form.maxAttempts === '' ? null : parseInt(form.maxAttempts, 10);
      if (!Number.isFinite(parsedDuration) || parsedDuration < 1) {
        toast.error('Duration must be at least 1 minute.');
        setLoading(false);
        return;
      }
      if (parsedMaxAttempts != null && (!Number.isFinite(parsedMaxAttempts) || parsedMaxAttempts < 1)) {
        toast.error('Max attempts must be at least 1.');
        setLoading(false);
        return;
      }
      if (form.status === 'ACTIVE' && form.allowedClassIds.length === 0) {
        toast.error('Select at least one allowed class before publishing.');
        setLoading(false);
        return;
      }
      const teacherId = parseInt(form.teacherId, 10);
      if (!teacherId) {
        toast.error('Please select a teacher.');
        setLoading(false);
        return;
      }
      const payload = {
        ...form,
        teacherId,
        durationMinutes: parsedDuration,
        examType: form.examType || 'PRACTICE',
        maxAttempts: parsedMaxAttempts,
        allowedClassIds: form.allowedClassIds,
        sections: form.sections.map((section, index) => ({
          id: section.id,
          name: section.name.trim(),
          sectionType: section.sectionType,
          orderIndex: Number.isFinite(Number(section.orderIndex)) ? Number(section.orderIndex) : index,
        })),
      };
      if (payload.sections.some((section) => !section.name)) {
        toast.error('Every section needs a name.');
        setLoading(false);
        return;
      }
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

  const selectedTeacherId = parseInt(form.teacherId, 10);
  const visibleClassOptions = Number.isFinite(selectedTeacherId)
    ? classOptions.filter((cls) => cls.teacherId === selectedTeacherId)
    : classOptions;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {detailLoading && <PageLoader />}
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
      {isAdmin && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Teacher</label>
          <select
            value={form.teacherId}
            onChange={(e) => setForm((prev) => ({ ...prev, teacherId: e.target.value, allowedClassIds: [] }))}
            required
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            <option value="">Select teacher...</option>
            {teacherOptions.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName || teacher.teacherCode}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Exam type</label>
        <select
          value={form.examType}
          onChange={(e) => {
            const nextType = e.target.value;
            setForm((prev) => ({
              ...prev,
              examType: nextType,
              maxAttempts: nextType === 'OFFICIAL' && prev.maxAttempts === '' ? 1 : prev.maxAttempts,
            }));
          }}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
        >
          <option value="PRACTICE">Practice (multiple attempts)</option>
          <option value="OFFICIAL">Official (one completed attempt)</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Max attempts</label>
        <input
          type="number"
          min={1}
          value={form.maxAttempts}
          onChange={set('maxAttempts')}
          placeholder={form.examType === 'OFFICIAL' ? '1' : 'Unlimited'}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
        />
        <p className="text-xs text-slate-500 mt-1">
          Leave empty for unlimited attempts (recommended for practice exams).
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Allowed classes</label>
        {visibleClassOptions.length === 0 ? (
          <p className="text-xs text-red-600">No classes available. Create a class before publishing this exam.</p>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 max-h-48 overflow-y-auto space-y-2">
            {visibleClassOptions.map((cls) => (
              <label key={cls.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.allowedClassIds.includes(cls.id)}
                  onChange={() => toggleAllowedClass(cls.id)}
                  className="accent-sky-600"
                />
                <span>{cls.name}</span>
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500 mt-1">
          Active exams are visible only to students in the selected classes.
        </p>
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
      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Sections</p>
            <p className="text-xs text-slate-500">Saved together with the exam.</p>
          </div>
          <Button variant="secondary" type="button" size="sm" onClick={addSection}>
            Add section
          </Button>
        </div>
        {form.sections.length === 0 ? (
          <p className="text-sm text-slate-400">No sections yet.</p>
        ) : (
          <div className="space-y-2">
            {form.sections.map((section, index) => (
              <div key={section.clientId} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[80px_150px_1fr_auto]">
                <input
                  type="number"
                  value={section.orderIndex}
                  onChange={(e) => updateSection(section.clientId, { orderIndex: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  aria-label={`Order for section ${index + 1}`}
                />
                <select
                  value={section.sectionType}
                  onChange={(e) => updateSection(section.clientId, { sectionType: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  {SECTION_OPTIONS.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={section.name}
                  onChange={(e) => updateSection(section.clientId, { name: e.target.value })}
                  placeholder="Section name"
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                />
                <Button
                  variant="danger"
                  type="button"
                  size="sm"
                  onClick={() => removeSection(section.clientId)}
                  disabled={section.questionCount > 0}
                  title={section.questionCount > 0 ? 'Move or delete questions first' : 'Remove section'}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
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
      .workspace()
      .then((r) => {
        const data = r.data?.data || {};
        setExams(data.exams || []);
        setClasses(data.classes || []);
        setTeachers(data.teachers || []);
      })
      .catch((err) => {
        setExams([]);
        setClasses([]);
        setTeachers([]);
        const msg = err?.response?.data?.message || 'Failed to load exams.';
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [isAdmin]);

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

  // Use PATCH with only status to avoid sending display-only fields.
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
  const activeCount = exams.filter((e) => e.status === 'ACTIVE').length;
  const draftCount = exams.filter((e) => e.status === 'DRAFT').length;
  const readyCount = exams.filter((e) => (e.sectionCount ?? 0) > 0 && (e.questionCount ?? 0) > 0).length;

  const isReady = (exam) =>
    (exam.sectionCount ?? 0) > 0
    && (exam.questionCount ?? 0) > 0
    && Array.isArray(exam.allowedClasses)
    && exam.allowedClasses.length > 0;

  return (
    <Layout>
      <div className="space-y-5">
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-500">Exam management</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Teacher exam workspace</h1>
              <p className="mt-1 text-sm text-slate-500">
                Build papers, limit attempts, check readiness, then publish to students.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
              {[
                ['My exams', exams.length],
                ['Active', activeCount],
                ['Draft', draftCount],
                ['Ready', readyCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
                  <p className="text-xl font-bold text-blue-700">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

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
              {search.trim() ? ` matching "${search.trim()}"` : ''}
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Attempts</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Allowed classes</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Duration</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Content</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">
                    Created
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((e) => {
                  const ready = isReady(e);
                  return (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 align-top max-w-xs lg:max-w-md">
                      <p className="font-medium text-slate-800">{e.title}</p>
                      {e.description ? (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{e.description}</p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1 italic">No description</p>
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
                      {e.maxAttempts == null ? 'Unlimited' : e.maxAttempts}
                    </td>
                    <td className="px-4 py-3 text-slate-600 align-top max-w-[220px]">
                      {Array.isArray(e.allowedClasses) && e.allowedClasses.length > 0 ? (
                        <p className="text-xs line-clamp-2">
                          {e.allowedClasses.map((c) => c.name).join(', ')}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-400">All classes</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 align-top whitespace-nowrap">
                      {e.durationMinutes} min
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 align-top tabular-nums">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span className="font-semibold text-slate-700">
                          {e.sectionCount ?? 0} sec / {e.questionCount ?? 0} q
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          ready ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {ready ? 'Ready' : 'Needs content'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs align-top whitespace-nowrap hidden md:table-cell">
                      {formatExamCreated(e.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {e.status === 'DRAFT' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePublish(e)}
                            disabled={!ready}
                            title={ready ? 'Publish this exam' : 'Add sections, questions, and at least one class before publishing'}
                          >
                            Publish
                          </Button>
                        )}
                        <Button
                          as={Link}
                          to={`/questions?examId=${e.id}`}
                          variant="secondary"
                          size="sm"
                        >
                            Questions
                        </Button>
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
        maxWidth="max-w-3xl"
      >
        <ExamFormModal
          exam={editExam}
          classOptions={classes}
          teacherOptions={teachers}
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
