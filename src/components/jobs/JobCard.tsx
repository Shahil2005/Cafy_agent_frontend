import React, { useState, useRef, useEffect } from "react";
import { ExternalLink, MoreVertical, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import CompanyLogo from "../common/CompanyLogo";
import type { Job, JobStatus } from "../../types";
import { JOB_STATUSES } from "../../utils/constants";
import { formatDate } from "../../utils/followUpStatus";

interface JobCardProps {
    job: Job;
    onClick: () => void;
    onToggleFavorite?: (e: React.MouseEvent) => void;
    onDelete?: (e: React.MouseEvent) => void;
    onUpdateStatus?: (status: JobStatus) => void;
    menuContainer?: HTMLElement | null;
    menuScrollContainer?: HTMLElement | null;
}

const JobCard: React.FC<JobCardProps> = ({ job, onClick, onToggleFavorite, onDelete, onUpdateStatus, menuContainer, menuScrollContainer }) => {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const menuRafRef = useRef<number | null>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
    const menuPanelRef = useRef<HTMLDivElement>(null);

    const resolveMenuContainer = () => {
        if (menuContainer) return menuContainer;
        return menuRef.current?.closest("[data-status]") as HTMLElement | null;
    };

    const resolveScrollContainer = () => {
        if (menuScrollContainer) return menuScrollContainer;
        const column = resolveMenuContainer();
        return column?.querySelector("[data-column-scroll]") as HTMLElement | null;
    };

    const updateMenuPosition = () => {
        const container = resolveMenuContainer();
        if (!container) return;
        const buttonRect = menuButtonRef.current?.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (!buttonRect || !containerRect) return;

        const menuWidth = 224;
        const menuHeight = 320;

        let left = buttonRect.right - containerRect.left - menuWidth;
        left = Math.max(8, Math.min(left, containerRect.width - menuWidth - 8));

        let top = buttonRect.bottom - containerRect.top + 8;
        if (top + menuHeight > containerRect.height) {
            top = Math.max(8, buttonRect.top - containerRect.top - menuHeight - 8);
        }

        setMenuPos({ top, left });
    };

    const scheduleMenuPositionUpdate = () => {
        if (menuRafRef.current !== null) return;
        menuRafRef.current = window.requestAnimationFrame(() => {
            menuRafRef.current = null;
            updateMenuPosition();
        });
    };


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // If click occurs outside both the menu button and the portal menu, close
            const target = event.target as Node;
            if (
                menuRef.current && !menuRef.current.contains(target) &&
                menuPanelRef.current && !menuPanelRef.current.contains(target)
            ) {
                setShowMenu(false);
            }
        };

        const handleCloseAll = () => setShowMenu(false);

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener('closeAllMenus', handleCloseAll as EventListener);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener('closeAllMenus', handleCloseAll as EventListener);
        };
    }, []);

    useEffect(() => {
        if (!showMenu) return;

        const handleReposition = () => scheduleMenuPositionUpdate();
        handleReposition();

        const scrollTarget = resolveScrollContainer() || window;
        scrollTarget.addEventListener("scroll", handleReposition, true);
        window.addEventListener("resize", handleReposition);
        return () => {
            scrollTarget.removeEventListener("scroll", handleReposition, true);
            window.removeEventListener("resize", handleReposition);
            if (menuRafRef.current !== null) {
                window.cancelAnimationFrame(menuRafRef.current);
                menuRafRef.current = null;
            }
        };
    }, [showMenu, menuScrollContainer]);

    const isRejected = job.status === "Rejected";

    return (
        <div
            onClick={onClick}
            className={`group relative bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-300 hover:shadow-sm transition-all duration-200 !cursor-pointer active:!cursor-grabbing flex flex-col h-full select-none ${showMenu ? "z-40" : "z-0"}`}
        >
            {/* Header: Title and Actions */}
            <div className="flex justify-between items-start gap-4 mb-3">
                <div className="flex gap-3 min-w-0">
                    <CompanyLogo company={job.company} size={40} className="shrink-0" />
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-900 leading-tight truncate pr-2 group-hover:text-blue-600 transition-colors">
                            {job.role}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
                            <span className="truncate font-medium">{job.company}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-1 -mr-2 -mt-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite?.(e);
                        }}
                        className={`p-1.5 rounded-md hover:bg-slate-50 transition-colors cursor-pointer ${job.isFavorite ? 'text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <div className="sr-only">Favorite</div>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill={job.isFavorite ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-5 h-5"
                        >
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </svg>
                    </button>

                    <div className="relative" ref={menuRef}>
                        <button
                            ref={menuButtonRef}
                            onClick={(e) => {
                                e.stopPropagation();
                                // Close other menus first so only one menu stays open
                                if (!showMenu) document.dispatchEvent(new CustomEvent('closeAllMenus'));

                                scheduleMenuPositionUpdate();
                                setShowMenu(prev => !prev);
                            }}
                            className="p-1.5 rounded-md hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                            <MoreVertical size={20} />
                        </button>

                        {showMenu && menuPos && resolveMenuContainer() && createPortal(
                            <AnimatePresence>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.98, y: -6 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.98, y: -6 }}
                                    style={{ top: menuPos.top, left: menuPos.left, width: 224 }}
                                    className="absolute bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 overflow-hidden max-h-80 overflow-y-auto"
                                    ref={menuPanelRef}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* Move Section */}
                                    {!isRejected && (
                                        <div className="px-1 mb-2">
                                            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                Move to Status
                                            </div>
                                            <div className="space-y-0.5">
                                                {JOB_STATUSES.map((status) => {
                                                    const isActive = job.status === status;
                                                    const getStatusColor = (s: string) => {
                                                        switch (s) {
                                                            case 'Applied': return 'bg-blue-500';
                                                            case 'Interview': return 'bg-violet-500';
                                                            case 'Offer': return 'bg-emerald-500';
                                                            case 'Rejected': return 'bg-rose-500';
                                                            case 'On Hold': return 'bg-amber-500';
                                                            default: return 'bg-slate-500';
                                                        }
                                                    };

                                                    return (
                                                        <button
                                                            key={status}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onUpdateStatus?.(status);
                                                                setShowMenu(false);
                                                            }}
                                                            disabled={isActive}
                                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 ${isActive
                                                                ? 'bg-blue-50 text-blue-700 font-bold'
                                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2.5">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(status)} shadow-sm`} />
                                                                <span>{status}</span>
                                                            </div>
                                                            {isActive && (
                                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {isRejected && (
                                        <div className="px-4 py-3 mb-2 bg-slate-50 mx-2 rounded-lg border border-slate-100">
                                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                                Status cannot be changed for rejected applications.
                                            </p>
                                        </div>
                                    )}

                                    <div className="mx-1 border-t border-slate-100 my-1 pt-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete?.(e);
                                                setShowMenu(false);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-rose-600 hover:bg-rose-50 transition-all duration-200 text-left font-medium cursor-pointer"
                                        >
                                            <Trash2 size={16} />
                                            <span>Delete Job</span>
                                        </button>
                                    </div>
                                </motion.div>
                            </AnimatePresence>,
                            resolveMenuContainer() as HTMLElement
                        )}
                    </div>
                </div>
            </div>

            {/* Content: Badges / Tags */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
                {/* Portal Badge - Clean, neutral */}
                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded border border-slate-200">
                    <span className="capitalize">{job.portal}</span>
                </div>

                {/* Date Badge */}
                {(job.createdAt || job.appliedDate) && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 text-slate-500 text-xs font-medium rounded border border-slate-100">
                        <span>{formatDate(job.createdAt || job.appliedDate)}</span>
                    </div>
                )}
            </div>

            {/* Footer: Meta & Action */}
            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                {job.isManual ? (
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded border border-blue-100">
                        Added manually
                    </div>
                ) : (
                    <div />
                )}

                <div className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform duration-200 text-slate-900 font-medium cursor-pointer">
                    <span>View Details</span>
                    <ExternalLink size={12} />
                </div>
            </div>
        </div>
    );
};

export default React.memo(JobCard);
