import confetti from 'canvas-confetti';
import { emptyProgress, fallbackDistractors } from './constants';

export function unwrap(response) {
  const body = response?.data;
  if (body?.success === false) throw new Error(body.message || 'Learning request failed.');
  return body?.data ?? body ?? null;
}

export function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

export function asDeckList(payload) {
  if (Array.isArray(payload)) return payload;
  throw new Error('Learning service returned an unexpected deck list.');
}

export function asCardList(payload) {
  if (Array.isArray(payload)) return payload;
  throw new Error('Learning service returned an unexpected review queue.');
}

export function normalizeProgress(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  return Object.fromEntries(
    Object.entries(emptyProgress).map(([key, value]) => [key, Number(source[key] ?? value)])
  );
}

export function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function readStoredBoolean(key, fallback = false) {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  return value === 'true';
}

export function playSfx(src, volume = 0.35) {
  const audio = new Audio(src);
  audio.volume = volume;
  audio.play().catch(() => {});
}

export function burstConfetti(shouldReduceMotion, particleCount = 80) {
  if (shouldReduceMotion) return;
  confetti({
    particleCount,
    spread: 68,
    origin: { y: 0.62 },
    scalar: 0.85,
    ticks: 130,
  });
}

export function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9']/g, '')
    .trim();
}

export function tokenizeSentence(sentence) {
  return String(sentence || '')
    .replace(/[.,!?;:"]/g, '')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function sentenceForCard(card) {
  if (!card) return '';
  return card.exampleSentence || `I use ${card.word || 'this word'} every day.`;
}

export function sentenceViForCard(card) {
  if (!card) return '';
  return card.exampleSentenceVi || card.definitionVi || 'Vietnamese translation will appear here.';
}

export function relatedPhrasesFor(card) {
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

export function buildGameTokens(card, cards, seed) {
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
