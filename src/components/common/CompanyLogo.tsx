import React from "react";
import { getCompanyInitials, getColorForLetter } from "../../utils/companyColors";

interface CompanyLogoProps {
    company: string;
    className?: string;
    size?: number;
}

/**
 * CompanyLogo (UI layer)
 * - Uses a deterministic text-based identifier (initials) for the logo.
 */
const CompanyLogo: React.FC<CompanyLogoProps> = ({
    company,
    className = "",
    size = 40,
}) => {
    // Compute initials (up to 3 chars) and color (based on starting letter of company)
    const initials = getCompanyInitials(company, 3);
    const startingLetter = (company?.trim()?.charAt(0) || initials.charAt(0) || "?").toUpperCase();
    const color = getColorForLetter(startingLetter);

    return (
        <div
            className={`flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm transition-all duration-150 ${className}`}
            style={{ width: size, height: size, backgroundColor: color.bg, color: color.text }}
            title={company}
            aria-label={`${company} identifier`}
        >
            {/* Text-based initials, styled to match existing visual weight */}
            <div className="font-black text-sm leading-none tracking-wide" style={{ fontSize: Math.max(10, Math.floor(size / 2.7)) }}>{initials}</div>
        </div>
    );
};

export default CompanyLogo;
