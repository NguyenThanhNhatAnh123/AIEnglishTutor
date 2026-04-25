import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { questionApi, examApi, examSectionApi, mediaApi, aiApi } from '../services/api';
import Layout from '../components/Layout';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import { SECTION_TYPES, QUESTION_TYPES, API_ORIGIN } from '../../../packages/utils/constants.js';

const MC_DEFAULTS = () => [
  { optionText: '', isCorrect: false },
  { optionText: '', isCorrect: false },
];

function questionTypeForSection(sectionType) {
  switch (sectionType) {
    case SECTION_TYPES.READING:
      return QUESTION_TYPES.MULTIPLE_CHOICE;
    case SECTION_TYPES.LISTENING:
      return QUESTION_TYPES.LISTENING;
    case SECTION_TYPES.WRITING:
      return QUESTION_TYPES.WRITING;
    case SECTION_TYPES.SPEAKING:
      return QUESTION_TYPES.SPEAKING;
    default:
      return QUESTION_TYPES.MULTIPLE_CHOICE;
  }
}

function emptyForm() {
  return {
    sectionId: '',
    questionText: '',
    questionType: QUESTION_TYPES.MULTIPLE_CHOICE,
    points: 1,
    listeningAudioUrl: '',
    transcript: '',
    minWords: 50,
    maxWords: 250,
    options: MC_DEFAULTS(),
  };
}

function parseCorrectToken(token, optionCount) {
  if (!token) return null;
  const t = String(token).trim();
  if (!t) return null;
  // Accept: A/B/C/D, 1/2/3/4, 0-based index
  const upper = t.toUpperCase();
  if (/^[A-Z]$/.test(upper)) {
    const idx = upper.charCodeAt(0) - 'A'.charCodeAt(0);
    return idx >= 0 && idx < optionCount ? idx : null;
  }
  const n = Number.parseInt(t, 10);
  if (Number.isFinite(n)) {
    // Heuristic: if user writes 1..N treat as 1-based, else allow 0-based
    if (n >= 1 && n <= optionCount) return n - 1;
    if (n >= 0 && n < optionCount) return n;
  }
  return null;
}

function parseOptionsPart(raw) {
  if (!raw) return [];
  // Allow either ";" or "," separators
  return String(raw)
    .split(/[;,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Bulk format (one question per line).
 * Supported:
 * - "Question text"
 * - "Question text | A;B;C;D | B"
 * - "Question text | A;*B;C;D"  (prefix * marks correct)
 */
function parseBulkQuestions(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((p) => p.trim()).filter((p) => p !== '');
      const questionText = parts[0] || '';
      const rawOptions = parts[1];
      const rawCorrect = parts[2];

      if (!rawOptions) {
        return { questionText };
      }

      const optionStrings = parseOptionsPart(rawOptions);
      const starredIdx = optionStrings.findIndex((s) => s.startsWith('*'));
      const cleaned = optionStrings.map((s) => (s.startsWith('*') ? s.slice(1).trim() : s));
      const correctIdxFromToken = parseCorrectToken(rawCorrect, cleaned.length);
      const correctIdx =
        correctIdxFromToken != null
          ? correctIdxFromToken
          : starredIdx !== -1
            ? starredIdx
            : 0;

      const options = cleaned.map((opt, idx) => ({
        optionText: opt,
        isCorrect: idx === correctIdx,
      }));

      return { questionText, options };
    })
    .filter((q) => q.questionText);
}

function createBulkItem() {
  return {
    questionText: '',
    options: MC_DEFAULTS(),
  };
}

function safeJsonParse(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function normalizeMcqOptions(options) {
  const nonBlank = (options || [])
    .map((o) => ({ optionText: String(o?.optionText ?? '').trim(), isCorrect: !!o?.isCorrect }))
    .filter((o) => o.optionText);
  const correctCount = nonBlank.filter((o) => o.isCorrect).length;
  if (nonBlank.length >= 2 && correctCount === 1) return { ok: true, options: nonBlank };
  // If user has exactly one correct among all options (including blanks), try to preserve it after trimming
  if (nonBlank.length >= 2 && correctCount === 0) {
    // default first as correct to avoid backend rejection only if caller wants auto-fix
    return { ok: false, options: nonBlank, reason: 'Pick exactly one correct option.' };
  }
  if (nonBlank.length < 2) {
    return { ok: false, options: nonBlank, reason: 'Provide at least 2 non-empty options.' };
  }
  return { ok: false, options: nonBlank, reason: 'Mark exactly 1 correct option.' };
}

function QuestionFormFields({
  form,
  setForm,
  sections,
  onRefreshSections,
  audioUploading,
  setAudioUploading,
  toast,
  requireQuestionText = true,
}) {
  const selectedSection = useMemo(
    () => sections.find((s) => String(s.id) === String(form.sectionId)),
    [sections, form.sectionId],
  );

  const setCorrectOnly = (idx) => {
    setForm((f) => ({
      ...f,
      options: f.options.map((o, j) => ({ ...o, isCorrect: j === idx })),
    }));
  };

  const updateOption = (i, field, val) =>
    setForm((f) => ({
      ...f,
      options: f.options.map((o, j) => (j === i ? { ...o, [field]: val } : o)),
    }));

  const addOption = () => setForm((f) => ({ ...f, options: [...f.options, { optionText: '', isCorrect: false }] }));

  const handleAudioFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAudioUploading(true);
    try {
      const res = await mediaApi.uploadAudio(file);
      const url = res.data?.data?.url;
      if (!url) throw new Error('No URL returned');
      setForm((f) => ({ ...f, listeningAudioUrl: url }));
      toast.success('Audio uploaded.');
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Upload failed.';
      toast.error(msg);
    } finally {
      setAudioUploading(false);
    }
  };

  const handleImageOcrTts = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAudioUploading(true);
    try {
      const res = await aiApi.imageOcrTts(file);
      const data = res.data?.data || {};
      const parsedChoices = (data.choices || []).map((choice, idx) => ({
        optionText: choice || '',
        isCorrect: idx === 0,
      }));
      setForm((f) => ({
        ...f,
        listeningAudioUrl: data.audioUrl || f.listeningAudioUrl,
        transcript: data.extractedText || f.transcript,
        questionText: data.questionText || data.extractedText || f.questionText,
        options: parsedChoices.length >= 2 ? parsedChoices : f.options,
      }));
      toast.success('Image OCR + TTS completed.');
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Image OCR + TTS failed.';
      toast.error(msg);
    } finally {
      setAudioUploading(false);
    }
  };

  const audioPreview =
    form.listeningAudioUrl && !form.listeningAudioUrl.startsWith('http')
      ? `${API_ORIGIN}${form.listeningAudioUrl.startsWith('/') ? '' : '/'}${form.listeningAudioUrl}`
      : form.listeningAudioUrl;

  const generateTtsFromText = async () => {
    const text = form.questionText?.trim();
    if (!text) {
      toast.error('Enter question text first.');
      return;
    }
    setAudioUploading(true);
    try {
      const res = await aiApi.tts(text);
      const audioUrl = res.data?.data?.audioUrl;
      if (!audioUrl) throw new Error('No audio URL returned.');
      setForm((f) => ({ ...f, listeningAudioUrl: audioUrl }));
      toast.success('TTS audio generated.');
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'TTS generation failed.';
      toast.error(msg);
    } finally {
      setAudioUploading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 justify-end">
        <Button type="button" variant="secondary" size="sm" onClick={onRefreshSections}>
          Reload sections
        </Button>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Section</label>
        <select
          value={form.sectionId}
          onChange={(e) => {
            const sid = e.target.value;
            const sec = sections.find((s) => String(s.id) === String(sid));
            setForm((f) => ({
              ...f,
              sectionId: sid,
              questionType: sec ? questionTypeForSection(sec.sectionType) : f.questionType,
            }));
          }}
          required
          disabled={!sections.length}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        >
          {sections.length === 0 ? (
            <option value="">Add sections in Exam management first</option>
          ) : (
            sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sectionType ? `[${s.sectionType}] ` : ''}
                {s.name}
              </option>
            ))
          )}
        </select>
        {selectedSection && (
          <p className="text-xs text-slate-500 mt-1">
            Section skill: <strong>{selectedSection.sectionType}</strong> — question type must match.
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Question</label>
        <textarea
          value={form.questionText}
          onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))}
          rows={3}
          required={requireQuestionText}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
          <select
            value={form.questionType}
            onChange={(e) => setForm((f) => ({ ...f, questionType: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={QUESTION_TYPES.MULTIPLE_CHOICE}>Multiple Choice</option>
            <option value={QUESTION_TYPES.LISTENING}>Listening</option>
            <option value={QUESTION_TYPES.WRITING}>Writing</option>
            <option value={QUESTION_TYPES.SPEAKING}>Speaking</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Points</label>
          <input
            type="number"
            value={form.points}
            min={1}
            onChange={(e) => setForm((f) => ({ ...f, points: parseInt(e.target.value, 10) || 1 }))}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {(form.questionType === QUESTION_TYPES.LISTENING || form.questionType === QUESTION_TYPES.SPEAKING) && (
        <div className="space-y-2 rounded-xl border border-slate-200 p-4 bg-slate-50/80">
          <label className="block text-sm font-medium text-slate-700">Audio (required, supports MP3)</label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".mp3,audio/mpeg,audio/mp3,audio/wav,audio/webm,audio/ogg,audio/mp4"
              onChange={handleAudioFile}
              disabled={audioUploading}
              className="text-sm"
            />
            <label className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-100">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleImageOcrTts}
                disabled={audioUploading}
                className="hidden"
              />
              OCR + TTS from image
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={generateTtsFromText} disabled={audioUploading}>
              Generate TTS from question text
            </Button>
          </div>
          <p className="text-xs text-slate-500">Recommended format: MP3.</p>
          {audioUploading && <p className="text-xs text-slate-500">Uploading…</p>}
          {form.listeningAudioUrl ? (
            <p className="text-xs text-slate-600 break-all">
              Saved URL: {form.listeningAudioUrl}
              {audioPreview ? (
                <audio className="w-full mt-2" controls src={audioPreview} />
              ) : null}
            </p>
          ) : null}
        </div>
      )}

      {form.questionType === QUESTION_TYPES.LISTENING && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Transcript (optional)</label>
          <textarea
            value={form.transcript}
            onChange={(e) => setForm((f) => ({ ...f, transcript: e.target.value }))}
            rows={2}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm resize-none"
          />
        </div>
      )}

      {form.questionType === QUESTION_TYPES.WRITING && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Min words</label>
            <input
              type="number"
              min={1}
              value={form.minWords}
              onChange={(e) => setForm((f) => ({ ...f, minWords: parseInt(e.target.value, 10) || 1 }))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Max words</label>
            <input
              type="number"
              min={1}
              value={form.maxWords}
              onChange={(e) => setForm((f) => ({ ...f, maxWords: parseInt(e.target.value, 10) || 1 }))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white"
            />
          </div>
        </div>
      )}

      {(form.questionType === QUESTION_TYPES.MULTIPLE_CHOICE || form.questionType === QUESTION_TYPES.LISTENING) && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Answer options (≥2, pick one correct)</label>
          <div className="space-y-2">
            {form.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={o.optionText}
                  onChange={(e) => updateOption(i, 'optionText', e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
                  <input
                    type="radio"
                    name="correct-option"
                    checked={!!o.isCorrect}
                    onChange={() => setCorrectOnly(i)}
                    className="accent-blue-600"
                  />
                  Correct
                </label>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addOption}>
              + Add option
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function AddQuestionModal({ examId, onClose, onSuccess }) {
  const [sections, setSections] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkTab, setBulkTab] = useState('EDITOR'); // EDITOR | LINES | JSON
  const [bulkItems, setBulkItems] = useState([createBulkItem()]);
  const [bulkJson, setBulkJson] = useState('');
  const toast = useToast();

  const loadSections = useCallback(() => {
    if (!examId) {
      setSections([]);
      return;
    }
    examSectionApi
      .list(examId)
      .then((r) => {
        const list = r.data?.data || [];
        setSections(list);
        setForm((f) => {
          if (list.length === 0) return { ...f, sectionId: '' };
          const still = list.some((s) => String(s.id) === String(f.sectionId));
          const pick = still ? f.sectionId : String(list[0].id);
          const sec = list.find((s) => String(s.id) === pick);
          return {
            ...f,
            sectionId: pick,
            questionType: sec ? questionTypeForSection(sec.sectionType) : f.questionType,
          };
        });
      })
      .catch(() => {
        setSections([]);
        toast.error('Failed to load sections.');
      });
  }, [examId, toast]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.sectionId) {
      toast.error('Select a section.');
      return;
    }
    const payload = {
      sectionId: parseInt(form.sectionId, 10),
      questionText: form.questionText.trim(),
      questionType: form.questionType,
      points: form.points,
      listeningAudioUrl: form.listeningAudioUrl || undefined,
      transcript: form.transcript || undefined,
      minWords: form.questionType === QUESTION_TYPES.WRITING ? form.minWords : undefined,
      maxWords: form.questionType === QUESTION_TYPES.WRITING ? form.maxWords : undefined,
      options:
        form.questionType === QUESTION_TYPES.MULTIPLE_CHOICE || form.questionType === QUESTION_TYPES.LISTENING
          ? form.options
          : undefined,
    };
    setLoading(true);
    try {
      if (bulkMode) {
        let items = [];
        if (bulkTab === 'LINES') {
          items = parseBulkQuestions(bulkText);
        } else if (bulkTab === 'JSON') {
          const parsed = safeJsonParse(bulkJson);
          if (!parsed.ok) {
            toast.error('Invalid JSON. Please paste a valid JSON array.');
            setLoading(false);
            return;
          }
          if (!Array.isArray(parsed.value)) {
            toast.error('JSON must be an array of questions.');
            setLoading(false);
            return;
          }
          items = parsed.value
            .map((q) => ({
              questionText: String(q?.questionText ?? '').trim(),
              options: Array.isArray(q?.options)
                ? q.options.map((o) => ({
                    optionText: String(o?.optionText ?? ''),
                    isCorrect: !!o?.isCorrect,
                  }))
                : undefined,
            }))
            .filter((q) => q.questionText);
        } else {
          // EDITOR
          items = bulkItems
            .map((q) => ({
              questionText: String(q?.questionText ?? '').trim(),
              options: q?.options,
            }))
            .filter((q) => q.questionText);
        }

        if (items.length === 0) {
          toast.error('Add at least one question.');
          setLoading(false);
          return;
        }

        if (form.questionType === QUESTION_TYPES.MULTIPLE_CHOICE || form.questionType === QUESTION_TYPES.LISTENING) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const res = normalizeMcqOptions(item.options ?? payload.options);
            if (!res.ok) {
              toast.error(`Question #${i + 1}: ${res.reason}`);
              setLoading(false);
              return;
            }
          }
        }

        const bulkPayload = items.map((item) => ({
          ...payload,
          questionText: item.questionText,
          options:
            form.questionType === QUESTION_TYPES.MULTIPLE_CHOICE || form.questionType === QUESTION_TYPES.LISTENING
              ? normalizeMcqOptions(item.options ?? payload.options).options
              : undefined,
        }));
        await questionApi.createBulk(bulkPayload);
        toast.success(`${items.length} questions added.`);
      } else {
        await questionApi.create(payload);
        toast.success('Question added.');
      }
      onSuccess();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to add question.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!examId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Pick an exam from the filter above (or open this page with ?examId=).</p>
        <div className="flex justify-end">
          <Button variant="secondary" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={bulkMode} onChange={(e) => setBulkMode(e.target.checked)} />
          Bulk mode (add multiple questions)
        </label>
      </div>
      <QuestionFormFields
        form={form}
        setForm={setForm}
        sections={sections}
        onRefreshSections={loadSections}
        audioUploading={audioUploading}
        setAudioUploading={setAudioUploading}
        toast={toast}
        requireQuestionText={!bulkMode}
      />
      {bulkMode && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setBulkTab('EDITOR')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                bulkTab === 'EDITOR' ? 'bg-white border-blue-200 text-blue-700' : 'bg-white/60 border-slate-200 text-slate-600 hover:border-blue-200'
              }`}
            >
              Editor (recommended)
            </button>
            <button
              type="button"
              onClick={() => setBulkTab('JSON')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                bulkTab === 'JSON' ? 'bg-white border-blue-200 text-blue-700' : 'bg-white/60 border-slate-200 text-slate-600 hover:border-blue-200'
              }`}
            >
              Paste JSON
            </button>
            <button
              type="button"
              onClick={() => setBulkTab('LINES')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                bulkTab === 'LINES' ? 'bg-white border-blue-200 text-blue-700' : 'bg-white/60 border-slate-200 text-slate-600 hover:border-blue-200'
              }`}
            >
              Line import
            </button>
          </div>

          {bulkTab === 'EDITOR' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Questions</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setBulkItems((xs) => [...xs, createBulkItem()])}
                >
                  + Add question
                </Button>
              </div>

              <div className="space-y-3">
                {bulkItems.map((q, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                          Question {idx + 1}
                        </label>
                        <textarea
                          rows={2}
                          value={q.questionText}
                          onChange={(e) =>
                            setBulkItems((xs) =>
                              xs.map((it, j) => (j === idx ? { ...it, questionText: e.target.value } : it)),
                            )
                          }
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Type the question…"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setBulkItems((xs) => xs.filter((_, j) => j !== idx))}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                        title="Remove"
                      >
                        Remove
                      </button>
                    </div>

                    {(form.questionType === QUESTION_TYPES.MULTIPLE_CHOICE || form.questionType === QUESTION_TYPES.LISTENING) && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Answer options</p>
                        <div className="space-y-2">
                          {(q.options || []).map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input
                                value={opt.optionText}
                                onChange={(e) =>
                                  setBulkItems((xs) =>
                                    xs.map((it, j) => {
                                      if (j !== idx) return it;
                                      const next = (it.options || []).map((o, k) =>
                                        k === oi ? { ...o, optionText: e.target.value } : o,
                                      );
                                      return { ...it, options: next };
                                    }),
                                  )
                                }
                                placeholder={`Option ${oi + 1}`}
                                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
                                <input
                                  type="radio"
                                  name={`bulk-correct-${idx}`}
                                  checked={!!opt.isCorrect}
                                  onChange={() =>
                                    setBulkItems((xs) =>
                                      xs.map((it, j) => {
                                        if (j !== idx) return it;
                                        const next = (it.options || []).map((o, k) => ({ ...o, isCorrect: k === oi }));
                                        return { ...it, options: next };
                                      }),
                                    )
                                  }
                                  className="accent-blue-600"
                                />
                                Correct
                              </label>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setBulkItems((xs) =>
                                xs.map((it, j) => {
                                  if (j !== idx) return it;
                                  const next = [...(it.options || []), { optionText: '', isCorrect: false }];
                                  return { ...it, options: next };
                                }),
                              )
                            }
                          >
                            + Add option
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {bulkTab === 'JSON' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Paste JSON array</label>
              <textarea
                rows={10}
                value={bulkJson}
                onChange={(e) => setBulkJson(e.target.value)}
                placeholder={`[\n  {\n    "questionText": "What is 2 + 2?",\n    "options": [\n      { "optionText": "3", "isCorrect": false },\n      { "optionText": "4", "isCorrect": true }\n    ]\n  }\n]`}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-mono resize-y"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const parsed = safeJsonParse(bulkJson);
                    if (!parsed.ok) {
                      toast.error('Invalid JSON.');
                      return;
                    }
                    if (!Array.isArray(parsed.value)) {
                      toast.error('JSON must be an array.');
                      return;
                    }
                    const items = parsed.value
                      .map((q) => ({
                        questionText: String(q?.questionText ?? ''),
                        options: Array.isArray(q?.options)
                          ? q.options.map((o) => ({ optionText: String(o?.optionText ?? ''), isCorrect: !!o?.isCorrect }))
                          : MC_DEFAULTS(),
                      }))
                      .filter((q) => String(q.questionText).trim());
                    if (items.length === 0) {
                      toast.error('No questions found in JSON.');
                      return;
                    }
                    setBulkItems(items);
                    setBulkTab('EDITOR');
                    toast.success(`Loaded ${items.length} questions into editor.`);
                  }}
                >
                  Load into editor
                </Button>
              </div>
            </div>
          )}

          {bulkTab === 'LINES' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Question lines</label>
              <textarea
                rows={8}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={
                  'What is 2 + 2? | 3;4;5;6 | B\n' +
                  'Capital of France? | London;Berlin;*Paris;Rome\n' +
                  'A short writing prompt (no options)'
                }
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm resize-y"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Optional format: <span className="font-mono">Question | A;B;C;D | B</span> or mark correct with{' '}
                <span className="font-mono">*</span> like <span className="font-mono">A;*B;C;D</span>.
              </p>
              <div className="flex justify-end mt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const rows = parseBulkQuestions(bulkText);
                    if (rows.length === 0) {
                      toast.error('No valid questions found.');
                      return;
                    }
                    const items = rows.map((r) => ({
                      questionText: r.questionText,
                      options: r.options
                        ? r.options.map((o) => ({ optionText: String(o.optionText ?? ''), isCorrect: !!o.isCorrect }))
                        : MC_DEFAULTS(),
                    }));
                    setBulkItems(items);
                    setBulkTab('EDITOR');
                    toast.success(`Loaded ${items.length} questions into editor.`);
                  }}
                >
                  Load into editor
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={loading}>
          {bulkMode ? 'Add Questions' : 'Add Question'}
        </Button>
      </div>
    </form>
  );
}

function EditQuestionModal({ question, onClose, onSuccess }) {
  const [sections, setSections] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const toast = useToast();
  const examId = question?.examId;

  const loadSections = useCallback(() => {
    if (!examId) return;
    examSectionApi
      .list(examId)
      .then((r) => setSections(r.data?.data || []))
      .catch(() => setSections([]));
  }, [examId]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  useEffect(() => {
    if (!question) return;
    setForm({
      sectionId: String(question.sectionId),
      questionText: question.questionText || '',
      questionType: question.questionType || QUESTION_TYPES.MULTIPLE_CHOICE,
      points: question.points ?? 1,
      listeningAudioUrl: question.listeningAudioUrl || '',
      transcript: question.transcript || '',
      minWords: question.minWords ?? 50,
      maxWords: question.maxWords ?? 250,
      options:
        question.options?.length > 0
          ? question.options.map((o) => ({ optionText: o.optionText || '', isCorrect: !!o.isCorrect }))
          : MC_DEFAULTS(),
    });
  }, [question]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      sectionId: parseInt(form.sectionId, 10),
      questionText: form.questionText.trim(),
      questionType: form.questionType,
      points: form.points,
      listeningAudioUrl: form.listeningAudioUrl || undefined,
      transcript: form.transcript || undefined,
      minWords: form.questionType === QUESTION_TYPES.WRITING ? form.minWords : undefined,
      maxWords: form.questionType === QUESTION_TYPES.WRITING ? form.maxWords : undefined,
      options:
        form.questionType === QUESTION_TYPES.MULTIPLE_CHOICE || form.questionType === QUESTION_TYPES.LISTENING
          ? form.options
          : undefined,
    };
    setLoading(true);
    try {
      await questionApi.update(question.id, payload);
      toast.success('Question updated.');
      onSuccess();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to update question.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!question) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <QuestionFormFields
        form={form}
        setForm={setForm}
        sections={sections}
        onRefreshSections={loadSections}
        audioUploading={audioUploading}
        setAudioUploading={setAudioUploading}
        toast={toast}
        requireQuestionText
      />
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={loading}>
          Save
        </Button>
      </div>
    </form>
  );
}

export default function QuestionBank() {
  const [searchParams, setSearchParams] = useSearchParams();
  const examIdParam = searchParams.get('examId');

  const [exams, setExams] = useState([]);
  const [filterExamId, setFilterExamId] = useState(examIdParam || '');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editQ, setEditQ] = useState(null);
  const [deleteQ, setDeleteQ] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (examIdParam) setFilterExamId(examIdParam);
  }, [examIdParam]);

  useEffect(() => {
    examApi
      .getAll()
      .then((r) => {
        const list = (r.data?.data || []).filter((ex) => ex.canManage !== false);
        setExams(list);
      })
      .catch(() => setExams([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const q = filterExamId ? parseInt(filterExamId, 10) : undefined;
    questionApi
      .getAll(Number.isFinite(q) ? q : undefined)
      .then((r) => setQuestions(r.data?.data || []))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, [filterExamId]);

  useEffect(() => {
    load();
  }, [load]);

  const syncExamQuery = (id) => {
    setFilterExamId(id);
    const next = new URLSearchParams(searchParams);
    if (id) next.set('examId', id);
    else next.delete('examId');
    setSearchParams(next);
  };

  const types = ['ALL', 'MULTIPLE_CHOICE', 'LISTENING', 'WRITING', 'SPEAKING'];
  const filtered = questions.filter((q) => {
    const matchType = filter === 'ALL' || q.questionType === filter;
    const matchSearch = q.questionText?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const handleDelete = async () => {
    if (!deleteQ) return;
    setDeleteLoading(true);
    try {
      await questionApi.delete(deleteQ.id);
      toast.success('Question deleted.');
      setDeleteQ(null);
      load();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to delete.';
      toast.error(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div className="card !p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Exam filter</label>
              <select
                value={filterExamId}
                onChange={(e) => syncExamQuery(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
              >
                <option value="">All my exams</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title}
                  </option>
                ))}
              </select>
            </div>
            <Link to="/exams" className="text-sm text-blue-600 hover:underline font-medium self-start sm:self-center">
              Exam management →
            </Link>
          </div>
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(t)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  filter === t ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
                }`}
              >
                {t === 'MULTIPLE_CHOICE' ? 'MC' : t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)} disabled={!filterExamId}>
              + Add question
            </Button>
          </div>
          {!filterExamId && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Select an exam to add questions (sections load per exam). You can still browse all your questions with &quot;All my exams&quot;.
            </p>
          )}
        </div>

        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState title="No questions found" description="Add questions or adjust filters." />
        ) : (
          <div className="card overflow-hidden !p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Exam / Section</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Question</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Pts</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((q, idx) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[140px]">
                      <p className="font-medium text-slate-800 truncate">{q.examTitle || '—'}</p>
                      <p className="text-slate-500 truncate">{q.sectionName || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-800 max-w-xs">
                      <p className="truncate">{q.questionText}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={q.questionType} label={q.questionType?.replace('_', ' ')} />
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 font-semibold">{q.points}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                      <Button variant="ghost" size="sm" type="button" onClick={() => setPreview(q)}>
                        View
                      </Button>
                      <Button variant="secondary" size="sm" type="button" onClick={() => setEditQ(q)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" type="button" onClick={() => setDeleteQ(q)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Question" maxWidth="max-w-2xl">
        <AddQuestionModal
          examId={filterExamId ? parseInt(filterExamId, 10) : null}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            load();
          }}
        />
      </Modal>

      <Modal isOpen={!!editQ} onClose={() => setEditQ(null)} title="Edit Question" maxWidth="max-w-2xl">
        <EditQuestionModal
          question={editQ}
          onClose={() => setEditQ(null)}
          onSuccess={() => {
            setEditQ(null);
            load();
          }}
        />
      </Modal>

      <Modal isOpen={!!preview} onClose={() => setPreview(null)} title="Question Preview">
        {preview && (
          <div className="space-y-3">
            <Badge status={preview.questionType} label={preview.questionType?.replace('_', ' ')} />
            <p className="text-xs text-slate-500">
              {preview.examTitle} · {preview.sectionName}
            </p>
            <p className="text-slate-800">{preview.questionText}</p>
            <p className="text-xs text-slate-400">{preview.points} point{preview.points !== 1 ? 's' : ''}</p>
            {preview.minWords != null && (
              <p className="text-xs text-slate-500">
                Words: {preview.minWords} – {preview.maxWords}
              </p>
            )}
            {preview.listeningAudioUrl && (
              <audio
                controls
                className="w-full"
                src={
                  preview.listeningAudioUrl.startsWith('http')
                    ? preview.listeningAudioUrl
                    : `${API_ORIGIN}${preview.listeningAudioUrl.startsWith('/') ? '' : '/'}${preview.listeningAudioUrl}`
                }
              />
            )}
            {preview.options?.length > 0 && (
              <div className="space-y-1.5 mt-3">
                {preview.options.map((o) => (
                  <div
                    key={o.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      o.isCorrect ? 'bg-green-50 text-green-700 font-medium' : 'bg-slate-50 text-slate-600'
                    }`}
                  >
                    {o.isCorrect && <span className="text-green-500">✓</span>}
                    {o.optionText}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={!!deleteQ} onClose={() => setDeleteQ(null)} title="Delete question?">
        <p className="text-sm text-slate-600">This cannot be undone.</p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" type="button" onClick={() => setDeleteQ(null)}>
            Cancel
          </Button>
          <Button variant="danger" type="button" loading={deleteLoading} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}
