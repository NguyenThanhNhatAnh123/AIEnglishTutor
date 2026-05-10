import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/common/Button';
import { aiApi, examApi, examSectionApi, questionApi, API_ORIGIN } from '../services/api';
import { useToast } from '../context/ToastContext';
import { QUESTION_TYPES } from '../../../packages/utils/constants.js';

function buildBulkLine(result) {
  const question = String(result.questionText || result.extractedText || '').trim();
  if (!question) return '';
  const choices = Array.isArray(result.choices) ? result.choices.filter(Boolean) : [];
  if (choices.length < 2) return question;
  const options = choices.join(';');
  return `${question} | ${options} | A`;
}

export default function OcrWorkspace() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState('');
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingFromScan, setCreatingFromScan] = useState(false);
  const toast = useToast();

  const latest = results[0] || null;
  const selectedSection = useMemo(
    () => sections.find((s) => String(s.id) === String(sectionId)) || null,
    [sections, sectionId]
  );
  const targetQuestionType = selectedSection?.sectionType === 'LISTENING' ? 'LISTENING' : QUESTION_TYPES.MULTIPLE_CHOICE;
  const audioPreview = useMemo(() => {
    if (!latest?.audioUrl) return '';
    if (/^https?:\/\//i.test(latest.audioUrl)) return latest.audioUrl;
    return `${API_ORIGIN}${latest.audioUrl.startsWith('/') ? '' : '/'}${latest.audioUrl}`;
  }, [latest]);

  const onPickFile = (e) => {
    const picked = e.target.files?.[0] || null;
    setFile(picked);
    if (!picked) {
      setPreviewUrl('');
      return;
    }
    setPreviewUrl(URL.createObjectURL(picked));
  };

  useEffect(() => {
    examApi
      .getAll()
      .then((r) => {
        const list = r.data?.data || [];
        setExams(list);
        const manageable = list.find((ex) => ex.canManage !== false);
        const pick = manageable?.id ?? list[0]?.id;
        if (pick != null) setExamId(String(pick));
      })
      .catch((err) => {
        setExams([]);
        const msg = err?.response?.data?.message || 'Failed to load exams.';
        toast.error(msg);
      });
  }, [toast]);

  useEffect(() => {
    if (!examId) {
      setSections([]);
      setSectionId('');
      return;
    }
    examSectionApi
      .list(examId)
      .then((r) => {
        const list = r.data?.data || [];
        setSections(list);
        if (list[0]?.id) setSectionId(String(list[0].id));
      })
      .catch(() => {
        setSections([]);
        setSectionId('');
      });
  }, [examId]);

  const onScan = async () => {
    if (!file) {
      toast.error('Please choose an image first.');
      return;
    }
    setProcessing(true);
    try {
      const res = await aiApi.imageOcrTts(file);
      const data = res.data?.data || {};
      const draft = {
        questionText: data.questionText || data.extractedText || '',
        extractedText: data.extractedText || '',
        choices: Array.isArray(data.choices) ? data.choices : [],
        audioUrl: data.audioUrl || '',
        scannedAt: new Date().toISOString(),
      };
      setResults((prev) => [draft, ...prev].slice(0, 20));
      toast.success('OCR + TTS completed.');
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'OCR + TTS failed.';
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  const onScanAndCreate = async () => {
    if (!file) {
      toast.error('Please choose an image first.');
      return;
    }
    if (!sectionId) {
      toast.error('Please select an exam section.');
      return;
    }

    setCreatingFromScan(true);
    try {
      const res = await aiApi.ocrToQuestion(file, sectionId, 1, 0, targetQuestionType);
      const data = res.data?.data || {};
      const ocr = data.ocr || {};
      const draft = {
        questionText: ocr.questionText || ocr.extractedText || '',
        extractedText: ocr.extractedText || '',
        choices: Array.isArray(ocr.choices) ? ocr.choices : [],
        audioUrl: ocr.audioUrl || '',
        scannedAt: new Date().toISOString(),
      };
      setResults((prev) => [draft, ...prev].slice(0, 20));
      toast.success(`Question #${data.question?.id || ''} created from OCR.`);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'OCR + question creation failed.';
      toast.error(msg);
    } finally {
      setCreatingFromScan(false);
    }
  };

  const createQuestionFromLatest = async () => {
    if (!latest) {
      toast.error('No OCR result available.');
      return;
    }
    if (!sectionId) {
      toast.error('Please select an exam section.');
      return;
    }
    const qText = String(latest.questionText || latest.extractedText || '').trim();
    if (!qText) {
      toast.error('OCR did not return question text.');
      return;
    }
    const choices = (latest.choices || []).filter((c) => String(c).trim());
    if (choices.length < 2) {
      toast.error('Need at least 2 choices to create a question.');
      return;
    }
    if (targetQuestionType === 'LISTENING' && !latest.audioUrl) {
      toast.error('No TTS audio found from OCR result. Run OCR again or choose a non-listening section.');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        sectionId: parseInt(sectionId, 10),
        questionText: qText,
        questionType: targetQuestionType,
        points: 1,
        listeningAudioUrl: targetQuestionType === 'LISTENING' ? (latest.audioUrl || undefined) : undefined,
        transcript: latest.extractedText || undefined,
        options: choices.map((c, idx) => ({ optionText: c, isCorrect: idx === 0 })),
      };
      await questionApi.create(payload);
      toast.success('Question created in Question Bank.');
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to create question.';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const copyBulkLines = async () => {
    const lines = results.map(buildBulkLine).filter(Boolean).join('\n');
    if (!lines) {
      toast.error('No valid OCR results to export.');
      return;
    }
    try {
      await navigator.clipboard.writeText(lines);
      toast.success('Copied line-import format for Question Bank.');
    } catch {
      toast.error('Could not access clipboard.');
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div className="card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">OCR Workspace</h2>
              <p className="text-sm text-slate-500">
                Scan question images in bulk, then paste exported lines into Question Bank.
              </p>
            </div>
            <Link to="/questions" className="text-sm text-blue-600 hover:underline font-medium">
              Open Question Bank →
            </Link>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Exam</label>
                  <select
                    value={examId}
                    onChange={(e) => setExamId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
                    disabled={!exams.length}
                  >
                    {exams.length === 0 ? (
                      <option value="">No manageable exams</option>
                    ) : (
                      exams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.title}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Section</label>
                  <select
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
                    disabled={!sections.length}
                  >
                    {sections.length === 0 ? (
                      <option value="">No sections</option>
                    ) : (
                      sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.sectionType ? `[${s.sectionType}] ` : ''}
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <label className="block text-sm font-medium text-slate-700">Upload image</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={onPickFile}
                disabled={processing}
                className="text-sm"
              />
              {previewUrl && (
                <img src={previewUrl} alt="OCR input preview" className="max-h-64 w-full object-contain rounded-lg border border-slate-200 bg-white" />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="primary" onClick={onScan} loading={processing}>
                  Run OCR + TTS
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={onScanAndCreate}
                  loading={creatingFromScan}
                  disabled={!sectionId}
                >
                  OCR + Create question
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={createQuestionFromLatest}
                  loading={creating}
                  disabled={!latest || !sectionId}
                >
                  Create question
                </Button>
                <Button type="button" variant="secondary" onClick={copyBulkLines} disabled={!results.length}>
                  Copy for line import
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Latest Output</h3>
              {!latest ? (
                <p className="text-sm text-slate-500">No OCR result yet.</p>
              ) : (
                <>
                  <p className="text-xs text-slate-500">Question text</p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{latest.questionText || '—'}</p>
                  {latest.choices?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500">Choices</p>
                      {latest.choices.map((choice, idx) => (
                        <p key={`${choice}-${idx}`} className="text-sm text-slate-700">
                          {String.fromCharCode(65 + idx)}. {choice}
                        </p>
                      ))}
                    </div>
                  )}
                  {audioPreview && <audio controls className="w-full" src={audioPreview} />}
                  <p className="text-xs text-slate-500">
                    Tip: “Create question” saves the latest result directly to the selected section as a {targetQuestionType === 'LISTENING' ? 'Listening' : 'Multiple-choice'} question.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Scan History ({results.length})</h3>
          </div>
          {results.length === 0 ? (
            <p className="text-sm text-slate-500">History is empty.</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
              {results.map((item, idx) => (
                <div key={`${item.scannedAt}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">{new Date(item.scannedAt).toLocaleString()}</p>
                  <p className="text-sm text-slate-800 line-clamp-2">{item.questionText || item.extractedText || '—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
