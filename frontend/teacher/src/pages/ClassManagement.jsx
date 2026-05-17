import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { classApi, teacherApi, studentApi } from '../services/api';
import Layout from '../components/Layout';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { useToast } from '../context/ToastContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── ClassForm (Create / Edit) ───────────────────────────────────────────────

function ClassForm({ initial, onClose, onSuccess }) {
  const isEdit = !!initial;
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    teacherId: initial?.teacherId ? String(initial.teacherId) : '',
  });
  const [loading, setLoading] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    teacherApi.getAll({ page: 0, size: 100 })
      .then((r) => {
        const data = r.data?.data;
        const list = Array.isArray(data) ? data : (data?.items || []);
        setTeachers(list);
        if (!form.teacherId && list.length > 0) {
          setForm((f) => ({ ...f, teacherId: String(list[0].id) }));
        }
      })
      .catch(() => setTeachers([]))
      .finally(() => setLoadingTeachers(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const teacherId = parseInt(form.teacherId);
    if (!teacherId) { setError('Please select a teacher'); return; }
    if (!form.name.trim()) { setError('Class name is required'); return; }

    setLoading(true);
    try {
      const payload = { name: form.name.trim(), description: form.description || null, teacherId };
      if (isEdit) {
        await classApi.update(initial.id, payload);
        toast.success('Class updated successfully!');
      } else {
        await classApi.create(payload);
        toast.success('Class created successfully!');
      }
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || (isEdit ? 'Failed to update class' : 'Failed to create class');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Class Name <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Intermediate English A"
          required
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Teacher <span className="text-red-500">*</span></label>
        {loadingTeachers ? (
          <div className="text-slate-400 text-sm py-2">Loading teachers...</div>
        ) : (
          <select
            value={form.teacherId}
            onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
            required
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select teacher...</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.fullName || t.teacherCode}</option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Optional description..."
          rows={3}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" loading={loading}>
          {isEdit ? 'Update Class' : 'Create Class'}
        </Button>
      </div>
    </form>
  );
}

// ─── ClassDetailModal (students list + add/remove) ───────────────────────────

function ClassDetailModal({ classItem, onClose, onStudentChange }) {
  const [detail, setDetail] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [addLoading, setAddLoading] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const toast = useToast();

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, studentsRes] = await Promise.all([
        classApi.getById(classItem.id),
        studentApi.getAll({ page: 0, size: 100 }),
      ]);
      const cls = detailRes.data?.data || detailRes.data;
      setDetail(cls);

      // Filter out already-enrolled students
      const enrolled = new Set((cls.students || []).map((s) => s.studentId));
      const studentsData = studentsRes.data?.data;
      const studentList = Array.isArray(studentsData) ? studentsData : (studentsData?.items || []);
      const available = studentList.filter((s) => !enrolled.has(s.id));
      setAllStudents(available);
      setSelectedStudentId(available[0]?.id ? String(available[0].id) : '');
    } catch {
      toast.error('Failed to load class details');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classItem.id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const handleAddStudent = async () => {
    const sid = parseInt(selectedStudentId);
    if (!sid) return;
    setAddLoading(true);
    try {
      await classApi.addStudent(classItem.id, sid);
      toast.success('Student added successfully!');
      await loadDetail();
      onStudentChange();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add student');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId) => {
    setRemovingId(studentId);
    try {
      await classApi.removeStudent(classItem.id, studentId);
      toast.success('Student removed from class');
      await loadDetail();
      onStudentChange();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove student');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Class: ${classItem.name}`} maxWidth="max-w-3xl">
      {loading ? (
        <PageLoader />
      ) : (
        <div className="space-y-5">
          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm text-slate-600 bg-slate-50 rounded-xl p-4">
            <span><span className="font-medium text-slate-700">Teacher:</span> {detail?.teacherName || '—'}</span>
            <span><span className="font-medium text-slate-700">Students:</span> {detail?.totalStudents ?? 0}</span>
            {detail?.description && (
              <span className="w-full"><span className="font-medium text-slate-700">Description:</span> {detail.description}</span>
            )}
          </div>

          {/* Add Student */}
          {allStudents.length > 0 && (
            <div className="flex gap-2">
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select student to add...</option>
                {allStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.studentCode} – {s.fullName || s.username}
                  </option>
                ))}
              </select>
              <Button variant="primary" size="sm" onClick={handleAddStudent} loading={addLoading} disabled={!selectedStudentId}>
                Add Student
              </Button>
            </div>
          )}
          {allStudents.length === 0 && !loading && (
            <p className="text-sm text-slate-400 italic">All available students are already enrolled.</p>
          )}

          {/* Students Table */}
          {(!detail?.students || detail.students.length === 0) ? (
            <EmptyState title="No students enrolled" description="Use the dropdown above to add students to this class." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Student Code</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Full Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Username</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Joined At</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {detail.students.map((s) => (
                    <tr key={s.studentId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-blue-600 font-medium">{s.studentCode}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{s.fullName || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">@{s.username}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{s.email}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{fmt(s.joinedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRemoveStudent(s.studentId)}
                          disabled={removingId === s.studentId}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-40"
                        >
                          {removingId === s.studentId ? 'Removing...' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ClassManagement() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    classApi.getAll()
      .then((r) => setClasses(r.data?.data || []))
      .catch(() => { setClasses([]); toast.error('Failed to load classes'); })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await classApi.delete(deleteTarget.id);
      toast.success('Class deleted successfully');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete class');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = classes.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Class Management</h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage classes and student enrollment.</p>
            <Link to="/students" className="text-sm text-blue-600 font-medium hover:underline mt-1 inline-block">
              Manage student accounts
            </Link>
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Class
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search classes by name..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState title="No classes found" description={search ? 'Try a different search term.' : 'Create your first class to get started.'} />
        ) : (
          <div className="card overflow-hidden !p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-12">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Class Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Teacher</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-28">Students</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">#{c.id}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{c.name}</td>
                    <td className="px-4 py-3 text-slate-500">{c.teacherName || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                        {c.totalStudents ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell max-w-xs truncate">
                      {c.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewDetail(c)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Students
                        </button>
                        <button
                          onClick={() => setEditTarget(c)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Class Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Class">
        <ClassForm
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); load(); }}
        />
      </Modal>

      {/* Edit Class Modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Class">
        {editTarget && (
          <ClassForm
            initial={editTarget}
            onClose={() => setEditTarget(null)}
            onSuccess={() => { setEditTarget(null); load(); }}
          />
        )}
      </Modal>

      {/* Class Detail / Students Modal */}
      {viewDetail && (
        <ClassDetailModal
          classItem={viewDetail}
          onClose={() => setViewDetail(null)}
          onStudentChange={load}
        />
      )}

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Class?">
        <div className="space-y-4">
          <p className="text-slate-600 text-sm">
            Are you sure you want to delete <strong className="text-slate-800">{deleteTarget?.name}</strong>?
            <br />
            <span className="text-orange-600 text-xs mt-1 inline-block">
              ⚠ All student enrollments in this class will also be removed.
            </span>
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleteLoading}>Delete</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
