import React from "react";
import { MapPin, Briefcase, Heart, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import SponsorCompanyLogo from "./SponsorCompanyLogo";
import type { IrelandEmployerResult } from "../../services/jobsPortalService";

const PERMIT_YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"] as const;

interface IrelandSponsorCompanyCardProps {
    company: IrelandEmployerResult;
    index: number;
    isFavorite: boolean;
    onToggleFavorite: () => void;
    onShare: () => void;
    onViewProfile: () => void;
}

const IrelandSponsorCompanyCard: React.FC<IrelandSponsorCompanyCardProps> = ({
    company,
    index,
    isFavorite,
    onToggleFavorite,
    onShare,
    onViewProfile,
}) => {
    const yearlyValues = PERMIT_YEARS.map((year) => company.permitsByYear?.[year] ?? 0);
    const chartMax = Math.max(...yearlyValues, 1);

    return (
        <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.03 }}
            className="relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
        >
            <div className="absolute top-4 right-4 z-10">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-sm">
                    {company.totalPermits.toLocaleString()} permit{company.totalPermits === 1 ? "" : "s"}
                </span>
            </div>

            <div className="p-5 pb-0">
                <div className="flex items-start gap-3 pr-24">
                    <SponsorCompanyLogo companyName={company.employerName} size={44} />
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900 text-[15px] leading-snug line-clamp-2 pr-2">
                            {company.employerName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                <MapPin size={11} className="text-blue-500" />
                                {company.city ?? "Ireland"}
                            </span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Briefcase size={11} />
                                Employer
                            </span>
                        </div>
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
                        title={isFavorite ? "Remove from favourites" : "Save to favourites"}
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
                        aria-label="Share employer"
                        title="Share or copy employer details"
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <Share2 size={16} />
                    </button>
                </div>
            </div>

            <div className="mx-5 mt-4 mb-4 rounded-xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70 mb-1">
                    Total Permits (2020–2026)
                </p>
                <p className="text-3xl font-extrabold text-blue-700 mb-4">
                    {company.totalPermits.toLocaleString()}
                </p>

                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Permit History
                </p>
                <div className="space-y-1.5">
                    {PERMIT_YEARS.map((year, i) => {
                        const value = yearlyValues[i];
                        const pct = (value / chartMax) * 100;
                        return (
                            <div key={year} className="flex items-center gap-2">
                                <span className="text-[11px] font-medium text-slate-500 w-8 shrink-0">
                                    {year}
                                </span>
                                <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="text-[11px] font-bold text-slate-600 w-6 text-right shrink-0">
                                    {value}
                                </span>
                            </div>
                        );
                    })}
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

export default IrelandSponsorCompanyCard;
