import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { learningService } from '../services/learningService';
import ActiveQuest from '../features/learning/components/ActiveQuest';
import AdventureMap from '../features/learning/components/AdventureMap';
import QuestHeader from '../features/learning/components/QuestHeader';
import RewardSummary from '../features/learning/components/RewardSummary';
import { QUEUE_LIMIT, QUEST_GOAL, emptyProgress } from '../features/learning/constants';
import {
  asCardList,
  asDeckList,
  burstConfetti,
  clampPercent,
  getErrorMessage,
  normalizeProgress,
  normalizeToken,
  playSfx,
  readStoredBoolean,
  sentenceForCard,
  tokenizeSentence,
  unwrap,
} from '../features/learning/helpers';
import cardFlipSfx from '../assets/learning/sfx/card-flip.wav';
import successChimeSfx from '../assets/learning/sfx/success-chime.wav';
import questCompleteSfx from '../assets/learning/sfx/quest-complete.wav';

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
