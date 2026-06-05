import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { classApi } from '../services/api';
import Layout from '../components/Layout';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ ClassForm (Create / Edit) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ClassForm({ initial, onClose, onSuccess, studentOptions = [], teacherOptions = [] }) {
  const isEdit = !!initial;
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [teachers, setTeachers] = useState(teacherOptions);
  const [students, setStudents] = useState(studentOptions);
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    teacherId: initial?.teacherId ? String(initial.teacherId) : (user?.teacherId ? String(user.teacherId) : ''),
    studentIds: [],
  });
  const [loading, setLoading] = useState(false);
  const [loadingTeachers] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    const list = isAdmin ? teacherOptions : teacherOptions.filter((t) => String(t.id) === String(user?.teacherId));
    setTeachers(list);
    if (!isAdmin) {
      if (user?.teacherId) {
        setForm((f) => ({ ...f, teacherId: String(user.teacherId) }));
      }
      return;
    }
    if (!form.teacherId && list.length > 0) {
      setForm((f) => ({ ...f, teacherId: String(list[0].id) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, teacherOptions, user?.teacherId]);

  useEffect(() => {
    setStudents(studentOptions.filter((student) => (student.status || 'ACTIVE').toUpperCase() === 'ACTIVE'));
  }, [studentOptions]);

  useEffect(() => {
    let alive = true;
    if (!isEdit) return () => { alive = false; };
    setLoadingStudents(true);
    classApi.getById(initial.id)
      .then((detailRes) => {
        if (!alive) return;
        const detail = detailRes?.data?.data || detailRes?.data || initial;
        setForm((f) => ({
          ...f,
          name: detail.name || '',
          description: detail.description || '',
          teacherId: detail.teacherId ? String(detail.teacherId) : f.teacherId,
          studentIds: (detail.students || [])
            .filter((student) => (student.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
            .map((student) => student.studentId),
        }));
      })
      .catch(() => {
        if (isEdit) setError('Failed to load class roster');
      })
      .finally(() => {
        if (alive) setLoadingStudents(false);
      });
    return () => { alive = false; };
  }, [isEdit, initial]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const teacherId = parseInt(form.teacherId, 10);
    if (!teacherId) { setError('Please select a teacher'); return; }
    if (!form.name.trim()) { setError('Class name is required'); return; }
    if (!isEdit && form.studentIds.length === 0) { setError('Select at least one student'); return; }

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        teacherId,
        studentIds: form.studentIds,
      };
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

      {isAdmin && (
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
      )}

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

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-slate-700">
            Students {!isEdit && <span className="text-red-500">*</span>}
          </label>
          <span className="text-xs font-medium text-slate-400">
            {form.studentIds.length} selected
          </span>
        </div>
        {loadingStudents ? (
          <div className="text-slate-400 text-sm py-2">Loading students...</div>
        ) : students.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Create at least one student account before assigning students to this class.
          </div>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setForm((current) => ({
                  ...current,
                  studentIds: students.map((student) => student.id),
                }))}
              >
                Select all
              </Button>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setForm((current) => ({ ...current, studentIds: [] }))}
              >
                Clear
              </Button>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              {students.map((student) => (
                <label key={student.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.studentIds.includes(student.id)}
                    onChange={() => setForm((current) => ({
                      ...current,
                      studentIds: current.studentIds.includes(student.id)
                        ? current.studentIds.filter((id) => id !== student.id)
                        : [...current.studentIds, student.id],
                    }))}
                    className="accent-blue-600"
                  />
                  <span>{student.studentCode} - {student.fullName || student.username}</span>
                </label>
              ))}
            </div>
          </>
        )}
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

// Main Page

export default function ClassManagement() {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    classApi.workspace()
      .then((r) => {
        const data = r.data?.data || {};
        setClasses(data.classes || []);
        setStudents(data.students || []);
        setTeachers(data.teachers || []);
      })
      .catch(() => {
        setClasses([]);
        setStudents([]);
        setTeachers([]);
        toast.error('Failed to load classes');
      })
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
                    <td className="px-4 py-3 text-slate-500">{c.teacherName || 'â€”'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                        {c.totalStudents ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell max-w-xs truncate">
                      {c.description || 'â€”'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditTarget(c)}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteTarget(c)}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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

      {/* Create Class Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Class" maxWidth="max-w-3xl">
        <ClassForm
          studentOptions={students}
          teacherOptions={teachers}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); load(); }}
        />
      </Modal>

      {/* Edit Class Modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Class" maxWidth="max-w-3xl">
        {editTarget && (
          <ClassForm
            initial={editTarget}
            studentOptions={students}
            teacherOptions={teachers}
            onClose={() => setEditTarget(null)}
            onSuccess={() => { setEditTarget(null); load(); }}
          />
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Class?">
        <div className="space-y-4">
          <p className="text-slate-600 text-sm">
            Are you sure you want to delete <strong className="text-slate-800">{deleteTarget?.name}</strong>?
            <br />
            <span className="text-orange-600 text-xs mt-1 inline-block">
              âš  All student enrollments in this class will also be removed.
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
