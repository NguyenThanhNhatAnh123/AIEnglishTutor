import Lottie from 'lottie-react';
import { motion as Motion } from 'motion/react';
import Button from '../../../components/common/Button';
import bgQuestStage from '../../../assets/learning/backgrounds/vocabulary-quest-game-stage.png';
import emptyQueueAnimation from '../../../assets/learning/lottie/empty-queue.json';
import { clampPercent } from '../helpers';

function LottieMoment({ animationData, label, className = '' }) {
  return (
    <div className={`mx-auto h-28 w-28 ${className}`}>
      <Lottie animationData={animationData} loop aria-label={label} />
    </div>
  );
}

function LoadingMap() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
      {[1, 2, 3].map((item) => (
        <div key={item} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="skeleton h-32" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DeckNode({ deck, index, selected, busy, onEnroll, onReview, onSelect, shouldReduceMotion }) {
  const dueCount = Number(deck.dueCount || 0);
  const itemCount = Number(deck.itemCount || 0);
  const label = deck.enrolled ? (selected ? 'Your Focus' : 'Ready') : 'Unlock by enrolling';

  return (
    <Motion.div
      layout
      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: shouldReduceMotion ? 0 : index * 0.04 }}
      whileHover={shouldReduceMotion ? undefined : { y: -3 }}
      className={`relative z-10 flex items-center gap-3 ${index % 2 ? 'ml-8' : ''}`}
    >
      <button
        type="button"
        onClick={() => onSelect(deck)}
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 text-lg font-black text-white shadow-md transition ${
          selected ? 'border-white bg-blue-600 ring-4 ring-blue-200' : deck.enrolled ? 'border-white bg-emerald-600' : 'border-white bg-slate-600'
        }`}
      >
        {deck.enrolled ? deck.level : 'L'}
      </button>
      <div className={`min-w-0 flex-1 rounded-lg border bg-white/95 p-3 shadow-sm ${selected ? 'border-blue-200 ring-2 ring-blue-100' : 'border-slate-200'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-slate-950">{deck.name}</h3>
            <p className={`mt-0.5 text-xs font-bold ${deck.enrolled ? 'text-blue-700' : 'text-slate-500'}`}>{label}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">{deck.level}</span>
        </div>
        {deck.enrolled ? (
          <>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${clampPercent((dueCount / Math.max(1, itemCount)) * 100)}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black">
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-600">Due: {dueCount}</span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">New: {Number(deck.newCount || 0)}</span>
            </div>
            <button type="button" onClick={() => onReview(deck.id)} className="mt-2 text-xs font-black text-blue-700 hover:text-blue-900">
              Review route
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy === deck.id}
            onClick={() => onEnroll(deck.id)}
            className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          >
            {busy === deck.id ? 'Unlocking...' : 'Unlock by enrolling'}
          </button>
        )}
      </div>
    </Motion.div>
  );
}

export default function AdventureMap({
  decks,
  filteredDecks,
  loading,
  selectedDeck,
  busyDeck,
  onEnroll,
  onReview,
  onSelect,
  onRefresh,
  shouldReduceMotion,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:order-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">Adventure Map</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Choose your deck and start the quest!</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onRefresh} loading={loading}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="mt-4">
          <LoadingMap />
        </div>
      ) : filteredDecks.length > 0 ? (
        <div
          className="relative mt-4 min-h-[560px] overflow-hidden rounded-lg border border-emerald-100 bg-cover bg-center p-4"
          style={{ backgroundImage: `url(${bgQuestStage})` }}
        >
          <div className="absolute inset-0 bg-emerald-50/54" />
          <div className="absolute bottom-10 left-1/2 top-12 w-2 -translate-x-1/2 rounded-full border-2 border-dashed border-white bg-white/30" />
          <div className="relative z-10 space-y-9">
            {filteredDecks.slice(0, 5).map((deck, index) => (
              <DeckNode
                key={deck.id}
                deck={deck}
                index={index}
                selected={deck.id === selectedDeck?.id}
                busy={busyDeck}
                onEnroll={onEnroll}
                onReview={onReview}
                onSelect={onSelect}
                shouldReduceMotion={shouldReduceMotion}
              />
            ))}
          </div>
        </div>
      ) : decks.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <LottieMoment animationData={emptyQueueAnimation} label="No routes" />
          <h3 className="mt-3 text-lg font-bold text-slate-950">No routes yet</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            The learning service is reachable, but no vocabulary decks are available.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600 shadow-sm">
          No routes match your filters.
        </div>
      )}
      <button
        type="button"
        onClick={() => onRefresh()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700"
      >
        View All Decks
      </button>
    </section>
  );
}
