import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export const PaymentConfirmingOverlay: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-[3px] p-6"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div className="bg-white rounded-2xl shadow-2xl px-8 py-10 max-w-md w-full flex flex-col items-center text-center">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
      <h1 className="text-xl font-bold text-slate-900">Confirming your session…</h1>
      <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-sm">
        We are confirming your payment with Stripe. This usually takes a few seconds. Please keep
        this page open.
      </p>
    </div>
  </motion.div>
);
