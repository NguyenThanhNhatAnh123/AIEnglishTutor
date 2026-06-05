import Lottie from 'lottie-react';
import { motion as Motion } from 'motion/react';
import Button from '../../../components/common/Button';
import questCompleteAnimation from '../../../assets/learning/lottie/quest-complete.json';

function LottieMoment({ animationData, label, className = '' }) {
  return (
    <div className={`mx-auto h-28 w-28 ${className}`}>
      <Lottie animationData={animationData} loop aria-label={label} />
    </div>
  );
}

export default function RewardSummary({ visible, reviewed, combo, lastRatings, onClose, onContinue }) {
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
