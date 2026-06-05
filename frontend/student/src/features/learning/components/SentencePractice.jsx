import { useMemo } from 'react';
import { motion as Motion } from 'motion/react';
import Button from '../../../components/common/Button';
import bgQuestStage from '../../../assets/learning/backgrounds/vocabulary-quest-game-stage.png';
import {
  buildGameTokens,
  normalizeToken,
  relatedPhrasesFor,
  sentenceForCard,
  sentenceViForCard,
  tokenizeSentence,
} from '../helpers';

export function RelatedSentencePanel({ card }) {
  if (!card) return null;
  const sentence = sentenceForCard(card);
  const sentenceVi = sentenceViForCard(card);
  const phrases = relatedPhrasesFor(card);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-950">Related Sentence</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Use the word inside a real sentence.</p>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
          title="Audio placeholder"
        >
          A
        </button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.75fr)]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xl font-black leading-7 text-slate-950">{sentence}</p>
          <p className="mt-2 text-base leading-6 text-slate-600">{sentenceVi}</p>
        </div>
        <div>
          <p className="mb-2 text-xs font-black text-slate-500">Related phrases</p>
          <div className="grid grid-cols-2 gap-2">
            {phrases.map((phrase) => (
              <span key={phrase} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-bold text-emerald-700">
                {phrase}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SentenceCatchGame({
  card,
  cards,
  caughtTokens,
  gameResult,
  hintVisible,
  fallingSeed,
  shouldReduceMotion,
  onCatchToken,
  onRemoveCaughtToken,
  onSubmit,
  onReset,
  onHint,
}) {
  const sentenceTokens = useMemo(() => tokenizeSentence(sentenceForCard(card)), [card]);
  const gameTokens = useMemo(() => buildGameTokens(card, cards, fallingSeed), [card, cards, fallingSeed]);
  const caughtIds = new Set(caughtTokens.map((token) => token.id));
  const canSubmit = caughtTokens.length >= sentenceTokens.length && sentenceTokens.length > 0;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div>
          <h3 className="text-lg font-black text-slate-950">Sentence Catch</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Catch words to build the sentence.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-rose-100 bg-white px-3 py-2 text-sm font-black text-rose-600">Heart 3</span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">00:35</span>
          {gameResult && (
            <span
              className={`rounded-full px-3 py-2 text-xs font-bold ${
                gameResult === 'correct' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {gameResult === 'correct' ? 'Correct' : 'Try again'}
            </span>
          )}
        </div>
      </div>

      <div
        className="relative min-h-72 overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: `url(${bgQuestStage})` }}
      >
        <div className="absolute inset-0 bg-sky-100/40" />
        <div className="absolute inset-x-6 bottom-5 z-10 grid grid-cols-2 gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white/88 p-3 shadow-sm sm:grid-cols-5">
          {sentenceTokens.map((token, index) => {
            const caught = caughtTokens[index];
            const wrong =
              gameResult === 'wrong' && caught && normalizeToken(caught.label) !== normalizeToken(token);
            return (
              <button
                type="button"
                onClick={() => caught && onRemoveCaughtToken(index)}
                disabled={!caught}
                key={`${token}-${index}`}
                className={`min-h-12 rounded-lg border px-3 py-2 text-center text-base font-black shadow-sm transition ${
                  wrong
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : caught
                      ? 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50'
                      : 'border-dashed border-slate-300 bg-white/70 text-slate-400'
                }`}
              >
                {caught?.label || '_'}
              </button>
            );
          })}
        </div>

        <div className="relative z-10 h-48">
          {gameTokens.map((token) => {
            const isCaught = caughtIds.has(token.id);
            if (isCaught) return null;
            return (
              <Motion.button
                key={token.id}
                type="button"
                onClick={() => onCatchToken(token)}
                className={`absolute top-3 rounded-lg border px-5 py-3 text-lg font-black shadow-sm transition ${
                  token.target
                    ? 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50'
                    : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
                style={{ left: `${token.left}%` }}
                initial={shouldReduceMotion ? false : { y: -18, opacity: 0 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { y: 124, opacity: [0, 1, 1, 0.96] }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: token.duration, delay: Number(token.delay), repeat: Infinity, repeatDelay: 0.8 }
                }
              >
                {token.label}
              </Motion.button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 p-4">
        {hintVisible && (
          <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
            Hint: {sentenceTokens.join(' | ')}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <Button size="lg" onClick={onSubmit} disabled={!canSubmit} className="bg-emerald-600 hover:bg-emerald-700">
            Submit Sentence
          </Button>
          <Button size="lg" variant="secondary" onClick={onReset}>
            Reset
          </Button>
          <Button size="lg" variant="secondary" onClick={onHint}>
            Hint
          </Button>
        </div>
      </div>
    </section>
  );
}
