import { useToast } from '../../context/ToastContext';
import AudioRecorder from './AudioRecorder';
import AudioPlayer from '../../../../packages/ui/AudioPlayer.jsx';
import { API_ORIGIN } from '../../services/api';

/**
 * @param {object} props
 * @param {number} [props.submissionId] Required for uploads (exam flow).
 * @param {number} [props.questionId] Defaults to props from parent when using QuestionCard.
 * @param {string} [props.instructionAudioUrl] Teacher prompt audio (relative or absolute URL).
 * @param {object} props.value
 * @param {function} props.onChange
 * @param {boolean} [props.disabled]
 */
export default function SpeakingRecorder({ submissionId, questionId, instructionAudioUrl, value, onChange, disabled }) {
  const toast = useToast();

  const resolvedInstruction =
    instructionAudioUrl && !instructionAudioUrl.startsWith('http') && !instructionAudioUrl.startsWith('blob:')
      ? `${API_ORIGIN}${instructionAudioUrl.startsWith('/') ? '' : '/'}${instructionAudioUrl}`
      : instructionAudioUrl;

  if (submissionId == null || questionId == null) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-xl px-4 py-3">
        Speaking recording needs an active exam session. Use the exam page to submit speaking answers.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {resolvedInstruction ? (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Listen to the prompt</p>
          <AudioPlayer src={resolvedInstruction} disabled={disabled} />
        </div>
      ) : null}
      <AudioRecorder
        submissionId={submissionId}
        questionId={questionId}
        value={value}
        onChange={onChange}
        toast={toast}
        disabled={disabled}
      />
    </div>
  );
}
