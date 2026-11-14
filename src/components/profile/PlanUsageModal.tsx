import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import BillingPlanCard from './BillingPlanCard';
import { useBilling } from '../../hooks/useBilling';

interface PlanUsageModalProps {
  open: boolean;
  onClose: () => void;
}

function getModalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById('modal-root') ?? document.body;
}

const PlanUsageModal: React.FC<PlanUsageModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useBilling();
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(getModalRoot());
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh({ syncStripe: true, force: true });
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleViewPlans = () => {
    onClose();
    navigate('/subscription', { state: { from: location.pathname } });
  };

  if (!root || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-usage-modal-title"
    >
      <div className="absolute inset-0 bg-slate-900/50" aria-hidden onClick={onClose} />
      <div
        className="relative z-10 w-full sm:max-w-5xl max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 id="plan-usage-modal-title" className="text-base font-bold text-slate-900 truncate">
            Plan & usage
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 sm:px-6 py-5">
          <BillingPlanCard embedded onViewPlans={handleViewPlans} />
        </div>
      </div>
    </div>,
    root
  );
};

export default PlanUsageModal;
