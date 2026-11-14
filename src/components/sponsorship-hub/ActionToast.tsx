import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

interface ActionToastProps {
    message: string | null;
}

const ActionToast: React.FC<ActionToastProps> = ({ message }) => (
    <AnimatePresence>
        {message && (
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium shadow-lg"
                role="status"
                aria-live="polite"
            >
                <CheckCircle2 size={16} className="text-blue-300 shrink-0" />
                {message}
            </motion.div>
        )}
    </AnimatePresence>
);

export default ActionToast;
