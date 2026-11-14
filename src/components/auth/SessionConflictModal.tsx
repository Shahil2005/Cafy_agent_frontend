import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ArrowRight, Loader2, X } from 'lucide-react';
import { useSession } from '../../context/SessionContext';

export const SessionConflictModal: React.FC = () => {
    const {
        handleForceSwitch,
        handleCancelSwitch,
        sessionStatus,
        conflictDeviceName,
        isSwitchingDevice,
    } = useSession();

    const isConflict = sessionStatus === 'conflict';

    if (!isConflict) return null;

    return (
        <AnimatePresence>
            {isConflict && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="session-conflict-title"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 overflow-hidden relative border border-slate-200"
                    >
                        <div className="absolute top-0 left-0 w-full h-2 bg-orange-500" />

                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <AlertCircle className="w-6 h-6 text-orange-600" aria-hidden />
                            </div>
                            <div>
                                <h2 id="session-conflict-title" className="text-xl font-bold text-slate-800">
                                    Switch Device?
                                </h2>
                                <p className="text-slate-500 text-sm mt-1">
                                    You are already logged in on{' '}
                                    <span className="font-medium text-slate-700">
                                        {conflictDeviceName ?? 'another device'}
                                    </span>
                                    .
                                </p>
                            </div>
                        </div>

                        <p className="text-slate-600 text-sm mb-8 leading-relaxed">
                            To use Cafy here, the other session will be signed out. Do you want to continue on this
                            device?
                        </p>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleCancelSwitch}
                                disabled={isSwitchingDevice}
                                className="flex-1 py-3 px-4 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <X size={18} />
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleForceSwitch}
                                disabled={isSwitchingDevice}
                                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSwitchingDevice ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Switching…
                                    </>
                                ) : (
                                    <>
                                        Switch Device
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
