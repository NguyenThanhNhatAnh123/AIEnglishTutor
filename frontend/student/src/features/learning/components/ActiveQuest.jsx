import { AnimatePresence, motion as Motion } from 'motion/react';
import Button from '../../../components/common/Button';
import { ratingOptions } from '../constants';
import EmptyReview from './EmptyReview';
import { RelatedSentencePanel, SentenceCatchGame } from './SentencePractice';

export default function ActiveQuest({
  card,
  cards,
  selectedDeck,
  revealed,
  onReveal,
  onRate,
  onPrev,
  onNext,
  submitting,
  queueSize,
  combo,
  dueLoading,
  onLoadDue,
  shouldReduceMotion,
  caughtTokens,
  gameResult,
  hintVisible,
  fallingSeed,
  onCatchToken,
  onRemoveCaughtToken,
  onSubmitSentence,
  onResetSentence,
  onHintSentence,
}) {
  return (
    <section className="space-y-4 xl:order-2 xl:sticky xl:top-20 xl:self-start">
      <AnimatePresence mode="wait">
        {card ? (
          <Motion.article
            key={card.itemId}
            initial={shouldReduceMotion ? false : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">Active Flashcard</h2>
                <p className="text-xs font-semibold text-slate-500">{selectedDeck?.name || 'Select a route'}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={onLoadDue}
                disabled={!selectedDeck?.enrolled}
                loading={dueLoading}
              >
                Load due
              </Button>
            </div>

            <div className="grid items-center gap-3 md:grid-cols-[60px_minmax(0,1fr)_60px]">
              <button
                type="button"
                onClick={onPrev}
                disabled={queueSize < 2}
                className="flex min-h-14 flex-row items-center justify-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-40 md:min-h-20 md:flex-col"
              >
                <span className="text-2xl leading-none">&lt;</span>
                <span className="text-xs">Prev</span>
              </button>

              <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-white to-sky-50 px-4 py-6 text-center shadow-inner">
                <h3 className="break-words text-4xl font-black leading-none text-slate-950 sm:text-5xl">{card.word}</h3>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <span className="text-lg font-semibold text-slate-500">{card.phonetic}</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">A</span>
                </div>
                <span className="mt-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-sm font-bold capitalize text-blue-700">
                  {card.partOfSpeech}
                </span>
                <div className="mt-2 flex justify-center gap-2 text-xs font-bold text-slate-500">
                  <span>{queueSize} cards</span>
                  <span>Combo x{combo}</span>
                  <span>{card.status || 'new'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onNext}
                disabled={queueSize < 2}
                className="flex min-h-14 flex-row items-center justify-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-40 md:min-h-20 md:flex-col"
              >
                <span className="text-2xl leading-none">&gt;</span>
                <span className="text-xs">Next</span>
              </button>
            </div>

            <div className="space-y-4 px-5 pb-5 pt-4">
              {!revealed ? (
                <Button onClick={onReveal} className="w-full" size="lg">
                  Reveal answer
                </Button>
              ) : (
                <Motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <p className="text-xs font-black text-emerald-700">English meaning</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{card.definitionEn}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <p className="text-xs font-black text-amber-700">Vietnamese translation</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-950">{card.definitionVi}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {ratingOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={submitting}
                        onClick={() => onRate(option.value)}
                        className={`min-h-12 rounded-lg px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${option.tone}`}
                      >
                        <span className="block">{option.label}</span>
                        <span className="mt-0.5 block text-[11px] font-semibold opacity-80">{option.helper}</span>
                      </button>
                    ))}
                  </div>
                </Motion.div>
              )}
            </div>
          </Motion.article>
        ) : (
          <Motion.div
            key="empty-review"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <EmptyReview selectedDeck={selectedDeck} dueLoading={dueLoading} onLoadDue={onLoadDue} />
          </Motion.div>
        )}
      </AnimatePresence>

      {card && revealed && <RelatedSentencePanel card={card} />}
      {card && revealed && (
        <SentenceCatchGame
          card={card}
          cards={cards}
          caughtTokens={caughtTokens}
          gameResult={gameResult}
          hintVisible={hintVisible}
          fallingSeed={fallingSeed}
          shouldReduceMotion={shouldReduceMotion}
          onCatchToken={onCatchToken}
          onRemoveCaughtToken={onRemoveCaughtToken}
          onSubmit={onSubmitSentence}
          onReset={onResetSentence}
          onHint={onHintSentence}
        />
      )}
    </section>
  );
}
