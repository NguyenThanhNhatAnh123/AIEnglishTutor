import { useCallback, useEffect, useState } from 'react';
import { teacherApi } from '../services/api';
import Layout from '../components/Layout';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { useToast } from '../context/ToastContext';

const TEACHER_PAGE_SIZE = 25;

function fmtDate(value) {
  if (value == null || value === '') return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

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

function TeacherFormModal({ onClose, onSaved }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    teacherCode: '',
    department: '',
  });

  const setField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.username.trim() || !form.email.trim() || !form.password || form.password.length < 6) {
      toast.error('Username, email, and a password (min 6 characters) are required.');
      return;
    }
    if (!form.teacherCode.trim()) {
      toast.error('Teacher code is required.');
      return;
    }

    setLoading(true);
    try {
      await teacherApi.create({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        fullName: (form.fullName || form.username).trim(),
        teacherCode: form.teacherCode.trim(),
        department: form.department.trim() || null,
        status: 'ACTIVE',
      });
      toast.success('Teacher created.');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Create teacher failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Username *</label>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.username} onChange={setField('username')} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Password *</label>
          <input type="password" minLength={6} className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.password} onChange={setField('password')} required />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
        <input type="email" className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.email} onChange={setField('email')} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
        <input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.fullName} onChange={setField('fullName')} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Teacher code *</label>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm" value={form.teacherCode} onChange={setField('teacherCode')} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.department} onChange={setField('department')} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" loading={loading}>Create</Button>
      </div>
    </form>
  );
}

export default function Teachers() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(0);
  const [pageInfo, setPageInfo] = useState({ page: 0, totalPages: 0, totalItems: 0 });

  const load = useCallback(() => {
    setLoading(true);
    teacherApi.getAll({ page, size: TEACHER_PAGE_SIZE })
      .then((response) => {
        const next = readPagedData(response);
        setRows(next.items);
        setPageInfo({ page: next.page, totalPages: next.totalPages, totalItems: next.totalItems });
      })
      .catch(() => {
        setRows([]);
        setPageInfo({ page: 0, totalPages: 0, totalItems: 0 });
        toast.error('Failed to load teachers');
      })
      .finally(() => setLoading(false));
  }, [page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Teachers</h1>
            <p className="mt-0.5 text-sm text-slate-500">Admin-only teacher account management.</p>
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>New teacher</Button>
        </div>

        {loading ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <EmptyState title="No teachers yet" description="Create a teacher account before assigning classes or exams." />
        ) : (
          <div className="card overflow-hidden !p-0 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
              <span>
                Page {pageInfo.totalPages === 0 ? 0 : pageInfo.page + 1} of {pageInfo.totalPages}
                {pageInfo.totalItems ? ` - ${pageInfo.totalItems} total` : ''}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" type="button" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
                <Button variant="secondary" size="sm" type="button" disabled={pageInfo.totalPages === 0 || page >= pageInfo.totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{teacher.teacherCode}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{teacher.fullName || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{teacher.email || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{teacher.department || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(teacher.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New teacher">
        <TeacherFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            load();
          }}
        />
      </Modal>
    </Layout>
  );
}
