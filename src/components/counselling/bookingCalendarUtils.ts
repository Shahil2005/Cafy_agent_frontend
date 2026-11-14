import type { CounsellingSlot } from '../../services/counsellingService';

/** YYYY-MM-DD in the given IANA timezone. */
export function toLocalDateKey(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone });
}

export function groupSlotsByLocalDate(
  slots: CounsellingSlot[],
  timeZone: string
): Map<string, CounsellingSlot[]> {
  const map = new Map<string, CounsellingSlot[]>();

  for (const slot of slots) {
    const key = toLocalDateKey(slot.startsAt, timeZone);
    const list = map.get(key) ?? [];
    list.push(slot);
    map.set(key, list);
  }

  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  return map;
}

export function sortedDateKeys(map: Map<string, CounsellingSlot[]>): string[] {
  return [...map.keys()].sort();
}

export function formatDateKeyLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatSlotTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function dateKeyToUtcDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dateKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isDateInRange(dateKey: string, minKey: string, maxKey: string): boolean {
  return dateKey >= minKey && dateKey <= maxKey;
}
