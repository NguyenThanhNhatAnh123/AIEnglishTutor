import { API_ORIGIN } from '../../services/api';

export function resolveAudioSrc(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function examRoomBackground(image, overlay = 'rgba(255,255,255,0.92)') {
  return {
    backgroundImage: `linear-gradient(90deg, ${overlay}, rgba(255,255,255,0.7)), url(${image})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

export function detectDeviceType() {
  if (typeof navigator === 'undefined') return 'UNKNOWN';
  const ua = (navigator.userAgent || '').toLowerCase();
  if (/(ipad|tablet)/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) return 'TABLET';
  if (/(mobi|iphone|ipod|android)/.test(ua)) return 'MOBILE';
  return 'DESKTOP';
}

export function initialAnalytics() {
  const ua = typeof navigator === 'undefined' ? '' : (navigator.userAgent || '');
  return {
    tabSwitchCount: 0,
    focusLossCount: 0,
    copyPasteCount: 0,
    suspiciousEventCount: 0,
    deviceType: detectDeviceType(),
    deviceLabel: ua.slice(0, 255),
  };
}

export function resolveSubmissionStartEpochMs(submission) {
  if (!submission) return null;
  if (submission.deadlineEpochMs != null && submission.durationMinutes != null) {
    const fromDeadline = Number(submission.deadlineEpochMs) - Number(submission.durationMinutes) * 60_000;
    if (Number.isFinite(fromDeadline)) return fromDeadline;
  }
  if (submission.startTime) {
    const parsed = new Date(submission.startTime).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const DRAFT_KEY_PREFIX = 'exam_draft_v1';
const AUDIO_DRAFT_DB = 'exam_audio_drafts_v1';
const AUDIO_DRAFT_STORE = 'recordings';

export function draftKeyFor(submissionId) {
  return submissionId ? `${DRAFT_KEY_PREFIX}_${submissionId}` : null;
}

export function serializeDraftAnswers(answers) {
  const serialized = {};
  Object.entries(answers || {}).forEach(([questionId, answer]) => {
    if (!answer) return;
    serialized[questionId] = {
      answerText: answer.answerText,
      selectedOptionId: answer.selectedOptionId,
      speakingAudioUrl: answer.speakingAudioUrl,
      speakingDurationSeconds: answer.speakingDurationSeconds,
      speakingFormat: answer.speakingFormat,
      imageUrl: answer.imageUrl,
      localUpdatedAt: answer.localUpdatedAt,
      hasUnsavedSpeakingBlob: answer.speakingBlob instanceof Blob,
    };
  });
  return serialized;
}

export function readLocalDraft(submissionId) {
  const key = draftKeyFor(submissionId);
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function clearLocalDraft(submissionId) {
  const key = draftKeyFor(submissionId);
  if (key) localStorage.removeItem(key);
}

function speakingDraftKey(submissionId, questionId) {
  return `${submissionId}:${questionId}`;
}

function openAudioDraftDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(AUDIO_DRAFT_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(AUDIO_DRAFT_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function saveSpeakingDraftBlob(submissionId, questionId, blob) {
  if (!(blob instanceof Blob)) return;
  const db = await openAudioDraftDb();
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction(AUDIO_DRAFT_STORE, 'readwrite');
    tx.objectStore(AUDIO_DRAFT_STORE).put(blob, speakingDraftKey(submissionId, questionId));
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
  db.close();
}

async function readSpeakingDraftBlob(submissionId, questionId) {
  const db = await openAudioDraftDb();
  if (!db) return null;
  const blob = await new Promise((resolve) => {
    const tx = db.transaction(AUDIO_DRAFT_STORE, 'readonly');
    const request = tx.objectStore(AUDIO_DRAFT_STORE).get(speakingDraftKey(submissionId, questionId));
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => resolve(null);
  });
  db.close();
  return blob;
}

export async function deleteSpeakingDraftBlob(submissionId, questionId) {
  const db = await openAudioDraftDb();
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction(AUDIO_DRAFT_STORE, 'readwrite');
    tx.objectStore(AUDIO_DRAFT_STORE).delete(speakingDraftKey(submissionId, questionId));
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
  db.close();
}

export async function restoreSpeakingDraftBlobs(submissionId, answerMap, questions) {
  const next = { ...answerMap };
  let restoredCount = 0;
  for (const question of questions) {
    if ((question?.questionType || '').toUpperCase() !== 'SPEAKING') continue;
    const blob = await readSpeakingDraftBlob(submissionId, question.id);
    if (!blob) continue;
    next[question.id] = {
      ...(next[question.id] || {}),
      speakingBlob: blob,
      speakingAudioUrl: next[question.id]?.speakingAudioUrl,
      speakingFormat: next[question.id]?.speakingFormat || blob.type || 'audio/webm',
    };
    restoredCount += 1;
  }
  return { answers: next, restoredCount };
}

export function isAnswered(question, value) {
  if (!value) return false;
  const type = question?.questionType?.toUpperCase() || '';
  switch (type) {
    case 'MULTIPLE_CHOICE':
    case 'LISTENING':
      return value.selectedOptionId != null;
    case 'WRITING':
      return typeof value.answerText === 'string' && value.answerText.trim().length > 0;
    case 'SPEAKING': {
      const u = value.speakingAudioUrl;
      const hasUploaded = typeof u === 'string' && u.length > 0 && !u.startsWith('blob:');
      const hasLocal = value.speakingBlob instanceof Blob;
      return hasUploaded || hasLocal;
    }
    default:
      return !!(value.selectedOptionId || value.answerText || value.speakingAudioUrl);
  }
}

export function sectionQuestionCount(sections) {
  return (sections || []).reduce((acc, s) => acc + ((s.questions || []).length), 0);
}

export function questionType(question) {
  return (question?.questionType || '').trim().toUpperCase();
}

export function hasAnyQuestion(questions, type) {
  return questions.some((q) => questionType(q) === type);
}

export function hasAnyAudioPrompt(questions) {
  return questions.some((q) => questionType(q) === 'LISTENING' || q.listeningAudioUrl || q.audioUrl);
}

export function statusTone(ok, waiting = false) {
  if (ok) return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100';
  if (waiting) return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100';
}
