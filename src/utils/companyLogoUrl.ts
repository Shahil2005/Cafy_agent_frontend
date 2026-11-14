const LEGAL_SUFFIXES =
    /\b(limited|ltd|llp|plc|inc|corporation|corp|group|holdings|international|ireland|irish|uk|the|and|&)\b/gi;

/** Build favicon/logo URL candidates from a company name (best-effort). */
export function getCompanyLogoUrlCandidates(companyName: string): string[] {
    const normalized = companyName
        .replace(/\s*\([^)]*\)\s*/g, " ")
        .replace(LEGAL_SUFFIXES, " ")
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .trim();

    const words = normalized.split(/\s+/).filter((w) => w.length > 1);
    if (words.length === 0) return [];

    const primary = words[0].toLowerCase();
    const joined = words
        .slice(0, 2)
        .join("")
        .toLowerCase();

    const domains = [
        `${primary}.com`,
        `${primary}.co.uk`,
        `${primary}.ie`,
        `${joined}.com`,
    ];

    const uniqueDomains = [...new Set(domains)];

    return uniqueDomains.flatMap((domain) => [
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
        `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
    ]);
}
