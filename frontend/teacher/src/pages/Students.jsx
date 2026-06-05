import { useState, useEffect, useCallback } from 'react';
import { classApi, studentApi } from '../services/api';
import Layout from '../components/Layout';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import Badge from '../components/common/Badge';
import { PageLoader } from '../components/common/LoadingSpinner';
import { useToast } from '../context/ToastContext';

function fmtDate(value) {
  if (value == null || value === '') return '—';
  if (Array.isArray(value) && value.length >= 3) {
    const [y, mo = 1, d = 1] = value;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d));
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const STUDENT_PAGE_SIZE = 25;

function readPagedData(response) {
  const data = response.data?.data;
  if (Array.isArray(data)) {
    return { items: data, page: 0, totalPages: 1, totalItems: data.length };
  }
  return {
    items: data?.items || [],
    page: data?.page || 0,
    totalPages: data?.totalPages || 0,
    totalItems: data?.totalItems || 0,
  };
}

function StudentFormModal({ mode, student, onClose, onSaved }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    fullName: student?.fullName || '',
    studentCode: student?.studentCode || '',
    dateOfBirth: student?.dateOfBirth || '',
    status: student?.status || 'ACTIVE',
    classIds: [],
  });
  const [classOptions, setClassOptions] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(mode === 'create');

  useEffect(() => {
    if (mode === 'edit' && student) {
      setForm({
        username: '',
        email: student.email || '',
        password: '',
        fullName: student.fullName || '',
        studentCode: student.studentCode || '',
        dateOfBirth: student.dateOfBirth || '',
        status: student.status || 'ACTIVE',
        classIds: [],
      });
    }
  }, [mode, student]);

  useEffect(() => {
    if (mode !== 'create') {
      return;
    }
    setLoadingClasses(true);
    classApi.getAll()
      .then((response) => {
        const list = response.data?.data || [];
        setClassOptions(Array.isArray(list) ? list : []);
      })
      .catch(() => setClassOptions([]))
      .finally(() => setLoadingClasses(false));
  }, [mode]);

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'create') {
        if (!form.username.trim() || !form.email.trim() || !form.password || form.password.length < 6) {
          toast.error('Username, email, and a password (min 6 characters) are required.');
          setLoading(false);
          return;
        }
        if (!form.studentCode.trim()) {
          toast.error('Student code is required.');
          setLoading(false);
          return;
        }
        if (form.classIds.length === 0) {
          toast.error('Select at least one class for this student.');
          setLoading(false);
          return;
        }
        await studentApi.create({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          fullName: (form.fullName || form.username).trim(),
          studentCode: form.studentCode.trim(),
          dateOfBirth: form.dateOfBirth || null,
          status: form.status,
          classIds: form.classIds,
        });
        toast.success('Student created.');
      } else {
        await studentApi.update(student.id, {
          fullName: form.fullName?.trim() || undefined,
          email: form.email?.trim() || undefined,
          studentCode: form.studentCode?.trim() || undefined,
          dateOfBirth: form.dateOfBirth || null,
          status: form.status,
        });
        toast.success('Student updated.');
      }
      onSaved();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Request failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'create' && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username *</label>
            <input
              className="w-full px-3 py-2 rounded-xl border border-slate-200"
              value={form.username}
              onChange={setField('username')}
              required
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-xl border border-slate-200"
              value={form.password}
              onChange={setField('password')}
              minLength={6}
              required
            />
          </div>
        </>
      )}
      {mode === 'create' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Classes *</label>
          {loadingClasses ? (
            <div className="text-sm text-slate-400">Loading classes...</div>
          ) : classOptions.length === 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Create a class before adding students.
            </div>
          ) : (
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
              {classOptions.map((cls) => (
                <label key={cls.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.classIds.includes(cls.id)}
                    onChange={() => setForm((current) => ({
                      ...current,
                      classIds: current.classIds.includes(cls.id)
                        ? current.classIds.filter((id) => id !== cls.id)
                        : [...current.classIds, cls.id],
                    }))}
                    className="accent-blue-600"
                  />
                  <span>{cls.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
        <input
          type="email"
          className="w-full px-3 py-2 rounded-xl border border-slate-200"
          value={form.email}
          onChange={setField('email')}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
        <input
          className="w-full px-3 py-2 rounded-xl border border-slate-200"
          value={form.fullName}
          onChange={setField('fullName')}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Student code *</label>
        <input
          className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-sm"
          value={form.studentCode}
          onChange={setField('studentCode')}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Date of birth</label>
        <input type="date" className="w-full px-3 py-2 rounded-xl border border-slate-200" value={form.dateOfBirth || ''} onChange={setField('dateOfBirth')} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
        <select className="w-full px-3 py-2 rounded-xl border border-slate-200" value={form.status} onChange={setField('status')}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          {mode === 'create' ? 'Create' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

export default function Students() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageInfo, setPageInfo] = useState({ page: 0, totalPages: 0, totalItems: 0 });
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    studentApi.getAll({ page, size: STUDENT_PAGE_SIZE })
      .then((sRes) => {
        const next = readPagedData(sRes);
        setRows(next.items);
        setPageInfo({ page: next.page, totalPages: next.totalPages, totalItems: next.totalItems });
      })
      .catch(() => {
        setRows([]);
        setPageInfo({ page: 0, totalPages: 0, totalItems: 0 });
        toast.error('Failed to load students');
      })
      .finally(() => setLoading(false));
  }, [page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await studentApi.delete(deleteTarget.id);
      toast.success('Student deleted.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Students</h1>
            <p className="text-sm text-slate-500 mt-0.5">Create, edit, or remove student accounts (used for class enrollment).</p>
          </div>
          <Button variant="primary" onClick={() => setModal({ mode: 'create' })}>
            New student
          </Button>
        </div>

        {loading ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <EmptyState title="No students yet" description="Create a student account, then add them to a class." />
        ) : (
          <div className="card overflow-hidden !p-0 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
              <span>
                Page {pageInfo.totalPages === 0 ? 0 : pageInfo.page + 1} of {pageInfo.totalPages}
                {pageInfo.totalItems ? ` - ${pageInfo.totalItems} total` : ''}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" type="button" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  disabled={pageInfo.totalPages === 0 || page >= pageInfo.totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Username</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">DOB</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Created</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{s.studentCode}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{s.fullName || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">@{s.username || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{s.email}</td>
                    <td className="px-4 py-3"><Badge status={s.status || 'ACTIVE'} label={s.status || 'ACTIVE'} /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(s.dateOfBirth)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(s.createdAt)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setModal({ mode: 'edit', student: s })}
                        >
                          Edit
                        </Button>
                        <Button type="button" variant="danger" size="sm" onClick={() => setDeleteTarget(s)}>
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

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'New student' : 'Edit student'}>
        {modal && (
          <StudentFormModal
            key={`${modal.mode}-${modal.student?.id ?? 'new'}`}
            mode={modal.mode}
            student={modal.student}
            onClose={() => setModal(null)}
            onSaved={() => {
              setModal(null);
              load();
            }}
          />
        )}
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete student?">
        <p className="text-sm text-slate-600 mb-4">
          This removes the student record. Students with submissions cannot be deleted.
        </p>
        <p className="text-sm font-medium text-slate-800">{deleteTarget?.fullName} ({deleteTarget?.studentCode})</p>
        <div className="flex justify-end gap-2 mt-6">
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
