export default function WritingAnswer({ value, onChange }) {
  return (
    <textarea
      value={value?.answerText ?? ''}
      onChange={(e) => onChange({ answerText: e.target.value })}
      placeholder="Write your essay here..."
      rows={6}
      className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-y"
    />
  );
}
