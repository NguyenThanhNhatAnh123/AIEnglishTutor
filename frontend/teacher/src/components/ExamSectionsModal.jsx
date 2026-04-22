import { useState, useEffect, useCallback } from 'react';
import { examSectionApi } from '../services/api';
import { SECTION_TYPES } from '../../../packages/utils/constants.js';

const SECTION_OPTIONS = Object.values(SECTION_TYPES);
import Button from './common/Button';
import { useToast } from '../context/ToastContext';
import { PageLoader } from './common/LoadingSpinner';

/**
 * Manage exam sections (name, order, add/delete) — mirrors how students see the paper by section.
 */
export default function ExamSectionsModal({ examId, examTitle, onChanged }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newSectionType, setNewSectionType] = useState(SECTION_TYPES.READING);
  const [newOrder, setNewOrder] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSectionType, setEditSectionType] = useState(SECTION_TYPES.READING);
  const [editOrder, setEditOrder] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const toast = useToast();

  const refresh = useCallback(() => {
    setLoading(true);
    examSectionApi
      .list(examId)
      .then((r) => setSections(r.data?.data || []))
      .catch((err) => {
        setSections([]);
        const msg = err?.response?.data?.message || 'Failed to load sections.';
        toast.error(msg);
      })
      .finally(() => setLoading(false));
    // toast is stable from context; avoid re-fetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      toast.error('Enter a section name.');
      return;
    }
    setCreating(true);
    try {
      const payload = { name, sectionType: newSectionType };
      const o = newOrder.trim();
      if (o !== '') payload.orderIndex = parseInt(o, 10);
      await examSectionApi.create(examId, payload);
      toast.success('Section added.');
      setNewName('');
      setNewSectionType(SECTION_TYPES.READING);
      setNewOrder('');
      refresh();
      onChanged?.();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to create section.';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditName(s.name || '');
    setEditSectionType(s.sectionType || SECTION_TYPES.READING);
    setEditOrder(s.orderIndex != null ? String(s.orderIndex) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditSectionType(SECTION_TYPES.READING);
    setEditOrder('');
  };

  const saveEdit = async (sectionId) => {
    setSavingId(sectionId);
    try {
      const payload = {};
      const name = editName.trim();
      if (name) payload.name = name;
      if (editSectionType) payload.sectionType = editSectionType;
      const o = editOrder.trim();
      if (o !== '') payload.orderIndex = parseInt(o, 10);
      if (Object.keys(payload).length === 0) {
        toast.error('Change the name, type, or order before saving.');
        setSavingId(null);
        return;
      }
      await examSectionApi.update(examId, sectionId, payload);
      toast.success('Section updated.');
      cancelEdit();
      refresh();
      onChanged?.();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to update section.';
      toast.error(msg);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (sectionId) => {
    if (!window.confirm('Delete this section? It must have no questions.')) return;
    setDeletingId(sectionId);
    try {
      await examSectionApi.delete(examId, sectionId);
      toast.success('Section deleted.');
      refresh();
      onChanged?.();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to delete section.';
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        Sections for <span className="font-semibold text-slate-800">{examTitle}</span>. Students see the same
        section titles and order when taking the exam.
      </p>

      {loading ? (
        <PageLoader />
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase">Order</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase">Type</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase">Name</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase">Questions</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sections.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80">
                  {editingId === s.id ? (
                    <>
                      <td className="px-3 py-2 align-middle">
                        <input
                          type="number"
                          value={editOrder}
                          onChange={(e) => setEditOrder(e.target.value)}
                          className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
                          placeholder="Order"
                        />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <select
                          value={editSectionType}
                          onChange={(e) => setEditSectionType(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
                        >
                          {SECTION_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-slate-500">{s.questionCount ?? 0}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          type="button"
                          onClick={cancelEdit}
                          disabled={!!savingId}
                        >
                          Cancel
                        </Button>
                        <span className="inline-block w-1" />
                        <Button
                          variant="primary"
                          size="sm"
                          type="button"
                          loading={savingId === s.id}
                          onClick={() => saveEdit(s.id)}
                        >
                          Save
                        </Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2.5 text-slate-600 tabular-nums">{s.orderIndex ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600 text-xs font-semibold">{s.sectionType || '—'}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{s.name}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{s.questionCount ?? 0}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" type="button" onClick={() => startEdit(s)}>
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          type="button"
                          loading={deletingId === s.id}
                          onClick={() => handleDelete(s.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleCreate} className="rounded-xl border border-dashed border-slate-200 p-4 space-y-3 bg-slate-50/50">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">New section</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Section skill</label>
            <select
              value={newSectionType}
              onChange={(e) => setNewSectionType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              {SECTION_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Part 1 — Reading"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Order (optional)</label>
            <input
              type="number"
              value={newOrder}
              onChange={(e) => setNewOrder(e.target.value)}
              placeholder="Auto"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" type="submit" loading={creating}>
            Add section
          </Button>
        </div>
      </form>
    </div>
  );
}
