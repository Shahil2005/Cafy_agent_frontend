import React, { useState, useRef } from "react";
import { Mail, ChevronLeft, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Turnstile, { TurnstileRef } from "./Turnstile";

interface ForgotPasswordFormProps {
  authError: string;
  handleForgotPassword: (email: string, captchaToken?: string) => Promise<void>;
  setUiState: (state: string) => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  authError,
  handleForgotPassword,
  setUiState,
}) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string>("");
  const turnstileRef = useRef<TurnstileRef>(null);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (fieldError) setFieldError("");
    if (formError) setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFieldError("");

    let hasError = false;
    if (!email.trim()) {
      setFieldError("Email is required");
      hasError = true;
    } else if (!isValidEmail(email)) {
      setFieldError("Please enter a valid email address");
      hasError = true;
    }

    // Validate CAPTCHA
    if (!captchaToken) {
      setFormError("Please complete the CAPTCHA verification");
      hasError = true;
    }

    if (hasError) return;

    setIsLoading(true);
    try {
      await handleForgotPassword(email, captchaToken);
      // Reset CAPTCHA after successful submission
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
      setCaptchaToken("");
    } catch (error) {
      // Reset CAPTCHA on error
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
      setCaptchaToken("");
    } finally {
      setIsLoading(false);
    }
  };

  const isSuccess = authError.includes("sent") || authError.includes("Check");

  return (
    <div className="flex min-h-screen font-inter bg-slate-50 p-6 items-center justify-center transition-all duration-500 ease-in-out relative">
      {/* Main Container */}
      <div className="w-full max-w-5xl min-h-[600px] bg-white border border-slate-100 rounded-[40px] shadow-2xl shadow-slate-200 overflow-hidden relative transition-all duration-500 ease-in-out flex flex-col md:flex-row">

        {/* Info Panel - Aligned with AuthForm layout (Refined Gradient) */}
        <div className="hidden md:flex absolute top-0 bottom-0 left-0 w-[55%] bg-gradient-to-br from-slate-800 to-indigo-600 items-center justify-center text-white p-12 z-0"
          style={{ clipPath: "polygon(0 0, 80% 0, 100% 100%, 0% 100%)" }}
        >
          <div className="max-w-md relative z-10 pr-20 text-center">
            <img src="/CAFY-Icon.svg" alt="" aria-hidden className="absolute top-6 left-6 w-20 h-20 opacity-10 pointer-events-none" />
            <h2 className="text-4xl font-bold mb-4 font-sans text-white">
              Forgot Password?
            </h2>
            <p className="text-slate-100 leading-relaxed mb-6 font-light">
              Don't worry, it happens to the best of us. Just enter your email and we'll get you back on track in no time.
            </p>

            <div className="space-y-3">
              {[
                { step: 1, text: "Enter your registered email" },
                { step: 2, text: "Check inbox for reset steps" },
                { step: 3, text: "Create new password" }
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-4 bg-white/8 p-4 rounded-full backdrop-blur-md border border-white/10 shadow-sm group transition-all">
                  <div className="w-8 h-8 rounded-full bg-white text-slate-800 flex items-center justify-center font-bold text-sm">
                    {item.step}
                  </div>
                  <p className="text-sm text-white font-medium">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Decorative Bubbles matching AuthForm (subtle) */}
          <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-white/6 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-20px] left-[-20px] w-32 h-32 bg-white/6 rounded-full blur-2xl"></div>
        </div>

        {/* Form Panel */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center relative z-10 ml-auto bg-white">
          <div className="max-w-sm mx-auto w-full">
            <div className="flex justify-center mb-6">
              <img src="/CAFY-Icon.svg" alt="Cafy" className="w-16 h-16 object-contain rounded-md shadow-sm" />
            </div>
            <button
              onClick={() => setUiState('login')}
              className="mb-6 flex items-center text-slate-500 hover:text-slate-900 transition-all gap-2 text-sm font-semibold group"
            >
              <div className="p-1.5 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors">
                <ChevronLeft size={16} />
              </div>
              Back to Login
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1 font-sans tracking-tight">
              Secure Reset
            </h3>
            <h2 className="text-4xl font-bold text-slate-900 mb-8 tracking-tight font-sans">
              Reset Password
            </h2>

            <AnimatePresence>
              {(formError || authError) && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className={`mb-6 p-3 text-xs rounded-xl flex items-center gap-2 border ${isSuccess
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-600 border-red-200'
                    }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isSuccess ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                  {formError || authError}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="group">
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                    <Mail size={20} strokeWidth={1.5} />
                  </div>
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    disabled={isLoading}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className={`w-full bg-slate-50 border-2 ${fieldError ? 'border-red-300 bg-red-50' : 'border-slate-100 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20'} text-slate-900 text-sm rounded-full py-3.5 pl-12 pr-5 placeholder-slate-400 transition-all shadow-sm font-medium outline-none`}
                  />
                </div>
                {fieldError && (
                  <p className="text-xs text-red-500 mt-1 ml-4">{fieldError}</p>
                )}
              </div>

              {/* Cloudflare Turnstile CAPTCHA */}
              <Turnstile
                ref={turnstileRef}
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                onSuccess={(token) => setCaptchaToken(token)}
                onError={() => {
                  setCaptchaToken("");
                  setFormError("CAPTCHA verification failed. Please try again.");
                }}
                onExpire={() => {
                  setCaptchaToken("");
                  setFormError("CAPTCHA expired. Please verify again.");
                }}
                theme="light"
                size="normal"
              />

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 text-white font-bold rounded-full transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm tracking-wide disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-600/30 bg-gradient-to-r from-indigo-600 to-slate-800 hover:from-indigo-700 hover:to-slate-900 shadow-md shadow-slate-900/10"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    SENDING LINK...
                  </>
                ) : (
                  "SEND RESET LINK"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordForm;
