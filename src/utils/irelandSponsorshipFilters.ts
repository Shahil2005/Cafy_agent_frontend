/** Shared Ireland Sponsorship Hub volume/year filter helpers (mirrors backend). */

export type IrelandPermitYear = "2020" | "2021" | "2022" | "2023" | "2024" | "2025" | "2026";

export const PERMIT_RANGE_BOUNDS: Record<string, [number, number]> = {
  "1-10": [1, 10],
  "11-50": [11, 50],
  "51-100": [51, 100],
  "100+": [101, Number.POSITIVE_INFINITY],
};

export type IrelandVolumeEmployer = {
  permitsByYear?: Partial<Record<IrelandPermitYear, number>> | null;
  totalPermits: number;
};

/**
 * Volume metric for range filters.
 * When years are selected: sum of permits in those years.
 * Otherwise: lifetime total (2020–2026).
 */
export function volumePermitCount(
  employer: IrelandVolumeEmployer,
  years: readonly string[] | null | undefined
): number {
  if (!years || years.length === 0) return employer.totalPermits;
  return years.reduce((sum, y) => {
    const key = y as IrelandPermitYear;
    return sum + (employer.permitsByYear?.[key] ?? 0);
  }, 0);
}

export function matchesAnyPermitRange(
  permitCount: number,
  ranges: Array<[number, number]>
): boolean {
  return ranges.some(([min, max]) => permitCount >= min && permitCount <= max);
}

export function employerHasPermitInSelectedYears(
  employer: IrelandVolumeEmployer,
  years: readonly string[]
): boolean {
  if (years.length === 0) return true;
  return years.some((y) => (employer.permitsByYear?.[y as IrelandPermitYear] ?? 0) > 0);
}
