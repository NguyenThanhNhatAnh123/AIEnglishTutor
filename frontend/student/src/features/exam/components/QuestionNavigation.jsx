import { isAnswered } from '../examUtils';

export function QuestionNav({ questions, answers, current, onSelect, disabled }) {
  return (
    <nav className="w-56 shrink-0 hidden lg:block" aria-label="Question navigation">
      <div className="card sticky top-4 dark:bg-slate-900 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Questions
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {questions.map((q, idx) => {
            const answered = isAnswered(q, answers[q.id]);
            const isCurrent = current === q.id;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onSelect(q.id, idx)}
                disabled={disabled}
                aria-label={`Question ${idx + 1}${answered ? ' (answered)' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isCurrent
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-slate-900'
                    : answered
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:text-slate-300'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Answered
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-600 inline-block" /> Not answered
          </div>
        </div>
      </div>
    </nav>
  );
}

export function QuestionStrip({ questions, answers, current, onSelect, disabled }) {
  return (
    <div className="lg:hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Questions
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {questions.filter((q) => isAnswered(q, answers[q.id])).length}/{questions.length} answered
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {questions.map((q, idx) => {
          const answered = isAnswered(q, answers[q.id]);
          const isCurrent = current === q.id;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelect(q.id, idx)}
              disabled={disabled}
              aria-label={`Question ${idx + 1}${answered ? ' (answered)' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
              className={`h-9 min-w-9 rounded-lg px-3 text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                isCurrent
                  ? 'bg-blue-600 text-white'
                  : answered
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
