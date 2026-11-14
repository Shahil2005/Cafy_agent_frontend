export type PdfTextRun = {
  str: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ClickableLink = {
  href: string;
  runs: PdfTextRun[];
};

const URL_IN_TEXT_RE = /(?:https?:\/\/|www\.)[^\s<>()[\]{}"']+/gi;

export function stripTrailingPunctuation(raw: string): string {
  return raw.replace(/[.,;:!?)]+$/g, '');
}

export function normalizeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let s = stripTrailingPunctuation(raw.trim());
  try {
    s = decodeURIComponent(s);
  } catch {
    // keep raw if it is not valid percent-encoding
  }
  s = s.replace(/^[\]]+/, '');
  if (s.startsWith('<') && s.endsWith('>')) s = s.slice(1, -1).trim();
  s = s.replace(/^(https?:)\/(?!\/)/i, '$1//');
  if (s.startsWith('//')) s = `https:${s}`;
  else if (s.toLowerCase().startsWith('www.')) s = `https://${s}`;
  try {
    const parsed = new URL(s);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function isUrlContinuation(raw: string, prevUrl = ''): boolean {
  const t = raw.trim();
  if (!t || /\s/.test(t)) return false;
  if (/^(https?:\/\/|www\.)/i.test(t)) return false;
  if (!/^[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$/.test(t)) return false;
  if (/[/.?#&=]/.test(t)) return true;
  // Word-wrap hyphen: "jobs-and-" + "careers"
  return prevUrl.endsWith('-') && /^[A-Za-z0-9-]+$/.test(t);
}

export function linkUrlFromAnnotation(annot: Record<string, unknown>): string | null {
  const action = annot.action as { uri?: string; url?: string } | undefined;
  return (
    normalizeExternalUrl(annot.url) ||
    normalizeExternalUrl(annot.unsafeUrl) ||
    normalizeExternalUrl(action?.uri) ||
    normalizeExternalUrl(action?.url) ||
    null
  );
}

export function groupRunsIntoLines(runs: PdfTextRun[]): PdfTextRun[][] {
  const sorted = [...runs].sort((a, b) => a.top - b.top || a.left - b.left);
  const lines: PdfTextRun[][] = [];
  for (const run of sorted) {
    const line = lines[lines.length - 1];
    const prev = line?.[0];
    const threshold = Math.max(4, (prev?.height || run.height) * 0.45);
    if (prev && Math.abs(prev.top - run.top) < threshold) {
      line.push(run);
    } else {
      lines.push([run]);
    }
  }
  for (const line of lines) {
    line.sort((a, b) => a.left - b.left);
  }
  return lines;
}

/** Same reconstruction the Resources viewer uses for clickable overlays. */
export function reconstructClickableLinks(runs: PdfTextRun[]): ClickableLink[] {
  const lines = groupRunsIntoLines(runs);
  const links: ClickableLink[] = [];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    let text = '';
    const spans: Array<{ start: number; end: number; run: PdfTextRun }> = [];
    for (const run of line) {
      const start = text.length;
      text += run.str;
      spans.push({ start, end: text.length, run });
    }

    URL_IN_TEXT_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = URL_IN_TEXT_RE.exec(text))) {
      const start = match.index;
      const end = start + match[0].length;
      const covering = spans.filter((s) => s.end > start && s.start < end);
      if (!covering.length) continue;

      const urlRuns: PdfTextRun[] = covering.map((s) => s.run);
      const urlLeft = Math.min(...urlRuns.map((r) => r.left));
      const lineHeight = Math.max(...urlRuns.map((r) => r.height), 10);
      let urlText = match[0];
      let lastTop = Math.max(...urlRuns.map((r) => r.top));

      for (let nj = li + 1; nj < lines.length && nj <= li + 4; nj++) {
        const nextTop = Math.min(...lines[nj].map((r) => r.top));
        if (nextTop - lastTop > lineHeight * 2.4) break;

        const aligned = lines[nj].filter((r) => r.left >= urlLeft - 12 && r.str.trim());
        if (!aligned.length) continue;

        const frag = aligned.map((r) => r.str).join('');
        if (!isUrlContinuation(frag, urlText)) break;
        urlText += frag;
        urlRuns.push(...aligned);
        lastTop = Math.max(...aligned.map((r) => r.top));
      }

      const joinedWrap = urlRuns.length > covering.length;
      let href = normalizeExternalUrl(urlText);
      if (!joinedWrap && /-$/.test(urlText)) {
        href = normalizeExternalUrl(urlText.replace(/-+$/, '')) || href;
      }
      if (!href) continue;
      links.push({ href, runs: urlRuns });
    }
  }

  return links;
}

export function uniqueHrefs(hrefs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const href of hrefs) {
    const key = href.replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(href);
  }
  return out;
}
