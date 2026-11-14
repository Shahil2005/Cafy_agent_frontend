import React, { useState, useEffect } from "react";
import { Mail, RotateCw, LogOut, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "../../services/firebase";

interface VerificationPendingProps {
  email: string;
  handleResendVerification: () => Promise<void>;
  handleSignOut: () => Promise<void>;
  isSigningOut?: boolean;
  authError: string;
}

const VerificationPending: React.FC<VerificationPendingProps> = ({
  email,
  handleResendVerification,
  handleSignOut,
  isSigningOut = false,
  authError,
}) => {
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [resendCount, setResendCount] = useState(0);

  const isSuccessMessage = authError.includes("sent");
  const MAX_RESEND_ATTEMPTS = 5;

  const calculateCooldown = () => {
    const lastSent = localStorage.getItem('last_verification_sent');
    if (lastSent) {
      const elapsed = Date.now() - parseInt(lastSent);
      const remaining = Math.max(0, 60 - Math.floor(elapsed / 1000));
      return remaining;
    }
    return 0;
  };

  useEffect(() => {
    const remaining = calculateCooldown();
    setCooldown(remaining);

    if (remaining > 0) {
      const timer = setInterval(() => {
        const nextRemaining = calculateCooldown();
        setCooldown(nextRemaining);
        if (nextRemaining <= 0) clearInterval(timer);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [authError]); // Re-check on authError updates (which happen when resending)

  useEffect(() => {
    if (isSuccessMessage) {
      setShowSuccessAnimation(true);
      const timer = setTimeout(() => setShowSuccessAnimation(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [authError, isSuccessMessage]);

  const checkVerificationStatus = async (manualCheck = false) => {
    if (manualCheck) setIsChecking(true);
    const currentUser = auth.currentUser;
    if (currentUser && !currentUser.emailVerified) {
      try {
        await currentUser.reload();
        if (auth.currentUser?.emailVerified) {
           window.location.href = "/onboarding"; // Force redirect now that verification is confirmed
        }
      } catch (error) {
         console.error("Polling error", error);
      }
    }
    if (manualCheck) {
      // Small timeout to give button UI a feel of activity
      setTimeout(() => setIsChecking(false), 1000);
    }
  };

  useEffect(() => {
    // Auto-poll verification status every 5 seconds
    const pollInterval = setInterval(() => {
      checkVerificationStatus(false);
    }, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    await handleResendVerification();
    setIsResending(false);
    // Cooldown is updated via useEffect monitoring localStorage changes (set in useAuth)
    setResendCount(resendCount + 1);
  };

  return (
    <div className="flex min-h-screen font-inter bg-slate-50 p-6 items-center justify-center transition-all duration-500 ease-in-out relative">
      {/* Main Container */}
      <div className="w-full max-w-5xl min-h-[600px] bg-white rounded-[40px] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden relative transition-all duration-500 ease-in-out">

        {/* Info Panel - Blue Cloud Theme */}
        <div className="hidden md:flex absolute top-0 bottom-0 left-0 w-[55%] bg-blue-600 items-center justify-center text-white p-12 z-0"
          style={{ clipPath: "polygon(0 0, 80% 0, 100% 100%, 0% 100%)" }}
        >
          <div className="max-w-md relative z-10 pr-20 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full backdrop-blur-md mb-6 border border-white/30">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-200 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-50">Activation Required</span>
            </div>
            <h2 className="text-4xl font-bold mb-4 font-sans">
              Almost There!
            </h2>
            <p className="text-blue-100 leading-relaxed mb-8 font-light">
              We've sent a verification link to your email address. Please check your inbox to activate your account and start your journey with Cafy.
            </p>

            <div className="space-y-3 text-left">
              {[
                "Locate the email from Cafy",
                "Click the verification link",
                "Start tracking your dream jobs"
              ].map((step, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/10">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </div>
                  <span className="text-sm font-medium">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Decorative Cloud/Bubble Shapes */}
          <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-white/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-20px] left-[-20px] w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
          <div className="absolute top-[40%] left-[10%] w-20 h-20 bg-white/10 rounded-full animate-pulse blur-xl"></div>
        </div>

        {/* Content Panel */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center relative z-10 ml-auto bg-white min-h-[600px]">
          <div className="max-w-sm mx-auto w-full">
            <div className="flex items-center justify-center gap-2 mb-6">
              <img src="/CAFY-Icon.svg" alt="Cafy" className="w-8 h-8 object-contain" />
              <span className="text-base font-bold text-slate-900 tracking-tight">Cafy</span>
            </div>

            <div className="flex justify-center mb-8 relative">
              <div className={`w-24 h-24 bg-slate-50 rounded-full border-2 border-slate-100 flex items-center justify-center transition-all duration-500 shadow-inner ${showSuccessAnimation ? 'bg-emerald-50 border-emerald-100' : ''}`}>
                <Mail size={40} className={`transition-colors duration-500 ${showSuccessAnimation ? 'text-emerald-500' : 'text-slate-400'}`} strokeWidth={1.5} />
              </div>
              {showSuccessAnimation && (
                <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} className="absolute -right-1 -top-1 bg-emerald-500 text-white rounded-full p-1.5 shadow-lg shadow-emerald-200">
                  <CheckCircle2 size={16} />
                </motion.div>
              )}
            </div>

            <h2 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight text-center font-sans">
              Check Your Email
            </h2>
            <p className="text-slate-600 mb-8 text-sm text-center font-medium">
              We've sent a secure link to <span className="font-semibold text-slate-800">{email}</span>
            </p>

            <AnimatePresence>
              {(authError) && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className={`mb-8 p-4 text-xs rounded-2xl flex items-start gap-3 border shadow-sm ${isSuccessMessage
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-red-50 text-red-700 border-red-100'
                    }`}>
                  <div className={`mt-0.5 w-1.5 h-1.5 shrink-0 rounded-full ${isSuccessMessage ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold uppercase tracking-wider text-[10px] opacity-70">
                      {isSuccessMessage ? 'Success' : 'Verification Update'}
                    </span>
                    <span className="font-medium">{authError}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              <div className="relative group">
                <button
                  onClick={handleResend}
                  disabled={cooldown > 0 || isResending || resendCount >= MAX_RESEND_ATTEMPTS}
                  className="relative w-full py-4 bg-slate-900 text-white font-bold rounded-full shadow-xl shadow-slate-200 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm tracking-wide disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none hover:bg-slate-800 overflow-hidden"
                >
                  <AnimatePresence mode="wait">
                    {cooldown > 0 ? (
                      <motion.div
                        key="cooldown"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex items-center gap-2"
                      >
                        <RotateCw size={16} className="animate-spin" />
                        <span>Resend available in {cooldown}s</span>
                      </motion.div>
                    ) : isResending ? (
                      <motion.div
                        key="sending"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2"
                      >
                        <LoaderIcon className="animate-spin w-4 h-4" />
                        <span>Sending Link...</span>
                      </motion.div>
                    ) : resendCount >= MAX_RESEND_ATTEMPTS ? (
                      <span key="limit">Daily Limit Reached</span>
                    ) : (
                      <motion.div
                        key="ready"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2"
                      >
                        <RotateCw size={16} />
                        <span>Resend Email</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Progress bar background for cooldown */}
                  {cooldown > 0 && (
                    <motion.div
                      initial={{ width: "100%" }}
                      animate={{ width: "0%" }}
                      transition={{ duration: cooldown, ease: "linear" }}
                      className="absolute bottom-0 left-0 h-1 bg-blue-500/20"
                    />
                  )}
                </button>
              </div>

              <button
                onClick={() => checkVerificationStatus(true)}
                disabled={isChecking}
                className="w-full py-4 bg-emerald-500 text-white font-bold rounded-full shadow-lg shadow-emerald-200 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm tracking-wide disabled:opacity-70 disabled:cursor-not-allowed hover:bg-emerald-600"
              >
                {isChecking ? (
                  <LoaderIcon className="animate-spin w-4 h-4" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                {isChecking ? "Checking Status..." : "I've Verified My Email"}
              </button>

              <button
                onClick={() => void handleSignOut()}
                disabled={isSigningOut}
                className="w-full py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-full hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm tracking-wide disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSigningOut ? (
                  <LoaderIcon className="animate-spin w-4 h-4" />
                ) : (
                  <LogOut size={18} />
                )}
                {isSigningOut ? "Signing out…" : "Sign Out"}
              </button>
            </div>

            <div className="mt-10 text-center">
              <p className="text-xs text-slate-400 font-medium mb-2">Didn't receive the email?</p>
              <button
                onClick={() => alert('Support feature coming soon!')}
                className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors border-b-2 border-blue-600/10 hover:border-blue-600"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoaderIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default VerificationPending;
