/* eslint-disable react-refresh/only-export-components -- helper module: exports a render function, no components to hot-reload */
import type { ReactNode } from "react";

/** Inline formatting for agent text, rendered as React nodes only (never HTML). */
const LINK_HOSTS = /(?:^|\.)(?:gov\.uk|acas\.org\.uk|nhs\.uk|cafy\.careers)$/i;

function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && LINK_HOSTS.test(parsed.hostname) ? parsed.href : null;
  } catch {
    return null;
  }
}

const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;

export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith("**")) out.push(<strong key={key} className="font-semibold text-slate-900">{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) out.push(<code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em]">{token.slice(1, -1)}</code>);
    else if (token.startsWith("[")) {
      const label = token.slice(1, token.indexOf("]"));
      const href = safeHref(token.slice(token.indexOf("(") + 1, -1));
      out.push(href ? <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-cafy-700 underline">{label}</a> : label);
    } else out.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = start + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
