export function getScoreRange(score: number): string {
    if (score <= 0) {
        return '0–5';
    }
    if (score >= 100) {
        return '96–100';
    }
    // For 1–5, 6–10, ..., 96–100
    const upper = Math.ceil(score / 5) * 5;
    const lower = upper - 4;
    return `${lower}–${upper}`;
}

export function getScoreColor(score: number): string {
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
}
