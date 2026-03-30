/**
 * MultipleChoice question component.
 * Used inside ExamRoom for MULTIPLE_CHOICE type questions.
 *
 * Props:
 *   question  {Object}              – question object with .options[]
 *   value     {{ selectedOptionId }} – current answer state
 *   onChange  {Function}            – called with { selectedOptionId }
 */
export default function MultipleChoice({ question, value, onChange }) {
  const selected = value?.selectedOptionId;

  return (
    <div className="space-y-2.5">
      {question.options?.map((opt) => {
        const isChosen = selected === opt.id;
        return (
          <label
            key={opt.id}
            className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
              isChosen
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400'
                : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={isChosen}
              onChange={() => onChange({ selectedOptionId: opt.id })}
              className="w-4 h-4 accent-blue-600 shrink-0"
            />
            <span className={`text-sm ${isChosen ? 'text-blue-800 font-medium' : 'text-slate-700'}`}>
              {opt.optionText}
            </span>
          </label>
        );
      })}
    </div>
  );
}
