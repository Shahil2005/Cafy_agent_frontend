import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useBilling } from '../../hooks/useBilling';
import { getActivePlanId } from '../../utils/planCardUi';
import MilestoneCrackers from './MilestoneCrackers';
import {
  CAFY15_PROMO_CODE,
  consumeMilestoneCrackerPlay,
  getOfferCountdown,
  padOfferUnit,
  type OfferCountdown,
} from '../../data/cafy15Celebration';

function useLiveOfferCountdown(): OfferCountdown | null {
  const [countdown, setCountdown] = useState<OfferCountdown | null>(() =>
    getOfferCountdown(),
  );

  useEffect(() => {
    const tick = () => setCountdown(getOfferCountdown());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return countdown;
}

function Countdown({ countdown }: { countdown: OfferCountdown }) {
  const parts = [
    { value: countdown.days, label: 'days' },
    { value: countdown.hours, label: 'hrs' },
    { value: countdown.minutes, label: 'min' },
    { value: countdown.seconds, label: 'sec' },
  ];

  return (
    <div className="flex items-center gap-1.5" aria-live="polite">
      {parts.map((part) => (
        <div
          key={part.label}
          className="min-w-[3.1rem] rounded-xl bg-[#f6f1e4] px-2 py-1.5 text-center shadow-sm"
        >
          <p className="text-base font-bold tabular-nums leading-none text-[#142f6b]">
            {padOfferUnit(part.value)}
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-amber-800/80">
            {part.label}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function Cafy15CelebrationBanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { billing } = useBilling();
  const countdown = useLiveOfferCountdown();
  const [showCrackers, setShowCrackers] = useState(false);
  const hideCrackers = useCallback(() => setShowCrackers(false), []);
  const offerLive = countdown !== null;
  const planId = getActivePlanId(billing);
  const showClaim =
    Boolean(billing) &&
    (planId === 'free' || planId === 'weekly' || planId === 'jobs_monthly');

  useEffect(() => {
    if (!offerLive) return;
    const uid = user?.uid;
    if (!uid) return;
    if (consumeMilestoneCrackerPlay(uid)) {
      setShowCrackers(true);
    }
  }, [user?.uid, offerLive]);

  if (!countdown) return null;

  const handleClaim = () => {
    navigate(`/subscription?promo=${CAFY15_PROMO_CODE}`);
  };

  return (
    <>
      {showCrackers ? <MilestoneCrackers onDone={hideCrackers} /> : null}
      <section
        className="relative overflow-hidden rounded-2xl bg-[#142f6b] text-white shadow-[0_16px_40px_-16px_rgba(20,47,107,0.65)]"
        aria-label="Cafy 10,000 users Premium offer"
      >
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-amber-300/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-10 h-44 w-44 rounded-full bg-[#f6f1e4]/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-amber-300 via-amber-400 to-[#f6f1e4]"
          aria-hidden
        />

        <div className="relative flex flex-col gap-5 px-5 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0 text-3xl font-black tracking-tight text-amber-300 sm:text-4xl">
                <span>10,000</span>
                <span className="text-2xl font-bold text-[#f6f1e4] sm:text-3xl">users</span>
              </h2>
              <span className="inline-flex items-center rounded-md border border-dashed border-amber-200/90 bg-amber-300/15 px-2 py-0.5 font-mono text-xs font-bold tracking-[0.16em] text-amber-200">
                {CAFY15_PROMO_CODE}
              </span>
            </div>
            <p className="mt-1.5 text-lg font-semibold tracking-tight text-white">
              One big celebration
            </p>
            {showClaim || !billing ? (
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-blue-100/90">
                Go Premium for{' '}
                <span className="font-bold text-amber-200">£15/month</span> or{' '}
                <span className="font-bold text-amber-200">£40/3 months</span> with{' '}
                <span className="font-bold text-amber-200">{CAFY15_PROMO_CODE}</span>.
                Claim it before 30 Sep.
              </p>
            ) : (
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-blue-100/90">
                Thanks for being part of this milestone.
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200/90">
                Offer ends in
              </p>
              <Countdown countdown={countdown} />
            </div>
            {showClaim ? (
              <button
                type="button"
                onClick={handleClaim}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f6f1e4] px-4 py-2.5 text-sm font-bold text-[#142f6b] shadow-sm hover:bg-amber-200"
              >
                Claim offer
                <ArrowRight size={16} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
