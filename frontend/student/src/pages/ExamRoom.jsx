import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { examApi, submissionApi, answerApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';

function QuestionNav({ questions, answers, current, onSelect }) {
  return (
    <nav className="w-56 shrink-0 hidden lg:block">
      <div className="card sticky top-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Questions</p>
        <div className="grid grid-cols-5 gap-1.5">
          {questions.map((q, idx) => {
            const answered = !!answers[q.id];
            const isCurrent = current === q.id;
            return (
              <button
                key={q.id}
                onClick={() => onSelect(q.id)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  isCurrent
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-1'
                    : answered
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Answered
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-3 h-3 rounded-sm bg-slate-200 inline-block" /> Not answered
          </div>
        </div>
      </div>
    </nav>
  );
}

function MCQuestion({ question, value, onChange }) {
  return (
    <div className="space-y-2">
      {question.options?.map((opt) => (
        <label
          key={opt.id}
          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            value?.selectedOptionId === opt.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 hover:border-blue-300 bg-white'
          }`}
        >
          <input
            type="radio"
            name={`q-${question.id}`}
            checked={value?.selectedOptionId === opt.id}
            onChange={() => onChange({ selectedOptionId: opt.id })}
            className="w-4 h-4 text-blue-600 accent-blue-600"
          />
          <span className="text-sm text-slate-700">{opt.optionText}</span>
        </label>
      ))}
    </div>
  );
}

function WritingQuestion({ question, value, onChange }) {
  return (
    <textarea
      value={value?.answerText || ''}
      onChange={(e) => onChange({ answerText: e.target.value })}
      placeholder="Write your answer here..."
      rows={8}
      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
    />
  );
}

function SpeakingQuestion({ value, onChange }) {
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        onChange({ audioUrl: url, answerText: 'audio-recorded' });
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setRecording(true);
    } catch {
      alert('Microphone access required.');
    }
  };

  const stopRecord = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center ${recording ? 'bg-red-100 animate-pulse' : 'bg-blue-50'}`}>
        <svg className={`w-8 h-8 ${recording ? 'text-red-500' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </div>
      {recording ? (
        <Button variant="danger" onClick={stopRecord}>Stop Recording</Button>
      ) : (
        <Button variant="primary" onClick={startRecord}>
          {value?.audioUrl ? 'Re-record' : 'Start Recording'}
        </Button>
      )}
      {value?.audioUrl && !recording && (
        <audio controls src={value.audioUrl} className="w-full max-w-xs" />
      )}
    </div>
  );
}

function QuestionBlock({ question, value, onChange }) {
  const type = question.questionType?.toUpperCase();
  return (
    <div className="card">
      <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-1">
        {type?.replace('_', ' ')}
      </p>
      <p className="text-slate-800 font-medium mb-4">{question.questionText}</p>
      <p className="text-xs text-slate-400 mb-4">{question.points} pt{question.points !== 1 ? 's' : ''}</p>
      {type === 'MULTIPLE_CHOICE' && <MCQuestion question={question} value={value} onChange={onChange} />}
      {type === 'WRITING' && <WritingQuestion question={question} value={value} onChange={onChange} />}
      {type === 'SPEAKING' && <SpeakingQuestion value={value} onChange={onChange} />}
    </div>
  );
}

export default function ExamRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [exam, setExam] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const saveRef = useRef(null);

  useEffect(() => {
    examApi.getById(id)
      .then((r) => {
        const e = r.data?.data;
        setExam(e);
        const allQ = e?.sections?.flatMap((s) => s.questions || []) || [];
        if (allQ[0]) setCurrentQ(allQ[0].id);
      })
      .catch(() => toast.error('Could not load exam.'))
      .finally(() => setLoading(false));
  }, [id]);

  const startExam = async () => {
    try {
      const res = await submissionApi.start({ examId: parseInt(id) });
      const sub = res.data?.data;
      setSubmission(sub);
      setTimeLeft((exam?.durationMinutes ?? 60) * 60);
      toast.info('Exam started! Good luck!');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to start exam.');
    }
  };

  useEffect(() => {
    if (!submission || timeLeft === null) return;
    if (timeLeft <= 0) {
      toast.warning('Time is up! Auto-submitting...');
      doSubmit();
      return;
    }
    timerRef.current = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [submission, timeLeft === 0]);

  const persistAnswer = useCallback((questionId, data) => {
    if (!submission) return;
    answerApi.create({
      submissionId: submission.id,
      questionId,
      answerText: data?.answerText,
      selectedOptionId: data?.selectedOptionId,
      audioUrl: data?.audioUrl,
    }).catch(() => {});
  }, [submission]);

  const saveAnswer = useCallback((questionId, data) => {
    setAnswers((prev) => ({ ...prev, [questionId]: data }));
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => persistAnswer(questionId, data), 600);
  }, [persistAnswer]);

  useEffect(() => () => { if (saveRef.current) clearTimeout(saveRef.current); }, []);

  const doSubmit = async () => {
    if (!submission) return;
    setSubmitting(true);
    try {
      for (const [qId, data] of Object.entries(answers)) {
        await answerApi.create({
          submissionId: submission.id,
          questionId: parseInt(qId),
          answerText: data?.answerText,
          selectedOptionId: data?.selectedOptionId,
          audioUrl: data?.audioUrl,
        });
      }
      await submissionApi.submit({ submissionId: submission.id });
      navigate(`/result/${submission.id}`);
    } catch {
      toast.error('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (loading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="w-10 h-10 rounded-full border-[3px] border-blue-100 border-t-blue-600 animate-spin" />
    </div>
  );
  if (!exam) return <div className="card text-center py-16 text-slate-400">Exam not found.</div>;

  const allQuestions = exam.sections?.flatMap((s) => s.questions || []) || [];
  const answeredCount = Object.keys(answers).filter((k) => answers[k]).length;

  return (
    <div className="min-h-screen -m-6 bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{exam.title}</h1>
          <p className="text-xs text-slate-400">{answeredCount} of {allQuestions.length} answered</p>
        </div>
        <div className="flex items-center gap-4">
          {submission && timeLeft !== null && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-lg ${
              timeLeft <= 60 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
            }`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(timeLeft)}
            </div>
          )}
          {submission && (
            <Button variant="primary" onClick={() => setConfirmOpen(true)} disabled={submitting}>
              Submit Exam
            </Button>
          )}
        </div>
      </div>

      {!submission ? (
        <div className="flex items-center justify-center py-20">
          <div className="card max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">{exam.title}</h2>
            <p className="text-slate-400 text-sm mb-2">{exam.description}</p>
            <div className="flex items-center justify-center gap-4 text-sm text-slate-500 mb-6">
              <span>⏱ {exam.durationMinutes} minutes</span>
              <span>📝 {allQuestions.length} questions</span>
            </div>
            <Button variant="primary" size="lg" onClick={startExam} className="w-full">
              Start Exam
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-6 p-6">
          {/* Question navigator */}
          <QuestionNav
            questions={allQuestions}
            answers={answers}
            current={currentQ}
            onSelect={setCurrentQ}
          />

          {/* Sections + questions */}
          <div className="flex-1 space-y-4">
            {exam.sections?.map((section) => (
              <div key={section.id}>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">{section.name}</h2>
                <div className="space-y-4">
                  {section.questions?.map((q) => (
                    <div key={q.id} id={`q-${q.id}`} onClick={() => setCurrentQ(q.id)}>
                      <QuestionBlock
                        question={q}
                        value={answers[q.id]}
                        onChange={(v) => saveAnswer(q.id, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit confirmation */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit Exam?"
      >
        <p className="text-slate-600 text-sm">
          You have answered <strong>{answeredCount}</strong> of <strong>{allQuestions.length}</strong> questions.
          Submitting is final — you cannot change answers afterward.
        </p>
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={doSubmit} loading={submitting}>
            Submit Exam
          </Button>
        </div>
      </Modal>
    </div>
  );
}
