export function sourceDate(value: string, withTime = false): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Europe/London",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(new Date(value));
}

export function calendarLabel(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
