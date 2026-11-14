import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Calendar, Clock, ArrowRight } from "lucide-react";
import type { Job } from "../../types";

interface InterviewNotificationManagerProps {
    jobs: Job[];
}

interface Notification {
    id: string;
    company: string;
    role: string;
    time: string;
    hoursRemaining?: number;
}

const InterviewNotificationManager: React.FC<InterviewNotificationManagerProps> = ({ jobs }) => {
    const [activeNotifications, setActiveNotifications] = useState<Notification[]>([]);
    const [notifiedIds, setNotifiedIds] = useState<string[]>(() => {
        const saved = localStorage.getItem("interview_notified_ids");
        return saved ? JSON.parse(saved) : [];
    });

    // Sync notified IDs to localStorage
    useEffect(() => {
        localStorage.setItem("interview_notified_ids", JSON.stringify(notifiedIds));
    }, [notifiedIds]);

    const checkInterviews = useCallback(() => {
        const now = new Date();

        jobs.forEach((job) => {
            if (job.status === "Interview" && job.interviewDate && job.interviewTime) {
                // Parse interview date and time
                const [year, month, day] = job.interviewDate.split('-').map(Number);
                const [hours, minutes] = job.interviewTime.split(':').map(Number);
                const interviewDate = new Date(year, month - 1, day, hours, minutes);

                // Calculate difference in hours
                const diffMs = interviewDate.getTime() - now.getTime();
                const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

                // Notification logic: Trigger every hour from 24 hours before until 1 hour before
                if (diffHours > 0 && diffHours <= 24) {
                    const notificationKey = `${job.id}_h${diffHours}`;

                    if (!notifiedIds.includes(notificationKey)) {
                        const newNotification: Notification = {
                            id: notificationKey,
                            company: job.company,
                            role: job.role,
                            time: job.interviewTime,
                            hoursRemaining: diffHours
                        };

                        // Remove any existing notifications for this JOB to prevent piling
                        setActiveNotifications(prev => {
                            const filtered = prev.filter(n => !n.id.startsWith(job.id));
                            return [...filtered, newNotification];
                        });

                        setNotifiedIds(prev => [...prev, notificationKey]);
                    }
                }
            }
        });
    }, [jobs, notifiedIds]);

    // Check every minute
    useEffect(() => {
        checkInterviews(); // Initial check
        const interval = setInterval(checkInterviews, 60000);
        return () => clearInterval(interval);
    }, [checkInterviews]);

    const removeNotification = (id: string) => {
        setActiveNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-4 max-w-sm w-full pointer-events-none">
            <AnimatePresence>
                {activeNotifications.map((notification) => (
                    <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: 50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        className="pointer-events-auto"
                    >
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
                            <div className="relative p-5">
                                {/* Close Button */}
                                <button
                                    onClick={() => removeNotification(notification.id)}
                                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                >
                                    <X size={18} />
                                </button>

                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className="flex-shrink-0 w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                        <Bell size={24} className="animate-pulse" />
                                    </div>

                                    <div className="flex-1 min-w-0 pr-6">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[11px] font-bold text-indigo-600">
                                                Interview Reminder
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                                            <span className="text-[11px] font-medium text-slate-400">
                                                In {notification.hoursRemaining} {notification.hoursRemaining === 1 ? 'hour' : 'hours'}
                                            </span>
                                        </div>

                                        <h4 className="text-base font-bold text-slate-900 leading-tight mb-1 truncate">
                                            {notification.role}
                                        </h4>
                                        <p className="text-sm font-medium text-slate-500 truncate mb-3">
                                            at {notification.company}
                                        </p>

                                        <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={14} className="text-slate-400" />
                                                <span>Today</span>
                                            </div>
                                            <div className="w-px h-3 bg-slate-200" />
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={14} className="text-slate-400" />
                                                <span>{notification.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center justify-between">
                                    <div className="text-[11px] font-medium text-slate-400 italic bg-slate-50/50 px-2 py-1 rounded">
                                        "{notification.company === "Google" ? "Be yourself and think aloud." : "Success is where preparation meets opportunity."}"
                                    </div>
                                    <button
                                        onClick={() => removeNotification(notification.id)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-all group"
                                    >
                                        <span>Got it</span>
                                        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                </div>
                            </div>

                            {/* Progress bar for auto-dismiss if we wanted, but for professional alerts "Stay until closed" is often better. 
                  Let's add a subtle bottom accent. */}
                            <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 w-full" />
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default InterviewNotificationManager;
