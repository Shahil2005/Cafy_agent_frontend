import React from "react";
import { Briefcase, Heart, Share2, GraduationCap, ListChecks, Banknote } from "lucide-react";
import { motion } from "framer-motion";
import type { SocMasterOccupation } from "../../types/soc";
import { getSponsorshipStatusMeta } from "./socDisplay";

interface UkRoleCardProps {
    role: SocMasterOccupation;
    index: number;
    isFavorite: boolean;
    onToggleFavorite: () => void;
    onShare: () => void;
    onViewProfile: () => void;
}

function headlineRateLabel(role: SocMasterOccupation): string {
    const s = role.salary;
    if (s.type === "national_pay_scale") return "National pay scale (NHS / teachers)";
    if (s.type === "not_eligible") return "No sponsorship salary threshold";
    const annual = s.median?.rate100.annual ?? s.percentile25?.rate100.annual ?? null;
    if (annual === null) return "Going rate not published";
    return `From £${annual.toLocaleString()}/yr going rate`;
}

const UkRoleCard: React.FC<UkRoleCardProps> = ({
    role,
    index,
    isFavorite,
    onToggleFavorite,
    onShare,
    onViewProfile,
}) => {
    const statusMeta = getSponsorshipStatusMeta(role.sponsorship.applicantStatus);
    const isOnIsl = !!role.sponsorship.immigrationSalaryList;
    const phdEligible = role.sponsorship.phdEligible === true;
    const StatusIcon = statusMeta.icon;

    return (
        <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.03 }}
            className={`relative bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col ${statusMeta.card}`}
        >
            <div className="absolute top-4 right-4 z-10">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-bold shadow-sm font-mono">
                    SOC {role.code}
                </span>
            </div>

            <div className="p-5 pb-0">
                <div className="flex items-start gap-3 pr-20">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <Briefcase size={20} className="text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900 text-[15px] leading-snug line-clamp-2">
                            {role.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1.5 line-clamp-1">{role.category}</p>
                    </div>
                </div>

                <div className="flex items-center gap-1 mt-3">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite();
                        }}
                        aria-label={isFavorite ? "Remove from favourites" : "Add to favourites"}
                        className={`p-2 rounded-lg transition-colors ${
                            isFavorite
                                ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                                : "text-slate-400 hover:text-blue-600 hover:bg-slate-50"
                        }`}
                    >
                        <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onShare();
                        }}
                        aria-label="Share role"
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <Share2 size={16} />
                    </button>
                </div>
            </div>

            <div className="mx-5 mt-4 mb-4 rounded-xl bg-slate-50 border border-slate-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${statusMeta.chip}`}>
                        <StatusIcon size={12} />
                        {statusMeta.label}
                    </span>
                </div>

                <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mb-1">
                    <Banknote size={13} className="text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700">{headlineRateLabel(role)}</span>
                </p>
                <p className="text-[11px] text-slate-500 mb-3">
                    Skill level: <span className="font-medium text-slate-700">{role.skillLevel || "Not stated"}</span>
                </p>

                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Eligibility Flags
                </p>
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 flex items-center gap-1.5">
                            <ListChecks size={12} />
                            Immigration Salary List
                        </span>
                        <span className="font-bold text-slate-700">
                            {isOnIsl ? "On the list" : "Not listed"}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 flex items-center gap-1.5">
                            <GraduationCap size={12} />
                            PhD points
                        </span>
                        <span className="font-bold text-slate-700">
                            {phdEligible ? "Eligible" : role.sponsorship.phdEligible === null ? "Not stated" : "No"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="px-5 pb-5 mt-auto">
                <button
                    type="button"
                    onClick={onViewProfile}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors shadow-sm"
                >
                    View Full Profile
                </button>
            </div>
        </motion.article>
    );
};

export default UkRoleCard;
