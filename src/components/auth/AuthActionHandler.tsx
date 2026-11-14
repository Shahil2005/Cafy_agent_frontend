import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../../services/firebase";
import { validatePassword } from "../../utils/validation";
import { Loader2, CheckCircle2, XCircle, Lock, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const AuthActionHandler: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const mode = searchParams.get("mode");
    const oobCode = searchParams.get("oobCode");

    const [status, setStatus] = useState<"loading" | "success" | "error" | "input">("loading");
    const [message, setMessage] = useState("Verifying your request...");

    // Password Reset State
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handledRef = React.useRef(false);

    useEffect(() => {
        if (!mode || !oobCode) {
            setStatus("error");
            setMessage("Invalid link. The link may be malformed or missing required parameters.");
            return;
        }

        if (handledRef.current) return;
        handledRef.current = true;

        const handleAction = async () => {
            try {
                if (mode === "verifyEmail") {
                    await applyActionCode(auth, oobCode);
                    setStatus("success");
                    setMessage("Your email has been successfully verified! You can now log in.");
                } else if (mode === "resetPassword") {
                    // First, verify the code is valid before letting them type a password
                    const email = await verifyPasswordResetCode(auth, oobCode);
                    setStatus("input");
                    setMessage(`Reset password for ${email}`);
                } else {
                    setStatus("error");
                    setMessage("Invalid request mode.");
                }
            } catch (error: any) {
                setStatus("error");
                if (error.code === "auth/invalid-action-code") {
                    setMessage("This link is invalid. It may have already been used.");
                } else if (error.code === "auth/expired-action-code") {
                    setMessage("This link has expired. Please request a new one.");
                } else {
                    setMessage(error.message || "An error occurred while processing your request.");
                }
            }
        };

        handleAction();
    }, [mode, oobCode]);

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();

        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            setStatus("error");
            setMessage(passwordValidation.error || "Password does not meet requirements.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setStatus("error");
            setMessage("Passwords do not match.");
            return;
        }

        if (!oobCode) return;

        setIsSubmitting(true);
        setStatus("loading");
        setMessage("Updating your password...");

        try {
            await confirmPasswordReset(auth, oobCode, newPassword);
            setStatus("success");
            setMessage("Your password has been successfully reset! You can now log in.");
        } catch (error: any) {
            setStatus("error");
            setMessage(error.message || "Failed to reset password. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen font-inter bg-slate-50 p-6 items-center justify-center transition-all duration-500 ease-in-out relative">
            <div className="w-full max-w-lg bg-white border border-slate-100 rounded-[40px] shadow-2xl shadow-slate-200 overflow-hidden relative p-8 md:p-12 text-center">

                <div className="flex justify-center mb-6">
                    <img src="/CAFY-Icon.svg" alt="Cafy" className="w-16 h-16 object-contain rounded-md shadow-sm" />
                </div>

                <h2 className="text-3xl font-bold text-slate-900 mb-6 tracking-tight font-sans">
                    {mode === "resetPassword" ? "Reset Password" : "Email Verification"}
                </h2>

                <AnimatePresence mode="wait">
                    {status === "loading" && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center justify-center py-8"
                        >
                            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                            <p className="text-slate-600 font-medium">{message}</p>
                        </motion.div>
                    )}

                    {status === "success" && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-6"
                        >
                            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
                            <p className="text-slate-800 font-medium text-lg mb-8">{message}</p>
                            <button
                                onClick={() => navigate("/login")}
                                className="w-full py-4 text-white font-bold rounded-full transform active:scale-[0.98] transition-all bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 shadow-md shadow-emerald-900/10 text-sm tracking-wide"
                            >
                                GO TO LOGIN
                            </button>
                        </motion.div>
                    )}

                    {status === "error" && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-6"
                        >
                            <XCircle className="w-16 h-16 text-red-500 mb-4" />
                            <p className="text-red-600 font-medium mb-8 bg-red-50 p-4 rounded-xl border border-red-100">{message}</p>

                            {mode === "resetPassword" && status === "error" && !message.includes("match") && !message.includes("characters") && (
                                <button
                                    onClick={() => navigate("/login")}
                                    className="w-full mb-3 py-4 text-slate-700 font-bold rounded-full transform active:scale-[0.98] transition-all bg-slate-100 hover:bg-slate-200 shadow-sm text-sm tracking-wide"
                                >
                                    BACK TO LOGIN
                                </button>
                            )}

                            {status === "error" && (message.includes("match") || message.includes("characters")) && (
                                <button
                                    onClick={() => setStatus("input")}
                                    className="w-full py-4 text-white font-bold rounded-full transform active:scale-[0.98] transition-all bg-gradient-to-r from-indigo-600 to-slate-800 hover:from-indigo-700 hover:to-slate-900 shadow-md shadow-slate-900/10 text-sm tracking-wide"
                                >
                                    TRY AGAIN
                                </button>
                            )}
                        </motion.div>
                    )}

                    {status === "input" && (
                        <motion.div
                            key="input"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-left"
                        >
                            <p className="text-slate-500 text-sm mb-6 text-center">{message}</p>

                            <form onSubmit={handlePasswordReset} className="space-y-4">
                                <div className="group relative">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                        <Lock size={20} strokeWidth={1.5} />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="New Password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 text-slate-900 text-sm rounded-full py-3.5 pl-12 pr-12 placeholder-slate-400 transition-all font-medium outline-none"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                                    </button>
                                </div>

                                <div className="group relative">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                        <Lock size={20} strokeWidth={1.5} />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Confirm New Password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 text-slate-900 text-sm rounded-full py-3.5 pl-12 pr-12 placeholder-slate-400 transition-all font-medium outline-none"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting || !newPassword || !confirmPassword}
                                    className="w-full mt-6 py-4 text-white font-bold rounded-full transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm tracking-wide disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-600 to-slate-800 hover:from-indigo-700 hover:to-slate-900 shadow-md shadow-slate-900/10"
                                >
                                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "RESET PASSWORD"}
                                </button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default AuthActionHandler;
