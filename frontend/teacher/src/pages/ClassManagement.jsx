import { useState, useEffect } from 'react';
import { classApi, studentApi } from '../services/api';
import Layout from '../components/Layout';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { useToast } from '../context/ToastContext';

function ClassForm({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '' });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await classApi.create(form);
      toast.success('Class created successfully!');
      onSuccess();
    } catch {
      toast.error('Failed to create class.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Class Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ name: e.target.value })}
          placeholder="e.g. Intermediate English A"
          required
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" loading={loading}>Create Class</Button>
      </div>
    </form>
  );
}

function StudentsModal({ classItem, onClose }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    classApi.getStudents(classItem.id)
      .then((r) => setStudents(r.data?.data || []))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [classItem.id]);

  return (
    <Modal isOpen onClose={onClose} title={`Students – ${classItem.name}`} maxWidth="max-w-xl">
      {loading ? (
        <PageLoader />
      ) : students.length === 0 ? (
        <EmptyState title="No students enrolled" description="No students are enrolled in this class yet." />
      ) : (
        <div className="overflow-y-auto max-h-80">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Name</th>
                <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5 text-slate-800 font-medium">{s.username || s.name}</td>
                  <td className="py-2.5 text-slate-400">{s.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

export default function ClassManagement() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewStudents, setViewStudents] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const toast = useToast();

  const load = () => {
    setLoading(true);
    classApi.getAll()
      .then((r) => setClasses(r.data?.data || []))
      .catch(() => setClasses([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async () => {
    try {
      await classApi.delete(deleteTarget.id);
      toast.success('Class deleted.');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('Failed to delete class.');
    }
  };

  const filtered = classes.filter((c) => c.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search classes..." className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New Class
          </Button>
        </div>

        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState title="No classes found" description="Create your first class to get started." />
        ) : (
          <div className="card overflow-hidden !p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Class Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Teacher</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                    <td className="px-4 py-3 text-slate-400">{c.teacherName || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setViewStudents(c)}>Students</Button>
                        <Button variant="danger" size="sm" onClick={() => setDeleteTarget(c)}>Del</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Class">
        <ClassForm onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); load(); }} />
      </Modal>

      {/* Students modal */}
      {viewStudents && <StudentsModal classItem={viewStudents} onClose={() => setViewStudents(null)} />}

      {/* Delete confirm modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Class?">
        <p className="text-slate-600 text-sm">Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.</p>
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </Layout>
  );
}
