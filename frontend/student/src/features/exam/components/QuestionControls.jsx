import { useState } from 'react';
import AudioPlayer from '../../../../../packages/ui/AudioPlayer.jsx';
import SpeakingRecorder from '../../../components/exam/SpeakingRecorder.jsx';
import { aiApi } from '../../../services/api';
import { resolveAudioSrc } from '../examUtils';

function MCQuestion({ question, value, onChange, disabled }) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Answer options">
      {question.options?.map((opt) => (
        <label
          key={opt.id}
          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all focus-within:ring-2 focus-within:ring-blue-400 ${
            value?.selectedOptionId === opt.id
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-400'
              : 'border-slate-200 hover:border-blue-300 bg-white dark:bg-slate-800 dark:border-slate-600'
          } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
        >
          <input
            type="radio"
            name={`q-${question.id}`}
            checked={value?.selectedOptionId === opt.id}
            onChange={() => onChange({ selectedOptionId: opt.id })}
            disabled={disabled}
            className="w-4 h-4 text-blue-600 accent-blue-600"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">{opt.optionText}</span>
        </label>
      ))}
    </div>
  );
}

function WritingQuestion({ value, onChange, toast, disabled }) {
  const [processing, setProcessing] = useState(false);

  const onPickImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setProcessing(true);
      const res = await aiApi.imageOcrTts(file);
      const data = res.data?.data || {};
      onChange({
        imageUrl: data.imageUrl || undefined,
        answerText: data.extractedText || value?.answerText || '',
        speakingAudioUrl: data.audioUrl || undefined,
        speakingFormat: data.audioUrl ? 'mp3' : value?.speakingFormat,
      });
      toast.info('Image OCR + TTS completed.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to process image.');
    } finally {
      setProcessing(false);
    }
  };

  const generatedAudioSrc = resolveAudioSrc(value?.speakingAudioUrl);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={onPickImage}
            disabled={disabled || processing}
            className="hidden"
          />
          {processing ? 'Processing image...' : 'Upload image for OCR + TTS'}
        </label>
        {value?.imageUrl && (
          <a
            href={resolveAudioSrc(value.imageUrl)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            View uploaded image
          </a>
        )}
      </div>
      {generatedAudioSrc && (
        <AudioPlayer src={generatedAudioSrc} disabled={disabled} className="max-w-md" />
      )}
      <textarea
        value={value?.answerText || ''}
        onChange={(e) => onChange({ answerText: e.target.value })}
        placeholder="Write your answer here..."
        rows={8}
        aria-label="Your written answer"
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:opacity-60"
      />
    </div>
  );
}

export function QuestionBlock({ question, value, onChange, toast, interactionLocked, submissionId }) {
  const type = question.questionType?.toUpperCase();
  const promptSrc = resolveAudioSrc(question.listeningAudioUrl || question.audioUrl);

  return (
    <div className="card dark:bg-slate-900 dark:border-slate-700">
      <p className="text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider mb-1">
        {type?.replace(/_/g, ' ')}
      </p>
      {promptSrc && (
        <div className="mb-4 space-y-2">
          <AudioPlayer src={promptSrc} disabled={interactionLocked} className="max-w-2xl" />
        </div>
      )}
      <p className="text-slate-800 dark:text-slate-100 font-medium mb-4">{question.questionText}</p>
      <p className="text-xs text-slate-400 mb-4">
        {question.points} pt{question.points !== 1 ? 's' : ''}
      </p>
      {(type === 'MULTIPLE_CHOICE' || type === 'LISTENING') && (
        <MCQuestion question={question} value={value} onChange={onChange} disabled={interactionLocked} />
      )}
      {type === 'WRITING' && (
        <WritingQuestion
          value={value}
          onChange={onChange}
          toast={toast}
          disabled={interactionLocked}
        />
      )}
      {type === 'SPEAKING' && submissionId != null && (
        <SpeakingRecorder
          submissionId={submissionId}
          questionId={question.id}
          instructionAudioUrl={question.listeningAudioUrl || question.audioUrl}
          disabled={interactionLocked}
          value={value}
          onChange={onChange}
        />
      )}
    </div>
  );
}
