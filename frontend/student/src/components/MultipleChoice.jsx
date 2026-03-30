export default function MultipleChoice({ options, value, onChange }) {
  return (
    <div className="space-y-2">
      {options?.map((opt) => (
        <label
          key={opt.id}
          className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 cursor-pointer"
        >
          <input
            type="radio"
            name={`opt-${opt.id}`}
            checked={value?.selectedOptionId === opt.id}
            onChange={() => onChange({ selectedOptionId: opt.id })}
            className="w-4 h-4 text-amber-500"
          />
          <span className="text-slate-200">{opt.optionText}</span>
        </label>
      ))}
    </div>
  );
}
