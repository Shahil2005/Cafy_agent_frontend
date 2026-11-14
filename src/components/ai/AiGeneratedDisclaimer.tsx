import React from 'react';
import { Info } from 'lucide-react';
import { getAiDisclaimerMessage, type AiDisclaimerContext, type AiDisclaimerVariant } from '../../constants/aiDisclaimer';

type AiGeneratedDisclaimerProps = {
  variant?: AiDisclaimerVariant;
  /** @deprecated Same message is shown for all contexts. */
  context?: AiDisclaimerContext;
  className?: string;
};

const AiGeneratedDisclaimer: React.FC<AiGeneratedDisclaimerProps> = ({
  variant = 'banner',
  className = '',
}) => {
  const message = getAiDisclaimerMessage();

  if (variant === 'compact') {
    return (
      <p
        className={`flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500 ${className}`}
        role="note"
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        <span>{message}</span>
      </p>
    );
  }

  if (variant === 'full') {
    return (
      <div
        className={`flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 ${className}`}
        role="note"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <p className="text-xs leading-relaxed text-slate-600">{message}</p>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border border-amber-100 bg-amber-50/80 px-4 py-3 ${className}`}
      role="note"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <p className="text-xs leading-relaxed text-amber-800/90">{message}</p>
    </div>
  );
};

export default AiGeneratedDisclaimer;
