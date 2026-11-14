import { useEffect, useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { getCompanyLogoUrlCandidates } from '../../utils/companyLogoUrl';

interface JobsCompanyLogoProps {
    companyName?: string | null;
    faviconUrl?: string | null;
    /** Outer box size in px (default 40 for list, 48 for detail). */
    size?: number;
    className?: string;
    /** Defaults to rounded; set false for square logos. */
    rounded?: boolean;
}

/**
 * Company logo for Jobs Portal list + detail.
 * 1) Stored `url_favicon` from API
 * 2) Best-effort domain favicon candidates from company name
 * 3) Building icon fallback (never leave an empty box after onError)
 */
export function JobsCompanyLogo({
    companyName,
    faviconUrl,
    size = 40,
    className = '',
    rounded = true,
}: JobsCompanyLogoProps) {
    const candidates = useMemo(() => {
        const urls: string[] = [];
        const stored = (faviconUrl || '').trim();
        if (stored) urls.push(stored);
        const name = (companyName || '').trim();
        if (name) {
            for (const c of getCompanyLogoUrlCandidates(name)) {
                if (!urls.includes(c)) urls.push(c);
            }
        }
        return urls;
    }, [faviconUrl, companyName]);

    const [index, setIndex] = useState(0);

    useEffect(() => {
        setIndex(0);
    }, [faviconUrl, companyName]);

    const currentUrl = candidates[index];
    const imgSize = Math.round(size * 0.6);
    const radius = rounded ? (size >= 48 ? 'rounded-xl' : 'rounded-lg') : 'rounded-none';

    return (
        <div
            className={`${radius} border border-slate-100 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden ${className}`}
            style={{ width: size, height: size }}
            aria-hidden
        >
            {currentUrl ? (
                <img
                    src={currentUrl}
                    alt=""
                    width={imgSize}
                    height={imgSize}
                    className="object-contain"
                    style={{ width: imgSize, height: imgSize }}
                    onError={() => setIndex((i) => i + 1)}
                />
            ) : (
                <Building2
                    className="text-slate-300"
                    style={{ width: imgSize, height: imgSize }}
                />
            )}
        </div>
    );
}
