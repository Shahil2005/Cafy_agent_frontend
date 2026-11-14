import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRestoredBanner, setShowRestoredBanner] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      setShowRestoredBanner(false);
    };

    const handleOnline = () => {
      setIsOnline(true);
      setShowRestoredBanner(true);
      setTimeout(() => setShowRestoredBanner(false), 3000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <>
      {/* Blocking overlay — shown when offline, prevents all clicks */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998] bg-slate-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-8 max-w-sm w-full text-center"
            >
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <WifiOff size={24} className="text-slate-500" strokeWidth={1.8} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">You're offline</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Please check your internet connection. Cafy requires an active connection to load your data.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restored banner — shown briefly when connection comes back */}
      <AnimatePresence>
        {showRestoredBanner && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-medium text-white bg-emerald-500 shadow-lg"
          >
            <Wifi size={15} strokeWidth={2.2} />
            <span>Connection restored</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
