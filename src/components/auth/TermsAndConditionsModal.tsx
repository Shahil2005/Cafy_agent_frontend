import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ScrollText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  TERMS_OF_SERVICE_EFFECTIVE_FROM,
  TERMS_OF_SERVICE_LAST_UPDATED,
  termsOfServiceBodyContent,
} from '../../constants/termsOfServiceContent';

interface TermsAndConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

const TermsAndConditionsModal: React.FC<TermsAndConditionsModalProps> = ({ isOpen, onClose, onAccept }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-[#0a77dc]">
                  <ScrollText size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Terms of Service</h2>
                  <p className="text-sm text-slate-500">
                    Last updated {TERMS_OF_SERVICE_LAST_UPDATED} · Effective {TERMS_OF_SERVICE_EFFECTIVE_FROM}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto flex-1 font-inter text-slate-600 leading-relaxed custom-scrollbar">
              <div className="max-w-none text-sm md:text-[0.95rem]">
                <ReactMarkdown
                  components={{
                    h2: ({ children, ...props }) => (
                      <h2
                        className="text-base md:text-lg mt-8 mb-3 font-bold text-slate-900 first:mt-0 pb-2 border-b border-slate-100"
                        {...props}
                      >
                        {children}
                      </h2>
                    ),
                    p: ({ children, ...props }) => (
                      <p className="mb-3" {...props}>
                        {children}
                      </p>
                    ),
                    ul: ({ children, ...props }) => (
                      <ul className="mb-4 mt-1 space-y-1 list-disc pl-5" {...props}>
                        {children}
                      </ul>
                    ),
                    li: ({ children, ...props }) => (
                      <li className="pl-0.5 marker:text-slate-400" {...props}>
                        {children}
                      </li>
                    ),
                    a: ({ href, children, ...props }) => {
                      if (href?.startsWith('/')) {
                        return (
                          <Link
                            to={href}
                            className="text-[#0a77dc] font-semibold hover:underline"
                            onClick={onClose}
                          >
                            {children}
                          </Link>
                        );
                      }
                      return (
                        <a
                          href={href}
                          className="text-[#0a77dc] font-semibold hover:underline"
                          target={href?.startsWith('http') ? '_blank' : undefined}
                          rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                          {...props}
                        >
                          {children}
                        </a>
                      );
                    },
                    strong: ({ children, ...props }) => (
                      <strong className="font-semibold text-slate-900" {...props}>
                        {children}
                      </strong>
                    ),
                  }}
                >
                  {termsOfServiceBodyContent}
                </ReactMarkdown>
              </div>

              {onAccept && (
                <div className="pt-8 mt-8 border-t border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 text-center md:text-left">
                    I have read and agree to all the Terms of Service listed above.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 md:p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-start gap-3 shrink-0">
              {onAccept && (
                <button
                  type="button"
                  onClick={onAccept}
                  className="flex-1 md:flex-none px-8 py-3 bg-[#0a77dc] hover:bg-[#084b90] text-white font-semibold rounded-full shadow-lg shadow-blue-200/60 transition-all active:scale-95"
                >
                  I Accept
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 md:flex-none px-8 py-3 text-slate-600 font-semibold hover:bg-slate-100 rounded-full transition-colors"
              >
                {onAccept ? 'Cancel' : 'Close'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TermsAndConditionsModal;
