import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import TrackerExtensionGuide from './TrackerExtensionGuide';

interface TrackerExtensionModalProps {
  onClose: () => void;
  onAddJobClick?: () => void;
}

const TrackerExtensionModal: React.FC<TrackerExtensionModalProps> = ({ onClose, onAddJobClick }) => {
  const handleAddJob = () => {
    onClose();
    onAddJobClick?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Cafy Chrome extension</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-6 text-center">
          <TrackerExtensionGuide variant="modal" onAddJobClick={handleAddJob} />
        </div>
      </motion.div>
    </div>
  );
};

export default TrackerExtensionModal;
