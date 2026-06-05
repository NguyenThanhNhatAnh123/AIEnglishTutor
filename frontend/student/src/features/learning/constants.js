export const QUEST_GOAL = 15;
export const QUEUE_LIMIT = 20;

export const emptyProgress = {
  enrolledDecks: 0,
  dueCount: 0,
  newCount: 0,
  learningCount: 0,
  reviewCount: 0,
  reviewedToday: 0,
};

export const ratingOptions = [
  { value: 'again', label: 'Again', helper: 'Repeat soon', tone: 'bg-rose-600 hover:bg-rose-700 text-white' },
  { value: 'hard', label: 'Hard', helper: 'Short gap', tone: 'bg-amber-500 hover:bg-amber-600 text-white' },
  { value: 'good', label: 'Good', helper: 'Keep combo', tone: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  { value: 'easy', label: 'Easy', helper: 'Boost combo', tone: 'bg-blue-600 hover:bg-blue-700 text-white' },
];

export const fallbackDistractors = ['then', 'after', 'school', 'home', 'quickly', 'lesson', 'friend', 'today'];
