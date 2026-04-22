import MultipleChoice from './MultipleChoice';
import WritingAnswer from './WritingAnswer';
import SpeakingRecorder from './SpeakingRecorder';
import AudioPlayer from '../../../../packages/ui/AudioPlayer.jsx';
import { API_ORIGIN } from '../../services/api';

/**
 * QuestionCard – renders the correct answer component based on question type.
 *
 * Props:
 *   question  {Object}
 *   value     {Object}   – current answer state ({ selectedOptionId } or { answerText } etc.)
 *   onChange  {Function} – called with updated answer state
 *   submissionId {number} optional – speaking uploads
 *   interactionLocked {boolean} optional
 */
export default function QuestionCard({ question, value, onChange, submissionId, interactionLocked }) {
  const type = question?.questionType?.toUpperCase();
  const rawAudio = question?.listeningAudioUrl;
  const audioSrc =
    rawAudio && !rawAudio.startsWith('http') && !rawAudio.startsWith('blob:')
      ? `${API_ORIGIN}${rawAudio.startsWith('/') ? '' : '/'}${rawAudio}`
      : rawAudio;

  return (
    <div className="card">
      {/* Type pill */}
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 ${
        type === 'MULTIPLE_CHOICE' ? 'bg-blue-50 text-blue-600'
        : type === 'LISTENING' ? 'bg-cyan-50 text-cyan-700'
        : type === 'WRITING' ? 'bg-purple-50 text-purple-600'
        : type === 'SPEAKING' ? 'bg-rose-50 text-rose-600'
        : 'bg-slate-100 text-slate-500'
      }`}>
        {type?.replace('_', ' ')}
      </span>

      {/* Question text */}
      <p className="text-slate-800 font-medium mb-1">{question.questionText}</p>
      <p className="text-xs text-slate-400 mb-4">
        {question.points} point{question.points !== 1 ? 's' : ''}
      </p>

      {/* Answer input */}
      {type === 'MULTIPLE_CHOICE' && (
        <MultipleChoice question={question} value={value} onChange={onChange} />
      )}
      {type === 'LISTENING' && (
        <div className="space-y-4">
          {audioSrc ? (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Audio</p>
              <AudioPlayer src={audioSrc} disabled={interactionLocked} />
            </div>
          ) : null}
          {question.transcript ? (
            <div className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase">Transcript</span>
              <p className="mt-1 whitespace-pre-wrap">{question.transcript}</p>
            </div>
          ) : null}
          <MultipleChoice question={question} value={value} onChange={onChange} />
        </div>
      )}
      {type === 'WRITING' && (
        <WritingAnswer
          value={value}
          onChange={onChange}
          minWords={question.minWords ?? 0}
          maxWords={question.maxWords ?? 0}
        />
      )}
      {type === 'SPEAKING' && (
        <SpeakingRecorder
          submissionId={submissionId}
          questionId={question?.id}
          instructionAudioUrl={question?.listeningAudioUrl}
          value={value}
          onChange={onChange}
          disabled={interactionLocked}
        />
      )}
      {!['MULTIPLE_CHOICE', 'LISTENING', 'WRITING', 'SPEAKING'].includes(type) && (
        <p className="text-sm text-slate-400 italic">Unknown question type: {question.questionType}</p>
      )}
    </div>
  );
}
