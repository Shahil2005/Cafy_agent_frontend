import React from "react";
import { MapPin, Briefcase, Heart, Share2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import SponsorCompanyLogo from "./SponsorCompanyLogo";
import type { SponsorCompanyResult } from "../../services/jobsPortalService";

interface UkSponsorCompanyCardProps {
    company: SponsorCompanyResult;
    index: number;
    isFavorite: boolean;
    onToggleFavorite: () => void;
    onShare: () => void;
    onViewProfile: () => void;
}

const UkSponsorCompanyCard: React.FC<UkSponsorCompanyCardProps> = ({
    company,
    index,
    isFavorite,
    onToggleFavorite,
    onShare,
    onViewProfile,
}) => {
    const isARating = company.typeRating.includes("A rating");
    const ratingLabel = isARating ? "A Rating" : company.typeRating.includes("B rating") ? "B Rating" : company.typeRating;

    return (
        <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.03 }}
            className="relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
        >
            <div className="absolute top-4 right-4 z-10">
                <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm ${
                        isARating
                            ? "bg-blue-600 text-white"
                            : "bg-white text-blue-700 border border-blue-200"
                    }`}
                >
                    {ratingLabel}
                </span>
            </div>

            <div className="p-5 pb-0">
                <div className="flex items-start gap-3 pr-20">
                    <SponsorCompanyLogo companyName={company.organisationName} size={44} />
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900 text-[15px] leading-snug line-clamp-2 pr-2">
                            {company.organisationName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                            {company.townCity && (
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <MapPin size={11} className="text-blue-500" />
                                    {company.townCity}
                                </span>
                            )}
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Briefcase size={11} />
                                Licensed Sponsor
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
                        aria-label="Share company"
                        title="Share or copy company details"
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <Share2 size={16} />
                    </button>
                </div>
            </div>

            <div className="mx-5 mt-4 mb-4 rounded-xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70 mb-1">
                    Sponsor Status
                </p>
                <p className="text-2xl font-extrabold text-blue-700 mb-4 flex items-center gap-2">
                    <ShieldCheck size={22} className="text-blue-600" />
                    Active Sponsor
                </p>

                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Register Details
                </p>
                <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Type &amp; rating</span>
                        <span className="font-bold text-slate-800 text-right">{company.typeRating}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Visa route</span>
                        <span className="font-bold text-slate-800 text-right">{company.route}</span>
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

export default UkSponsorCompanyCard;
