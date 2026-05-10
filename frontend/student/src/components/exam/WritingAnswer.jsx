/**
 * WritingAnswer component.
 * Used inside ExamRoom for WRITING type questions.
 *
 * Props:
 *   value    {{ answerText }}  – current answer state
 *   onChange {Function}       – called with { answerText }
 *   minWords {number}         – shows a word-count warning when below this (default 0 = disabled)
 *   maxWords {number}         – soft warning when above this (default 0 = disabled)
 *   disabled {boolean}        – lock textarea when exam time expires
 */
export default function WritingAnswer({ value, onChange, minWords = 0, maxWords = 0, disabled = false }) {
  const text      = value?.answerText || '';
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const tooShort  = minWords > 0 && wordCount < minWords;
  const tooLong   = maxWords > 0 && wordCount > maxWords;

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => onChange({ answerText: e.target.value })}
        placeholder="Write your answer here..."
        rows={10}
        disabled={disabled}
        className={`w-full px-4 py-3 rounded-xl border text-slate-800 text-sm resize-y transition-colors focus:outline-none focus:ring-2 ${
          (tooShort || tooLong) && text.length > 0
            ? 'border-amber-300 focus:ring-amber-400'
            : 'border-slate-200 focus:ring-blue-500'
        } disabled:opacity-60 disabled:cursor-not-allowed`}
      />
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{wordCount} word{wordCount !== 1 ? 's' : ''} · {charCount} character{charCount !== 1 ? 's' : ''}</span>
        {(minWords > 0 || maxWords > 0) && (
          <span className={tooShort || tooLong ? 'text-amber-500' : 'text-green-600'}>
            {tooShort ? `Minimum ${minWords} words required` : tooLong ? `Maximum ${maxWords} words` : '✓ Within range'}
          </span>
        )}
      </div>
    </div>
  );
}
