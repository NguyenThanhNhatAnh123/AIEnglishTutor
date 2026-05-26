import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import Lottie from 'lottie-react';
import { AnimatePresence, motion as Motion, useReducedMotion } from 'motion/react';
import Button from '../components/common/Button';
import { learningService } from '../services/learningService';
import bgQuestStage from '../assets/learning/backgrounds/vocabulary-quest-game-stage.png';
import musicTrack from '../assets/learning/music/music.mp3';
import cardFlipSfx from '../assets/learning/sfx/card-flip.wav';
import successChimeSfx from '../assets/learning/sfx/success-chime.wav';
import questCompleteSfx from '../assets/learning/sfx/quest-complete.wav';
import emptyQueueAnimation from '../assets/learning/lottie/empty-queue.json';
import questCompleteAnimation from '../assets/learning/lottie/quest-complete.json';
import questLoadingAnimation from '../assets/learning/lottie/quest-loading.json';

const QUEST_GOAL = 15;
const QUEUE_LIMIT = 20;
const emptyProgress = {
  enrolledDecks: 0,
  dueCount: 0,
  newCount: 0,
  learningCount: 0,
  reviewCount: 0,
  reviewedToday: 0,
};
const ratingOptions = [
  { value: 'again', label: 'Again', helper: 'Repeat soon', tone: 'bg-rose-600 hover:bg-rose-700 text-white' },
  { value: 'hard', label: 'Hard', helper: 'Short gap', tone: 'bg-amber-500 hover:bg-amber-600 text-white' },
  { value: 'good', label: 'Good', helper: 'Keep combo', tone: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  { value: 'easy', label: 'Easy', helper: 'Boost combo', tone: 'bg-blue-600 hover:bg-blue-700 text-white' },
];
const fallbackDistractors = ['then', 'after', 'school', 'home', 'quickly', 'lesson', 'friend', 'today'];

function unwrap(response) {
  const body = response?.data;
  if (body?.success === false) throw new Error(body.message || 'Learning request failed.');
  return body?.data ?? body ?? null;
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function asDeckList(payload) {
  if (Array.isArray(payload)) return payload;
  throw new Error('Learning service returned an unexpected deck list.');
}

function asCardList(payload) {
  if (Array.isArray(payload)) return payload;
  throw new Error('Learning service returned an unexpected review queue.');
}

function normalizeProgress(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  return Object.fromEntries(
    Object.entries(emptyProgress).map(([key, value]) => [key, Number(source[key] ?? value)])
  );
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readStoredBoolean(key, fallback = false) {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  return value === 'true';
}

function playSfx(src, volume = 0.35) {
  const audio = new Audio(src);
  audio.volume = volume;
  audio.play().catch(() => {});
}

function burstConfetti(shouldReduceMotion, particleCount = 80) {
  if (shouldReduceMotion) return;
  confetti({
    particleCount,
    spread: 68,
    origin: { y: 0.62 },
    scalar: 0.85,
    ticks: 130,
  });
}

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9']/g, '')
    .trim();
}

function tokenizeSentence(sentence) {
  return String(sentence || '')
    .replace(/[.,!?;:"]/g, '')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function sentenceForCard(card) {
  if (!card) return '';
  return card.exampleSentence || `I use ${card.word || 'this word'} every day.`;
}

function sentenceViForCard(card) {
  if (!card) return '';
  return card.exampleSentenceVi || card.definitionVi || 'Vietnamese translation will appear here.';
}

function relatedPhrasesFor(card) {
  if (!card) return [];
  const sentence = tokenizeSentence(sentenceForCard(card));
  const word = String(card.word || '').trim();
  const lowerWord = normalizeToken(word);
  const wordIndex = sentence.findIndex((token) => normalizeToken(token) === lowerWord);
  const phrase =
    wordIndex >= 0
      ? sentence.slice(Math.max(0, wordIndex - 1), Math.min(sentence.length, wordIndex + 2)).join(' ')
      : '';
  return [...new Set([word, phrase, card.partOfSpeech, card.deckName].filter(Boolean))].slice(0, 4);
}

function buildGameTokens(card, cards, seed) {
  const sentenceTokens = tokenizeSentence(sentenceForCard(card));
  const nearbyWords = cards
    .filter((item) => item.itemId !== card?.itemId)
    .map((item) => item.word)
    .filter(Boolean);
  const distractors = [...nearbyWords, ...fallbackDistractors]
    .filter((word) => !sentenceTokens.some((token) => normalizeToken(token) === normalizeToken(word)))
    .slice(0, Math.max(3, 7 - sentenceTokens.length));
  const allTokens = [
    ...sentenceTokens.map((label, index) => ({ id: `target-${index}-${label}`, label, target: true })),
    ...distractors.map((label, index) => ({ id: `distractor-${index}-${label}`, label, target: false })),
  ];

  return allTokens
    .map((token, index) => ({
      ...token,
      order: (index * 37 + seed * 11) % 97,
      left: 8 + ((index * 19 + seed * 13) % 74),
      delay: ((index * 0.35 + seed * 0.17) % 2.4).toFixed(2),
      duration: 5.8 + ((index + seed) % 4) * 0.7,
    }))
    .sort((a, b) => a.order - b.order);
}

function MusicControl({ compact = false, calmMotion, onCalmMotionChange }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('learningMusicVolume') || 0.22));

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem('learningMusicVolume', String(volume));
  }, [volume]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border border-white/35 bg-white/92 px-3 py-2 text-slate-900 shadow-sm backdrop-blur ${compact ? 'justify-center' : ''}`}>
      <audio ref={audioRef} src={musicTrack} loop />
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white transition hover:bg-slate-700"
        title={playing ? 'Pause focus music' : 'Play focus music'}
      >
        {playing ? 'II' : '>'}
      </button>
      {compact && (
        <span>
          <span className="block text-sm font-black">Music</span>
          <span className="block text-xs font-semibold text-slate-500">{playing ? 'On' : 'Off'}</span>
        </span>
      )}
      <input
        aria-label="Focus music volume"
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={volume}
        onChange={(event) => setVolume(Number(event.target.value))}
        className={`${compact ? 'hidden' : 'w-20'} accent-slate-950`}
      />
      {!compact && <label className="flex items-center gap-2 border-l border-slate-200 pl-2 text-xs font-bold text-slate-600">
        <input
          type="checkbox"
          checked={calmMotion}
          onChange={(event) => onCalmMotionChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-blue-600"
        />
        Calm motion
      </label>}
    </div>
  );
}

function QuestHeader({ sessionReviewed, combo, questPercent, calmMotion, onCalmMotionChange }) {
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
                {index < activeMilestones ? '✓' : ''}
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

function AdventureMap({
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

function EmptyReview({ selectedDeck, dueLoading, onLoadDue }) {
  return (
    <section className="rounded-lg border border-dashed border-slate-300 bg-white p-7 text-center shadow-sm">
      <LottieMoment animationData={dueLoading ? questLoadingAnimation : emptyQueueAnimation} label="Quest queue" />
      <h3 className="mt-3 text-lg font-bold text-slate-950">
        {selectedDeck?.enrolled ? 'Queue cleared for now' : 'Unlock by enrolling'}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {selectedDeck?.enrolled
          ? 'You cleared this route. Check again later or pick another deck on the map.'
          : 'Enroll this route to create a review queue from active vocabulary items.'}
      </p>
      {selectedDeck?.enrolled && (
        <Button className="mt-5" variant="secondary" size="sm" onClick={onLoadDue} loading={dueLoading}>
          Check due cards
        </Button>
      )}
    </section>
  );
}

function RelatedSentencePanel({ card }) {
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

function SentenceCatchGame({
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

function ActiveQuest({
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

function RewardSummary({ visible, reviewed, combo, lastRatings, onClose, onContinue }) {
  if (!visible) return null;
  const strongRatings = lastRatings.filter((rating) => rating === 'good' || rating === 'easy').length;
  const mood = reviewed === 0 ? 'Ready' : strongRatings / Math.max(1, lastRatings.length) >= 0.7 ? 'Sharp' : 'Warming up';

  return (
    <Motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
        <LottieMoment animationData={questCompleteAnimation} label="Quest complete" className="h-24 w-24" />
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-emerald-950">Quest Complete</h2>
          <p className="mt-1 text-sm leading-6 text-emerald-800">
            {reviewed} cards cleared. Accuracy mood: {mood}. Next review will appear when the schedule brings cards back.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-emerald-900">
            <span className="rounded-full bg-white/70 px-3 py-1">Best combo {combo}x</span>
            <span className="rounded-full bg-white/70 px-3 py-1">{strongRatings} confident hits</span>
          </div>
        </div>
        <div className="flex gap-2 sm:flex-col">
          <Button variant="secondary" size="sm" onClick={onContinue}>
            Continue
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Hide
          </Button>
        </div>
      </div>
    </Motion.section>
  );
}

export default function Learning() {
  const prefersReducedMotion = useReducedMotion();
  const [decks, setDecks] = useState([]);
  const [progress, setProgress] = useState(emptyProgress);
  const [selectedDeckId, setSelectedDeckId] = useState(() => {
    const stored = Number(localStorage.getItem('learningSelectedDeckId'));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  });
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dueLoading, setDueLoading] = useState(false);
  const [busyDeck, setBusyDeck] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [lastRatings, setLastRatings] = useState([]);
  const [rewardVisible, setRewardVisible] = useState(false);
  const [calmMotion, setCalmMotion] = useState(() => readStoredBoolean('learningCalmMotion'));
  const [caughtTokens, setCaughtTokens] = useState([]);
  const [gameResult, setGameResult] = useState('');
  const [hintVisible, setHintVisible] = useState(false);
  const [fallingSeed, setFallingSeed] = useState(1);
  const shouldReduceMotion = Boolean(prefersReducedMotion || calmMotion);

  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.id === selectedDeckId) || decks[0] || null,
    [decks, selectedDeckId]
  );
  const currentCard = cards[currentIndex] || null;
  const questPercent = clampPercent((sessionReviewed / QUEST_GOAL) * 100);
  const levelOptions = useMemo(() => [...new Set(decks.map((deck) => deck.level).filter(Boolean))], [decks]);
  const topicOptions = useMemo(() => [...new Set(decks.map((deck) => deck.topic).filter(Boolean))], [decks]);
  const filteredDecks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decks.filter((deck) => {
      const matchesQuery =
        !q ||
        deck.name?.toLowerCase().includes(q) ||
        deck.description?.toLowerCase().includes(q) ||
        deck.topic?.toLowerCase().includes(q);
      const matchesLevel = levelFilter === 'all' || deck.level === levelFilter;
      const matchesTopic = topicFilter === 'all' || deck.topic === topicFilter;
      return matchesQuery && matchesLevel && matchesTopic;
    });
  }, [decks, levelFilter, query, topicFilter]);

  useEffect(() => {
    localStorage.setItem('learningCalmMotion', String(calmMotion));
  }, [calmMotion]);

  useEffect(() => {
    if (selectedDeckId) localStorage.setItem('learningSelectedDeckId', String(selectedDeckId));
  }, [selectedDeckId]);

  useEffect(() => {
    setCaughtTokens([]);
    setGameResult('');
    setHintVisible(false);
    setFallingSeed((value) => value + 1);
  }, [currentCard?.itemId]);

  const loadDueCards = async (deckId = selectedDeck?.id, options = {}) => {
    if (!deckId) return;
    if (!options.silent) setDueLoading(true);
    setError('');
    try {
      const response = await learningService.getDueReviews({ deckId, limit: QUEUE_LIMIT });
      const queue = asCardList(unwrap(response));
      setCards(queue);
      setCurrentIndex(0);
      setRevealed(false);
      setSelectedDeckId(deckId);
      if (queue.length > 0) setRewardVisible(false);
    } catch (err) {
      setCards([]);
      setError(getErrorMessage(err, 'Learning quest is offline. Please check the learning service and try again.'));
    } finally {
      if (!options.silent) setDueLoading(false);
    }
  };

  const loadData = async (options = {}) => {
    setError('');
    setLoading(true);
    try {
      const [deckResponse, progressResponse] = await Promise.all([
        learningService.getDecks(),
        learningService.getProgress(),
      ]);
      const deckList = asDeckList(unwrap(deckResponse));
      const nextProgress = normalizeProgress(unwrap(progressResponse));
      const nextSelected =
        deckList.find((deck) => deck.id === selectedDeckId) ||
        deckList.find((deck) => deck.enrolled && Number(deck.dueCount || 0) > 0) ||
        deckList.find((deck) => deck.enrolled) ||
        deckList[0] ||
        null;

      setDecks(deckList);
      setProgress(nextProgress);
      setSelectedDeckId(nextSelected?.id ?? null);

      if (options.loadDue !== false && nextSelected?.enrolled) {
        await loadDueCards(nextSelected.id, { silent: true });
      } else if (!nextSelected?.enrolled) {
        setCards([]);
      }
    } catch (err) {
      setDecks([]);
      setCards([]);
      setProgress(emptyProgress);
      setError(getErrorMessage(err, 'Learning quest is offline. Please check the learning service and try again.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectDeck = (deck) => {
    setSelectedDeckId(deck.id);
    setRewardVisible(false);
    if (deck.enrolled) {
      loadDueCards(deck.id);
    } else {
      setCards([]);
      setRevealed(false);
    }
  };

  const enrollDeck = async (deckId) => {
    setBusyDeck(deckId);
    setError('');
    try {
      await learningService.enrollDeck(deckId);
      setSelectedDeckId(deckId);
      await loadData({ loadDue: false });
      await loadDueCards(deckId);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to enroll this route.'));
    } finally {
      setBusyDeck(null);
    }
  };

  const revealCard = () => {
    setRevealed(true);
    playSfx(cardFlipSfx, 0.28);
  };

  const goToCard = (direction) => {
    if (cards.length < 2) return;
    setCurrentIndex((index) => (index + direction + cards.length) % cards.length);
    setRevealed(false);
  };

  const catchToken = (token) => {
    const sentenceLength = tokenizeSentence(sentenceForCard(currentCard)).length;
    setGameResult('');
    setCaughtTokens((tokens) => {
      if (tokens.some((item) => item.id === token.id) || tokens.length >= sentenceLength) return tokens;
      return [...tokens, token];
    });
  };

  const resetSentenceGame = () => {
    setCaughtTokens([]);
    setGameResult('');
    setHintVisible(false);
    setFallingSeed((value) => value + 1);
  };

  const submitSentence = () => {
    const targetTokens = tokenizeSentence(sentenceForCard(currentCard));
    const guess = caughtTokens.slice(0, targetTokens.length).map((token) => normalizeToken(token.label));
    const target = targetTokens.map(normalizeToken);
    const correct = guess.length === target.length && guess.every((token, index) => token === target[index]);
    setGameResult(correct ? 'correct' : 'wrong');
    if (correct) {
      playSfx(successChimeSfx, 0.25);
      burstConfetti(shouldReduceMotion, 55);
    }
  };

  const submitRating = async (rating) => {
    if (!currentCard) return;
    setSubmitting(true);
    setError('');
    try {
      await learningService.submitReview({
        itemId: currentCard.itemId,
        rating,
        requestId: crypto.randomUUID(),
      });

      const positive = rating === 'good' || rating === 'easy';
      const nextCombo = positive ? combo + 1 : rating === 'hard' ? Math.max(0, combo - 1) : 0;
      const nextReviewed = sessionReviewed + 1;
      const nextRatings = [...lastRatings.slice(-9), rating];
      const nextQueue = cards.filter((card) => card.itemId !== currentCard.itemId);
      const complete = nextReviewed >= 10 || nextReviewed >= QUEST_GOAL || nextQueue.length === 0;

      setCombo(nextCombo);
      setBestCombo((value) => Math.max(value, nextCombo));
      setSessionReviewed(nextReviewed);
      setLastRatings(nextRatings);
      setCards(nextQueue);
      setCurrentIndex(0);
      setRevealed(false);

      if (positive) playSfx(successChimeSfx, 0.25);
      if (nextCombo === 5 || nextCombo === 10) burstConfetti(shouldReduceMotion, nextCombo === 10 ? 95 : 60);
      if (complete) {
        setRewardVisible(true);
        playSfx(questCompleteSfx, 0.3);
        burstConfetti(shouldReduceMotion, 110);
      }

      const [progressResponse, deckResponse] = await Promise.all([
        learningService.getProgress(),
        learningService.getDecks(),
      ]);
      setProgress(normalizeProgress(unwrap(progressResponse)));
      setDecks(asDeckList(unwrap(deckResponse)));
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save review.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <QuestHeader
        selectedDeck={selectedDeck}
        progress={progress}
        sessionReviewed={sessionReviewed}
        combo={combo}
        questPercent={questPercent}
        calmMotion={calmMotion}
        onCalmMotionChange={setCalmMotion}
      />

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <RewardSummary
        visible={rewardVisible}
        reviewed={sessionReviewed}
        combo={bestCombo}
        lastRatings={lastRatings}
        onClose={() => setRewardVisible(false)}
        onContinue={() => {
          setRewardVisible(false);
          loadDueCards(selectedDeck?.id);
        }}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(340px,0.86fr)_minmax(460px,1.14fr)]">
        <AdventureMap
          decks={decks}
          filteredDecks={filteredDecks}
          loading={loading}
          selectedDeck={selectedDeck}
          busyDeck={busyDeck}
          query={query}
          setQuery={setQuery}
          levelFilter={levelFilter}
          setLevelFilter={setLevelFilter}
          topicFilter={topicFilter}
          setTopicFilter={setTopicFilter}
          levelOptions={levelOptions}
          topicOptions={topicOptions}
          onEnroll={enrollDeck}
          onReview={loadDueCards}
          onSelect={selectDeck}
          onRefresh={() => loadData()}
          shouldReduceMotion={shouldReduceMotion}
        />

        <ActiveQuest
          card={currentCard}
          cards={cards}
          selectedDeck={selectedDeck}
          revealed={revealed}
          onReveal={revealCard}
          onRate={submitRating}
          onPrev={() => goToCard(-1)}
          onNext={() => goToCard(1)}
          submitting={submitting}
          queueSize={cards.length}
          combo={combo}
          dueLoading={dueLoading}
          onLoadDue={() => loadDueCards(selectedDeck?.id)}
          shouldReduceMotion={shouldReduceMotion}
          caughtTokens={caughtTokens}
          gameResult={gameResult}
          hintVisible={hintVisible}
          fallingSeed={fallingSeed}
          onCatchToken={catchToken}
          onRemoveCaughtToken={(index) => {
            setGameResult('');
            setCaughtTokens((tokens) => tokens.filter((_, tokenIndex) => tokenIndex !== index));
          }}
          onSubmitSentence={submitSentence}
          onResetSentence={resetSentenceGame}
          onHintSentence={() => setHintVisible((value) => !value)}
        />
      </section>
    </div>
  );
}
