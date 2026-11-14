import React, { useMemo, useState } from "react";
import CompanyLogo from "../common/CompanyLogo";
import { getCompanyLogoUrlCandidates } from "../../utils/companyLogoUrl";

interface SponsorCompanyLogoProps {
    companyName: string;
    size?: number;
    className?: string;
}

const SponsorCompanyLogo: React.FC<SponsorCompanyLogoProps> = ({
    companyName,
    size = 44,
    className = "",
}) => {
    const candidates = useMemo(() => getCompanyLogoUrlCandidates(companyName), [companyName]);
    const [candidateIndex, setCandidateIndex] = useState(0);

    const currentUrl = candidates[candidateIndex];
    const showFallback = !currentUrl || candidateIndex >= candidates.length;

    if (showFallback) {
        return <CompanyLogo company={companyName} size={size} className={className} />;
    }

    return (
        <div
            className={`shrink-0 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm ${className}`}
            style={{ width: size, height: size }}
        >
            <img
                src={currentUrl}
                alt=""
                className="w-[70%] h-[70%] object-contain"
                onError={() => setCandidateIndex((i) => i + 1)}
            />
        </div>
    );
};

export default SponsorCompanyLogo;
