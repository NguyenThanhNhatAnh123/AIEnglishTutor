import MultipleChoice from './MultipleChoice';
import WritingAnswer from './WritingAnswer';
import SpeakingRecorder from './SpeakingRecorder';

export default function QuestionCard({ question, value, onChange }) {
  const type = (question?.questionType || 'MULTIPLE_CHOICE').toUpperCase();

  return (
    <div className="mb-6 p-4 rounded-xl bg-slate-800 border border-slate-700">
      <p className="text-white mb-4">{question?.questionText}</p>
      <p className="text-slate-500 text-sm mb-4">{question?.points} pt(s)</p>
      {type === 'MULTIPLE_CHOICE' && (
        <MultipleChoice
          options={question?.options || []}
          value={value}
          onChange={onChange}
        />
      )}
      {type === 'WRITING' && (
        <WritingAnswer value={value} onChange={onChange} />
      )}
      {type === 'SPEAKING' && (
        <SpeakingRecorder value={value} onChange={onChange} />
      )}
    </div>
  );
}
