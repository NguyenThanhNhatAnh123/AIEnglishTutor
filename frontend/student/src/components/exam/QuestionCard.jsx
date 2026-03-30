import MultipleChoice from './MultipleChoice';
import WritingAnswer from './WritingAnswer';
import SpeakingRecorder from './SpeakingRecorder';

/**
 * QuestionCard – renders the correct answer component based on question type.
 *
 * Props:
 *   question  {Object}
 *   value     {Object}   – current answer state ({ selectedOptionId } or { answerText } etc.)
 *   onChange  {Function} – called with updated answer state
 */
export default function QuestionCard({ question, value, onChange }) {
  const type = question?.questionType?.toUpperCase();

  return (
    <div className="card">
      {/* Type pill */}
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 ${
        type === 'MULTIPLE_CHOICE' ? 'bg-blue-50 text-blue-600'
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
      {type === 'WRITING' && (
        <WritingAnswer value={value} onChange={onChange} />
      )}
      {type === 'SPEAKING' && (
        <SpeakingRecorder value={value} onChange={onChange} />
      )}
      {!['MULTIPLE_CHOICE', 'WRITING', 'SPEAKING'].includes(type) && (
        <p className="text-sm text-slate-400 italic">Unknown question type: {question.questionType}</p>
      )}
    </div>
  );
}
