import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/common/Button';
import { aiApi, examApi, examSectionApi, questionApi, API_ORIGIN } from '../services/api';
import { useToast } from '../context/ToastContext';
import { QUESTION_TYPES, SECTION_TYPES } from '../../../packages/utils/constants.js';

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
  const [paperProcessing, setPaperProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [paperQuestions, setPaperQuestions] = useState([]);
  const [paperRawText, setPaperRawText] = useState('');
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState('');
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const latest = results[0] || null;
  const selectedSection = useMemo(
    () => sections.find((s) => String(s.id) === String(sectionId)) || null,
    [sections, sectionId]
  );
  const targetQuestionType = selectedSection?.sectionType === SECTION_TYPES.LISTENING ? QUESTION_TYPES.LISTENING : QUESTION_TYPES.MULTIPLE_CHOICE;
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
    setPreviewUrl(picked.type?.startsWith('image/') ? URL.createObjectURL(picked) : '');
  };

  const normalizeQuestionDraft = (item, idx) => {
    const options = Array.isArray(item.options) ? item.options : [];
    const optionChoices = options
      .map((option) => String(option?.optionText ?? option?.text ?? option ?? '').trim())
      .filter(Boolean);
    const explicitCorrectIndex = options.findIndex((option) => !!option?.isCorrect);
    const choices = Array.isArray(item.choices) && item.choices.length
      ? item.choices.map((choice) => String(choice ?? '').trim()).filter(Boolean)
      : optionChoices;

    return {
      localId: item.localId || `${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`,
      questionNumber: item.questionNumber || idx + 1,
      questionText: item.questionText || '',
      extractedText: item.extractedText || '',
      choices: choices.length ? choices : ['', '', '', ''],
      correctChoiceIndex: Number.isInteger(item.correctChoiceIndex)
        ? item.correctChoiceIndex
        : explicitCorrectIndex >= 0 ? explicitCorrectIndex : 0,
      rawText: item.rawText || item.extractedText || '',
      audioUrl: item.audioUrl || '',
      scannedAt: item.scannedAt || new Date().toISOString(),
    };
  };

  const normalizePaperQuestion = (item, idx) => normalizeQuestionDraft(item, idx);

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
      const draft = normalizeQuestionDraft({
        questionText: data.questionText || data.extractedText || '',
        extractedText: data.extractedText || '',
        choices: Array.isArray(data.choices) ? data.choices : [],
        audioUrl: data.audioUrl || '',
        scannedAt: new Date().toISOString(),
      }, 0);
      setResults((prev) => [draft, ...prev].slice(0, 20));
      toast.success('OCR draft is ready for review.');
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'OCR + TTS failed.';
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  const onScanPaper = async () => {
    if (!file) {
      toast.error('Please choose an image or PDF first.');
      return;
    }
    setPaperProcessing(true);
    try {
      const res = await aiApi.ocrPaper(file);
      const data = res.data?.data || {};
      const drafts = Array.isArray(data.questions) ? data.questions.map(normalizePaperQuestion) : [];
      setPaperQuestions(drafts);
      setPaperRawText(data.extractedText || '');
      toast.success(`Found ${drafts.length} question${drafts.length === 1 ? '' : 's'} for review.`);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Whole-paper OCR failed.';
      toast.error(msg);
    } finally {
      setPaperProcessing(false);
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
    if (![SECTION_TYPES.READING, SECTION_TYPES.LISTENING].includes(selectedSection?.sectionType)) {
      toast.error('OCR draft creation supports Reading or Listening sections.');
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
      const correctChoiceIndex = Math.min(
        Math.max(Number(latest.correctChoiceIndex) || 0, 0),
        Math.max(choices.length - 1, 0),
      );
      const payload = {
        sectionId: parseInt(sectionId, 10),
        questionText: qText,
        questionType: targetQuestionType,
        points: 1,
        listeningAudioUrl: targetQuestionType === 'LISTENING' ? (latest.audioUrl || undefined) : undefined,
        transcript: latest.extractedText || undefined,
        options: choices.map((c, idx) => ({ optionText: c, isCorrect: idx === correctChoiceIndex })),
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

  const updatePaperQuestion = (localId, patch) => {
    setPaperQuestions((prev) => prev.map((q) => (q.localId === localId ? { ...q, ...patch } : q)));
  };

  const updateLatest = (patch) => {
    setResults((prev) => prev.map((q, idx) => (idx === 0 ? { ...q, ...patch } : q)));
  };

  const updateLatestChoice = (choiceIndex, value) => {
    setResults((prev) => prev.map((q, idx) => {
      if (idx !== 0) return q;
      const choices = [...(q.choices || [])];
      choices[choiceIndex] = value;
      return { ...q, choices };
    }));
  };

  const addLatestChoice = () => {
    setResults((prev) => prev.map((q, idx) => (
      idx === 0 ? { ...q, choices: [...(q.choices || []), ''] } : q
    )));
  };

  const updatePaperChoice = (localId, choiceIndex, value) => {
    setPaperQuestions((prev) => prev.map((q) => {
      if (q.localId !== localId) return q;
      const choices = [...q.choices];
      choices[choiceIndex] = value;
      return { ...q, choices };
    }));
  };

  const addPaperChoice = (localId) => {
    setPaperQuestions((prev) => prev.map((q) => (
      q.localId === localId ? { ...q, choices: [...q.choices, ''] } : q
    )));
  };

  const removePaperQuestion = (localId) => {
    setPaperQuestions((prev) => prev.filter((q) => q.localId !== localId));
  };

  const createPaperQuestions = async () => {
    if (!sectionId) {
      toast.error('Please select an exam section.');
      return;
    }
    if (selectedSection?.sectionType !== SECTION_TYPES.READING) {
      toast.error('Bulk OCR review currently creates multiple-choice questions only. Choose a Reading section.');
      return;
    }
    const payload = paperQuestions
      .map((q) => {
        const choices = (q.choices || []).map((c) => String(c || '').trim()).filter(Boolean);
        const correctChoiceIndex = Math.min(Math.max(Number(q.correctChoiceIndex) || 0, 0), Math.max(choices.length - 1, 0));
        return {
          sectionId: parseInt(sectionId, 10),
          questionText: String(q.questionText || '').trim(),
          questionType: QUESTION_TYPES.MULTIPLE_CHOICE,
          points: 1,
          transcript: q.rawText || undefined,
          options: choices.map((choice, idx) => ({ optionText: choice, isCorrect: idx === correctChoiceIndex })),
        };
      })
      .filter((q) => q.questionText && q.options.length >= 2);

    if (!payload.length) {
      toast.error('No valid reviewed questions to create.');
      return;
    }

    setCreating(true);
    try {
      await questionApi.createBulk(payload);
      toast.success(`Created ${payload.length} question${payload.length === 1 ? '' : 's'} from reviewed OCR.`);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to create reviewed questions.';
      toast.error(msg);
    } finally {
      setCreating(false);
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
                Scan question images or papers, review temporary drafts here, then create them in Question Bank.
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
                accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                onChange={onPickFile}
                disabled={processing || paperProcessing}
                className="text-sm"
              />
              {file && !previewUrl && (
                <p className="text-xs text-slate-500">{file.name}</p>
              )}
              {previewUrl && (
                <img src={previewUrl} alt="OCR input preview" className="max-h-64 w-full object-contain rounded-lg border border-slate-200 bg-white" />
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="primary" onClick={onScan} loading={processing}>
                  Scan single draft
                </Button>
                <Button type="button" variant="primary" onClick={onScanPaper} loading={paperProcessing}>
                  Scan paper to drafts
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={createQuestionFromLatest}
                  loading={creating}
                  disabled={!latest || !sectionId}
                >
                  Create selected draft
                </Button>
                <Button type="button" variant="secondary" onClick={copyBulkLines} disabled={!results.length}>
                  Copy for line import
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Latest Draft</h3>
              {!latest ? (
                <p className="text-sm text-slate-500">No OCR result yet.</p>
              ) : (
                <>
                  <label className="block text-xs text-slate-500">Question text</label>
                  <textarea
                    value={latest.questionText || ''}
                    onChange={(e) => updateLatest({ questionText: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    placeholder="Question text"
                  />
                  {latest.choices?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">Choices</p>
                      {latest.choices.map((choice, idx) => (
                        <label key={`${latest.localId}-${idx}`} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                          <input
                            type="radio"
                            name="latest-correct"
                            checked={(latest.correctChoiceIndex || 0) === idx}
                            onChange={() => updateLatest({ correctChoiceIndex: idx })}
                            className="accent-blue-600"
                          />
                          <span className="text-xs font-bold text-slate-500 w-4">{String.fromCharCode(65 + idx)}</span>
                          <input
                            value={choice}
                            onChange={(e) => updateLatestChoice(idx, e.target.value)}
                            className="min-w-0 flex-1 border-0 text-sm focus:outline-none"
                            placeholder={`Choice ${String.fromCharCode(65 + idx)}`}
                          />
                        </label>
                      ))}
                      <Button type="button" variant="secondary" onClick={addLatestChoice}>
                        Add choice
                      </Button>
                    </div>
                  )}
                  {audioPreview && <audio controls className="w-full" src={audioPreview} />}
                  <p className="text-xs text-slate-500">
                    This draft stays on the OCR page until you press Create selected draft.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Paper Review ({paperQuestions.length})</h3>
              <p className="text-xs text-slate-500">Edit OCR output, pick the correct answer, then create questions in bulk.</p>
            </div>
            <Button type="button" variant="primary" onClick={createPaperQuestions} loading={creating} disabled={!paperQuestions.length || !sectionId}>
              Create reviewed questions
            </Button>
          </div>

          {paperQuestions.length === 0 ? (
            <p className="text-sm text-slate-500">No whole-paper scan yet.</p>
          ) : (
            <div className="space-y-3">
              {paperQuestions.map((q, idx) => (
                <div key={q.localId} className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-700">Question {q.questionNumber || idx + 1}</p>
                    <Button type="button" variant="secondary" onClick={() => removePaperQuestion(q.localId)}>
                      Remove
                    </Button>
                  </div>
                  <textarea
                    value={q.questionText}
                    onChange={(e) => updatePaperQuestion(q.localId, { questionText: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    placeholder="Question text"
                  />
                  <div className="grid md:grid-cols-2 gap-2">
                    {q.choices.map((choice, choiceIdx) => (
                      <label key={`${q.localId}-${choiceIdx}`} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                        <input
                          type="radio"
                          name={`correct-${q.localId}`}
                          checked={(q.correctChoiceIndex || 0) === choiceIdx}
                          onChange={() => updatePaperQuestion(q.localId, { correctChoiceIndex: choiceIdx })}
                          className="accent-blue-600"
                        />
                        <span className="text-xs font-bold text-slate-500 w-4">{String.fromCharCode(65 + choiceIdx)}</span>
                        <input
                          value={choice}
                          onChange={(e) => updatePaperChoice(q.localId, choiceIdx, e.target.value)}
                          className="min-w-0 flex-1 border-0 text-sm focus:outline-none"
                          placeholder={`Choice ${String.fromCharCode(65 + choiceIdx)}`}
                        />
                      </label>
                    ))}
                  </div>
                  <Button type="button" variant="secondary" onClick={() => addPaperChoice(q.localId)}>
                    Add choice
                  </Button>
                </div>
              ))}
            </div>
          )}

          {paperRawText && (
            <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">Raw OCR text</summary>
              <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-600">{paperRawText}</pre>
            </details>
          )}
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
