function normalise(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Finds the quoted passage in the CV text (exact, else its first words), as [start, end) offsets. */
export function findQuote(text: string, quote: string): [number, number] | null {
  const hay = text.toLowerCase();
  const exact = hay.indexOf(quote.toLowerCase().trim());
  if (exact >= 0) return [exact, exact + quote.trim().length];
  // PDF line breaks and hyphenation differ from the quote: find any 3 consecutive quote words in order.
  const words = normalise(quote).split(" ").filter((w) => w.length > 2);
  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (let i = 0; i + 3 <= words.length; i++) {
    const pattern = new RegExp(words.slice(i, i + 3).map(escape).join("[\\s\\S]{0,40}?"), "i");
    const match = pattern.exec(text);
    if (match) {
      // Start the highlight a little earlier when the window began mid-quote.
      const start = Math.max(0, match.index - (i > 0 ? Math.min(60, i * 8) : 0));
      return [start, Math.min(text.length, start + quote.length + 20)];
    }
  }
  return null;
}
