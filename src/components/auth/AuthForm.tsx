import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, User, Lock, Mail, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { validateEmail, validatePassword, validateText } from "../../utils/validation";
import Turnstile, { TurnstileRef } from "./Turnstile";
import TermsAndConditionsModal from "./TermsAndConditionsModal";

interface AuthFormProps {
  type: "login" | "signup";
  authError: string;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  confirmPassword: string;
  setConfirmPassword: (password: string) => void;
  name: string;
  setName: (name: string) => void;
  handleEmailLogin: (e: React.FormEvent, captchaToken?: string) => Promise<void>;
  handleEmailSignUp: (e: React.FormEvent, captchaToken?: string) => Promise<void>;
  handleGoogleSignIn: () => Promise<void>;
  setUiState: (state: string) => void;
}

const AuthForm: React.FC<AuthFormProps> = ({
  type,
  authError,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  name,
  setName,
  handleEmailLogin,
  handleEmailSignUp,
  handleGoogleSignIn,
  setUiState,
}) => {
  // Local error state
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [signupErrors, setSignupErrors] = useState<{ name?: string; email?: string; password?: string; confirmPassword?: string; form?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>("");
  const turnstileRef = useRef<TurnstileRef>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  // Reset Parent Props on Switch
  useEffect(() => {
    setLoginErrors({});
    setSignupErrors({});
    setIsSubmitting(false);
    setCaptchaToken("");
    setAgreedToTerms(false);

    // Clear parent props
    setEmail("");
    setPassword("");
    setName("");
    setConfirmPassword("");

    // Reset CAPTCHA
    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }
  }, [type]);

  // Real-time Validation Helper with secure validation utilities
  const validateField = (_formType: 'login' | 'signup', field: string, value: string, allValues?: any) => {
    let error = "";

    switch (field) {
      case 'name': {
        const nameValidation = validateText(value, {
          required: true,
          minLength: 2,
          maxLength: 50,
          pattern: /^[a-zA-Z\s'-]+$/,
          patternMessage: "Name can only contain letters, spaces, hyphens, and apostrophes"
        });
        if (!nameValidation.valid) {
          error = nameValidation.error || "";
        }
        break;
      }
      case 'email': {
        const emailValidation = validateEmail(value);
        if (!emailValidation.valid) {
          error = emailValidation.error || "";
        }
        break;
      }
      case 'password': {
        // For login, just check if password exists
        if (_formType === 'login') {
          if (!value) error = "Password is required";
        } else {
          // For signup, enforce strong password requirements
          const passwordValidation = validatePassword(value);
          if (!passwordValidation.valid) {
            error = passwordValidation.error || "";
          }
        }
        break;
      }
      case 'confirmPassword':
        if (!value) error = "Confirm Password is required";
        else if (allValues && value !== allValues.password) error = "Passwords do not match";
        break;
    }
    return error || undefined;
  };

  const handleChange = (field: string, value: string) => {
    // Update Parent State Directly
    if (field === "name") setName(value);
    if (field === "email") setEmail(value);
    if (field === "password") setPassword(value);
    if (field === "confirmPassword") setConfirmPassword(value);

    // Clear error on change
    if (type === "login") {
      if (loginErrors[field as keyof typeof loginErrors]) {
        setLoginErrors(prev => ({ ...prev, [field]: undefined }));
      }
    } else {
      if (signupErrors[field as keyof typeof signupErrors]) {
        setSignupErrors(prev => ({ ...prev, [field]: undefined }));
      }
    }
  };


  const getActiveError = (field: string) => {
    if (type === "login") return loginErrors[field as keyof typeof loginErrors];
    return signupErrors[field as keyof typeof signupErrors];
  }

  const getActiveFormError = () => {
    if (type === "login") return loginErrors.form;
    return signupErrors.form;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (type === "login") {
      const errors: typeof loginErrors = {};
      if (validateField('login', 'email', email)) errors.email = validateField('login', 'email', email);
      if (validateField('login', 'password', password)) errors.password = validateField('login', 'password', password);

      // Validate CAPTCHA
      if (!captchaToken) {
        errors.form = "Please complete the CAPTCHA verification";
      }

      if (Object.keys(errors).length > 0) {
        setLoginErrors(errors);
        return;
      }

      setIsSubmitting(true);
      try {
        await handleEmailLogin(e, captchaToken);
        // Reset CAPTCHA after successful submission
        if (turnstileRef.current) {
          turnstileRef.current.reset();
        }
        setCaptchaToken("");
      } catch (err: any) {
        setLoginErrors(prev => ({ ...prev, form: authError || "Login failed." }));
        // Reset CAPTCHA on error
        if (turnstileRef.current) {
          turnstileRef.current.reset();
        }
        setCaptchaToken("");
      } finally {
        setIsSubmitting(false);
      }

    } else {
      const errors: typeof signupErrors = {};
      if (validateField('signup', 'name', name)) errors.name = validateField('signup', 'name', name);
      if (validateField('signup', 'email', email)) errors.email = validateField('signup', 'email', email);
      if (validateField('signup', 'password', password)) errors.password = validateField('signup', 'password', password);
      // Pass current password for confirm check
      if (validateField('signup', 'confirmPassword', confirmPassword, { password })) errors.confirmPassword = validateField('signup', 'confirmPassword', confirmPassword, { password });

      // Validate CAPTCHA
      if (!captchaToken) {
        errors.form = "Please complete the CAPTCHA verification";
      }

      // Validate Terms
      if (!agreedToTerms) {
        errors.form = errors.form
          ? `${errors.form} and agree to the Terms and Conditions and Privacy Policy`
          : "Please agree to the Terms and Conditions and Privacy Policy";
      }

      if (Object.keys(errors).length > 0) {
        setSignupErrors(errors);
        return;
      }

      setIsSubmitting(true);
      try {
        await handleEmailSignUp(e, captchaToken);
        // Reset CAPTCHA after successful submission
        if (turnstileRef.current) {
          turnstileRef.current.reset();
        }
        setCaptchaToken("");
      } catch (err: any) {
        setSignupErrors(prev => ({ ...prev, form: authError || "Signup failed." }));
        // Reset CAPTCHA on error
        if (turnstileRef.current) {
          turnstileRef.current.reset();
        }
        setCaptchaToken("");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  useEffect(() => {
    if (authError) {
      if (type === "login") setLoginErrors(prev => ({ ...prev, form: authError }));
      else setSignupErrors(prev => ({ ...prev, form: authError }));
      // Reset submitting state when auth error occurs (handles async errors like beta access denial)
      setIsSubmitting(false);
    }
  }, [authError, type]);

  const onHandleGoogleSignIn = async () => {
    if (type === "signup" && !agreedToTerms) {
      const errorMsg = "Please agree to the Terms and Conditions and Privacy Policy before continuing with Google";
      setSignupErrors(prev => ({ ...prev, form: errorMsg }));
      return;
    }
    setIsSubmitting(true);
    try {
      await handleGoogleSignIn();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`flex min-h-screen font-inter bg-gradient-to-br from-[#eef5ff] via-[#f7fbff] to-white p-4 md:p-6 items-center justify-center transition-all duration-500 ease-in-out relative`}>

      {/* Main Container */}
      <div className="w-full max-w-5xl min-h-[600px] bg-white rounded-[32px] shadow-2xl shadow-slate-200/70 border border-slate-100 overflow-hidden relative transition-all duration-500 ease-in-out">

        {/* Welcome Panel (Refined Gradient) - Absolute Overlay */}
        <div
          className={`hidden md:flex absolute top-0 bottom-0 w-[55%] bg-gradient-to-br from-[#0a77dc] via-[#0b66c2] to-[#084b90] items-center justify-center text-white p-12 z-0 ${type === 'signup' ? 'right-0' : 'left-0'}`}
          style={{
            clipPath: type === 'signup'
              ? "polygon(20% 0, 100% 0, 100% 100%, 0% 100%)"
              : "polygon(0 0, 80% 0, 100% 100%, 0% 100%)",
          }}
        >
          <div className={`max-w-md text-center relative z-10 ${type === 'signup' ? 'pl-20' : 'pr-20'}`} >
            {/* Subtle watermark for brand */}
            <img src="/CAFY-Icon.svg" alt="" aria-hidden className="absolute top-6 left-6 w-20 h-20 opacity-10 pointer-events-none" />
            <h2 className="text-4xl font-bold mb-4 font-sans">
              {type === "login" ? "New Here?" : "Welcome Back!"}
            </h2>
            <p className="text-blue-50/95 leading-relaxed mb-6 font-light">
              {type === "login"
                ? "Sign up and discover a great amount of new opportunities!"
                : "To keep connected with us please login with your personal info"}
            </p>
            <button
              onClick={() => setUiState(type === "login" ? "signup" : "login")}
              className="px-10 py-3 border-2 border-white/90 rounded-full font-semibold hover:bg-white hover:text-[#084b90] transition-all tracking-wide shadow-lg shadow-black/10"
            >
              {type === "login" ? "SIGN UP" : "SIGN IN"}
            </button>
          </div>

          {/* Decorative Cloud/Bubble Shapes (kept subtle) */}
          <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-20px] left-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute top-[40%] left-[10%] w-20 h-20 bg-white/15 rounded-full blur-xl" />
        </div>

        {/* Form Panel (Light) */}
        <div className={`w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center relative z-10 transition-all duration-500 ease-in-out left-0 ${type === 'signup' ? 'md:left-0' : 'md:left-1/2'}`}>
          <div className="max-w-sm mx-auto w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-1 font-sans tracking-tight flex items-center gap-3">
              <img src="/CAFY-Icon.svg" alt="Cafy" className="w-8 h-8 object-contain rounded-md shadow-sm" />
              {type === "login" ? "Welcome Back!" : "Join Us!"}
            </h3>
            <h2 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight font-sans">
              {type === "login" ? "Hello Again!" : "Create Account"}
            </h2>
            {type === 'login' && (
              <p className="text-sm text-slate-500 mb-6">Sign in to manage your job applications and saved opportunities.</p>
            )}

            <AnimatePresence>
              {getActiveFormError() && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  {getActiveFormError()}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-4">

              {type === "signup" && (
                <div className="group">
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0a77dc] transition-colors">
                      <User size={20} strokeWidth={1.5} />
                    </div>
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      className={`w-full bg-slate-50 border-2 ${getActiveError('name') ? 'border-red-300 bg-red-50' : 'border-slate-100 focus:border-[#0a77dc] focus:ring-2 focus:ring-[#0a77dc]/20'} text-slate-900 text-sm rounded-full py-3.5 pl-12 pr-5 placeholder-slate-400 transition-all shadow-sm font-medium outline-none`}
                    />
                  </div>
                  {getActiveError('name') && (
                    <p className="text-xs text-red-500 mt-1 ml-4">{getActiveError('name')}</p>
                  )}
                </div>
              )}

              <div className="group">
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0a77dc] transition-colors">
                    <Mail size={20} strokeWidth={1.5} />
                  </div>
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className={`w-full bg-slate-50 border-2 ${getActiveError('email') ? 'border-red-300 bg-red-50' : 'border-slate-100 focus:border-[#0a77dc] focus:ring-2 focus:ring-[#0a77dc]/20'} text-slate-900 text-sm rounded-full py-3.5 pl-12 pr-5 placeholder-slate-400 transition-all shadow-sm font-medium outline-none`}
                  />
                </div>
                {getActiveError('email') && (
                  <p className="text-xs text-red-500 mt-1 ml-4">{getActiveError('email')}</p>
                )}
              </div>

              <div className="group">
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0a77dc] transition-colors">
                    <Lock size={20} strokeWidth={1.5} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    className={`w-full bg-slate-50 border-2 ${getActiveError('password') ? 'border-red-300 bg-red-50' : 'border-slate-100 focus:border-[#0a77dc] focus:ring-2 focus:ring-[#0a77dc]/20'} text-slate-900 text-sm rounded-full py-3.5 pl-12 pr-12 placeholder-slate-400 transition-all shadow-sm font-medium outline-none`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0a77dc] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                  </button>
                </div>
                {getActiveError('password') && (
                  <p className="text-xs text-red-500 mt-1 ml-4">{getActiveError('password')}</p>
                )}
              </div>

              {type === "signup" && (
                <div className="group">
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0a77dc] transition-colors">
                      <Lock size={20} strokeWidth={1.5} />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => handleChange("confirmPassword", e.target.value)}
                      className={`w-full bg-slate-50 border-2 ${getActiveError('confirmPassword') ? 'border-red-300 bg-red-50' : 'border-slate-100 focus:border-[#0a77dc] focus:ring-2 focus:ring-[#0a77dc]/20'} text-slate-900 text-sm rounded-full py-3.5 pl-12 pr-12 placeholder-slate-400 transition-all shadow-sm font-medium outline-none`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0a77dc] transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                    </button>
                  </div>
                  {getActiveError('confirmPassword') && (
                    <p className="text-xs text-red-500 mt-1 ml-4">{getActiveError('confirmPassword')}</p>
                  )}
                </div>
              )}

              {type === "login" && (
                <div className="flex justify-end mb-4">
                  <button type="button" onClick={() => setUiState("forgot-password")} className="text-xs text-slate-500 font-semibold hover:text-[#0a77dc] hover:underline">
                    Forgot Password?
                  </button>
                </div>
              )}

              {/* Cloudflare Turnstile CAPTCHA */}
              <Turnstile
                ref={turnstileRef}
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                onSuccess={(token) => setCaptchaToken(token)}
                onError={() => {
                  setCaptchaToken("");
                  const errorMsg = "CAPTCHA verification failed. Please try again.";
                  if (type === "login") {
                    setLoginErrors(prev => ({ ...prev, form: errorMsg }));
                  } else {
                    setSignupErrors(prev => ({ ...prev, form: errorMsg }));
                  }
                }}
                onExpire={() => {
                  setCaptchaToken("");
                  const errorMsg = "CAPTCHA expired. Please verify again.";
                  if (type === "login") {
                    setLoginErrors(prev => ({ ...prev, form: errorMsg }));
                  } else {
                    setSignupErrors(prev => ({ ...prev, form: errorMsg }));
                  }
                }}
                theme="light"
                size="normal"
              />

              {type === "signup" && (
                <div className="flex items-center gap-3 px-4 py-2">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${agreedToTerms ? 'bg-[#0a77dc] border-[#0a77dc]' : 'border-slate-300 hover:border-[#0a77dc]/60'}`}
                    onClick={() => {
                      if (agreedToTerms) {
                        setAgreedToTerms(false);
                      } else {
                        setIsTermsModalOpen(true);
                      }
                    }}
                  >
                    {agreedToTerms && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    I agree to the{" "}
                    <button type="button" onClick={() => setIsTermsModalOpen(true)} className="text-[#0a77dc] font-bold hover:underline">
                      Terms and Conditions
                    </button>{" "}
                    and{" "}
                    <Link to="/privacy-policy" className="text-[#0a77dc] font-bold hover:underline">
                      Privacy Policy
                    </Link>
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-4 text-white font-bold rounded-full transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm tracking-wide disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#0a77dc]/30 bg-gradient-to-r from-[#0a77dc] via-[#0b66c2] to-[#084b90] hover:from-[#0b66c2] hover:via-[#095fb6] hover:to-[#073e77] shadow-md shadow-[#0a77dc]/25`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {type === "login" ? "SIGNING IN..." : "SIGNING UP..."}
                  </>
                ) : (
                  type === "login" ? "SIGN IN" : "SIGN UP"
                )}
              </button>
            </form>

            <div className="relative flex py-4 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-xs font-medium uppercase tracking-wider">Or Continue With</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              onClick={onHandleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full py-3.5 border border-slate-200 hover:bg-[#f3f8ff] text-slate-700 font-semibold rounded-full transform active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-sm shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin text-slate-500" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {isSubmitting ? "Signing in…" : "Google"}
            </button>

            {type === "login" && (
              <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
                By clicking Google, you agree to our{" "}
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(true)}
                  className="font-semibold text-[#0a77dc] hover:underline"
                >
                  Terms and Conditions
                </button>{" "}
                and{" "}
                <Link to="/privacy-policy" className="font-semibold text-[#0a77dc] hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            )}

            {/* Mobile Toggle Text */}
            <div className="mt-8 text-center">
              <p className="text-slate-600 text-sm font-medium">
                {type === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  onClick={() => setUiState(type === "login" ? "signup" : "login")}
                  className="text-[#0a77dc] font-semibold hover:underline"
                >
                  {type === "login" ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </div>
            <div className="mt-4 text-center">
              <Link
                to="/"
                className="text-sm font-medium text-slate-500 hover:text-slate-800 hover:underline"
              >
                ← Explore Cafy
              </Link>
            </div>

          </div>
        </div>

        <TermsAndConditionsModal
          isOpen={isTermsModalOpen}
          onClose={() => setIsTermsModalOpen(false)}
          onAccept={
            type === "signup"
              ? () => {
                  setAgreedToTerms(true);
                  setIsTermsModalOpen(false);
                  const termsErrorPattern = /Terms and Conditions|Privacy Policy/;
                  setSignupErrors(prev => ({
                    ...prev,
                    form: prev.form && termsErrorPattern.test(prev.form) ? undefined : prev.form,
                  }));
                }
              : undefined
          }
        />
      </div>
    </div >
  );
};

export default AuthForm;
