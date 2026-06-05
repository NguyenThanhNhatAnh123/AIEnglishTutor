import Lottie from 'lottie-react';
import Button from '../../../components/common/Button';
import emptyQueueAnimation from '../../../assets/learning/lottie/empty-queue.json';
import questLoadingAnimation from '../../../assets/learning/lottie/quest-loading.json';

function LottieMoment({ animationData, label, className = '' }) {
  return (
    <div className={`mx-auto h-28 w-28 ${className}`}>
      <Lottie animationData={animationData} loop aria-label={label} />
    </div>
  );
}

export default function EmptyReview({ selectedDeck, dueLoading, onLoadDue }) {
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
