import MusicControl from './MusicControl';
import { QUEST_GOAL } from '../constants';
import bgQuestStage from '../../../assets/learning/backgrounds/vocabulary-quest-game-stage.png';

export default function QuestHeader({ sessionReviewed, combo, questPercent, calmMotion, onCalmMotionChange }) {
  const reviewed = Math.min(sessionReviewed, QUEST_GOAL);
  const milestones = [0, 1, 2, 3, 4, 5, 6];
  const activeMilestones = Math.min(milestones.length, Math.max(1, Math.ceil((questPercent / 100) * milestones.length)));

  return (
    <section
      className="relative overflow-hidden rounded-lg border border-slate-200 bg-cover bg-center p-4 shadow-sm"
      style={{ backgroundImage: `url(${bgQuestStage})` }}
    >
      <div className="absolute inset-0 bg-white/12" />
      <div className="relative grid min-h-32 gap-4 lg:grid-cols-[230px_minmax(260px,1fr)_360px] lg:items-center">
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-white/94 p-4 text-slate-950 shadow-sm">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-amber-300 bg-sky-50 text-2xl font-black text-blue-700 shadow-inner">
            Q
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800">Today Quest</p>
            <div className="mt-1 flex items-end gap-1">
              <span className="text-4xl font-black leading-none text-blue-700">{reviewed}</span>
              <span className="pb-1 text-2xl font-black text-slate-800">/{QUEST_GOAL}</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">Clear {QUEST_GOAL} cards</p>
          </div>
        </div>

        <div className="relative hidden min-h-20 items-center px-2 lg:flex">
          <div className="absolute left-8 right-8 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/75 shadow-inner" />
          <div className="relative z-10 flex w-full items-center justify-between">
            {milestones.map((item, index) => (
              <div
                key={item}
                className={`flex h-8 w-8 items-center justify-center rounded-full border-4 text-xs font-black shadow-sm ${
                  index < activeMilestones
                    ? 'border-white bg-emerald-500 text-white'
                    : 'border-white bg-slate-300 text-slate-600'
                }`}
              >
                {index < activeMilestones ? '\u2713' : ''}
              </div>
            ))}
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border-4 border-amber-300 bg-amber-500 text-xl font-black text-white shadow-md">
              XP
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-amber-200 bg-white/94 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-lg font-black text-rose-600">C</span>
              <div>
                <p className="text-sm font-black text-slate-950">Combo x{combo}</p>
                <p className="text-xs font-semibold text-slate-500">Keep it up!</p>
              </div>
            </div>
          </div>
          <MusicControl compact calmMotion={calmMotion} onCalmMotionChange={onCalmMotionChange} />
          <label className="flex items-center justify-center gap-3 rounded-lg border border-blue-100 bg-white/94 px-4 py-3 text-slate-950 shadow-sm">
            <input
              type="checkbox"
              checked={calmMotion}
              onChange={(event) => onCalmMotionChange(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-blue-600"
            />
            <span>
              <span className="block text-sm font-black">Calm motion</span>
              <span className="block text-xs font-semibold text-slate-500">{calmMotion ? 'On' : 'Off'}</span>
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}
