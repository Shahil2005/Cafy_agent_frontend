import type { SocMasterOccupation, SocSalaryTable, VisaSalaryRules } from '../../types/soc';

const FULL_TIME_HOURS = 37.5;
const WEEKS = 52;

export type OfferBand = { low: number; high: number; hourly: boolean; upperBound: boolean };

export type OfferMarketView = {
    code: string;
    title: string;
    offer: string | null;
    goingRate: string | null;
    /** Home Office table the going rate was taken from, such as "Table 1". */
    rateSource: string | null;
    threshold: string | null;
    newEntrant: string | null;
    sentence: string;
};

function gbp(amount: number): string {
    return `£${Math.round(amount).toLocaleString('en-GB')}`;
}

function bandLabel(low: number, high: number): string {
    if (low === high) return gbp(low);
    return `${gbp(low)}–${gbp(high).slice(1)}`;
}

function tokenAmount(digits: string, unit?: string): number | null {
    const n = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0) return null;
    const mark = unit?.toLowerCase();
    if (mark === 'k') return n * 1000;
    if (mark === 'm') return n * 1_000_000;
    return n;
}

function weeklyHours(text: string): number | null {
    const match = text.match(/\b(\d{1,2}(?:\.\d+)?)\s*-?\s*hours?\s*(?:per|a|\/)\s*week\b/i);
    if (!match) return null;
    const hours = Number(match[1]);
    if (hours < 1 || hours > 80) return null;
    return hours;
}

function currencyKind(mark: string | undefined): 'gbp' | 'usd' | 'eur' | null {
    if (!mark) return null;
    if (mark === '£' || mark.toLowerCase() === 'gbp') return 'gbp';
    if (mark === '$' || mark.toLowerCase() === 'usd') return 'usd';
    if (mark === '€' || mark.toLowerCase() === 'eur') return 'eur';
    return null;
}

/** Yearly pay from the advert. Hours, holiday days, and non-pound currencies are not treated as the salary. */
export function parseOfferAnnual(raw: string | null | undefined): OfferBand | null {
    if (!raw) return null;
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!/\d/.test(text)) return null;

    const hasGbp = /£|\bgbp\b/i.test(text);
    const hasOther = /[$€]|\b(?:usd|eur)\b/i.test(text);
    if (hasOther && !hasGbp) return null;

    const hours = weeklyHours(text);
    const payText = text
        .replace(/\b\d{1,2}(?:\.\d+)?\s*-?\s*hours?\s*(?:per|a|\/)\s*week\b/gi, ' ')
        .replace(/\b\d{1,3}\s*days?\b/gi, ' ')
        .replace(/\b20\d{2}\b/g, ' ');

    const amounts: number[] = [];
    const token = /(?:(£|\$|€|gbp|usd|eur)\s*)?(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?(?:\s*(gbp|usd|eur))?/gi;
    for (const match of payText.matchAll(token)) {
        const kind = currencyKind(match[1] ?? match[4]);
        if (kind && kind !== 'gbp') continue;
        const amount = tokenAmount(match[2], match[3]);
        if (amount != null) amounts.push(amount);
    }
    if (!amounts.length) return null;

    const hourly = /(?:per|an)\s+hour|\/\s*h(?:ou?r|r)?\b|p\.?\s*h\.?\b|\bhourly\b/i.test(payText)
        && amounts.every((amount) => amount < 500);
    const ranged = /(?:£|gbp)?\s*\d[\d,]*(?:\.\d+)?\s*[kKmM]?\s*(?:-|–|—|\bto\b)\s*(?:£|gbp)?\s*\d/i.test(payText);
    let chosen = ranged ? amounts : amounts.slice(0, 1);

    if (!hourly && chosen.length === 2) {
        const [first, second] = chosen[0] <= chosen[1] ? chosen : [chosen[1], chosen[0]];
        if (first >= 15 && first < 1000 && second >= 10000) chosen = [first * 1000, second];
    }

    let low = Math.min(...chosen);
    let high = Math.max(...chosen);
    if (hourly) {
        const week = hours ?? FULL_TIME_HOURS;
        low = Math.round(low * week * WEEKS);
        high = Math.round(high * week * WEEKS);
    }
    low = Math.round(low);
    high = Math.round(high);
    if (high < 1) return null;
    if (!hourly && high < 1000) return null;
    if (low < 1) return { low: high, high, hourly, upperBound: true };
    return { low, high, hourly, upperBound: false };
}

function payTable(occupation: SocMasterOccupation): SocSalaryTable | null {
    if (occupation.salary.type !== 'going_rate') return null;
    return occupation.salary.median ?? occupation.salary.percentile25;
}

function floorFor(table: SocSalaryTable, rules: VisaSalaryRules): number | null {
    const options = table.rate100.pointsOptions ?? [];
    const floor = (key: string) => rules.pointsOptions[key]?.floorSalary ?? null;
    if (options.includes('A')) return floor('A');
    if (options.includes('F')) return floor('F');
    if (options.includes('K')) return floor('K');
    if (options.includes('D')) return floor('D');
    return floor('A');
}

function sitsSentence(offer: OfferBand | null, going: number | null, threshold: number | null): string {
    const binding = going != null && threshold != null ? Math.max(going, threshold) : going ?? threshold;
    if (!offer) {
        if (binding == null) return '';
        return `Pay is not stated on this advert. A standard Skilled Worker route needs at least ${gbp(binding)}, the higher of the threshold and the going rate.`;
    }
    if (offer.upperBound) {
        if (binding == null) return `The advert states pay up to ${gbp(offer.high)}.`;
        return `The advert states pay up to ${gbp(offer.high)}. The actual salary may be lower. A standard route needs at least ${gbp(binding)}.`;
    }
    if (binding != null && offer.low >= binding) {
        return `This offer clears ${gbp(binding)}, the higher of the general threshold and the going rate.`;
    }
    if (threshold != null && offer.high < threshold) {
        return `This offer is below the general threshold of ${gbp(threshold)}.`;
    }
    if (going != null && threshold != null && offer.low >= threshold && offer.high < going) {
        return `This offer clears the general threshold of ${gbp(threshold)}, and it is below the going rate of ${gbp(going)}.`;
    }
    if (going != null && offer.low < going && offer.high >= going) {
        return `This range crosses the going rate of ${gbp(going)}.`;
    }
    return '';
}

/** Home Office going rate, general threshold, and new-entrant rate for one SOC code. */
export function buildOfferMarket(
    occupation: SocMasterOccupation,
    rules: VisaSalaryRules,
    salary: string | null | undefined,
): OfferMarketView | null {
    const table = payTable(occupation);
    if (!table) return null;
    const going = table.rate100.annual;
    const threshold = floorFor(table, rules);
    const entrant = table.rate70?.annual ?? null;
    if (going == null && threshold == null && entrant == null) return null;
    const offer = parseOfferAnnual(salary);
    return {
        code: occupation.code,
        title: occupation.title,
        offer: offer
            ? `${offer.upperBound ? `Up to ${gbp(offer.high)}` : bandLabel(offer.low, offer.high)}${offer.hourly ? ' a year' : ''}`
            : null,
        goingRate: going != null ? gbp(going) : null,
        rateSource: going != null ? table.source : null,
        threshold: threshold != null ? gbp(threshold) : null,
        newEntrant: entrant != null ? gbp(entrant) : null,
        sentence: sitsSentence(offer, going, threshold),
    };
}
