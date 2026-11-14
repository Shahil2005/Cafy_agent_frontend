import { Fragment } from "react";
import { renderInline } from "./inline";

/**
 * Safe "markdown-lite" for agent text: **bold**, *italic*, `code`, bullet/numbered lists,
 * short headings and links to a few official sites. Everything is rendered as React text
 * nodes; no HTML string is ever injected, so model output cannot run script or style the page.
 */

type Line = { kind: "p" | "ul" | "ol" | "h"; text: string };

function classify(line: string): Line {
  const trimmed = line.trim();
  const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
  if (bullet) return { kind: "ul", text: bullet[1]! };
  const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
  if (numbered) return { kind: "ol", text: numbered[1]! };
  const heading = trimmed.match(/^#{1,4}\s+(.*)$/);
  if (heading) return { kind: "h", text: heading[1]! };
  return { kind: "p", text: trimmed };
}

/** Block-level text: paragraphs, lists and headings, each with safe inline formatting. */
export default function RichText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split(/\r?\n/).map(classify);
  const blocks: Array<{ kind: Line["kind"]; items: string[] }> = [];
  for (const line of lines) {
    if (!line.text) {
      blocks.push({ kind: "p", items: [] });
      continue;
    }
    const prev = blocks[blocks.length - 1];
    if (prev && prev.kind === line.kind && (line.kind === "ul" || line.kind === "ol" || (line.kind === "p" && prev.items.length))) prev.items.push(line.text);
    else blocks.push({ kind: line.kind, items: [line.text] });
  }
  return (
    <div className={`space-y-2 break-words text-sm leading-7 text-slate-700 ${className}`}>
      {blocks.filter((b) => b.items.length).map((block, i) => {
        if (block.kind === "ul")
          return <ul key={i} className="list-disc space-y-1 pl-5">{block.items.map((t, j) => <li key={j}>{renderInline(t, `${i}-${j}`)}</li>)}</ul>;
        if (block.kind === "ol")
          return <ol key={i} className="list-decimal space-y-1 pl-5">{block.items.map((t, j) => <li key={j}>{renderInline(t, `${i}-${j}`)}</li>)}</ol>;
        if (block.kind === "h") return <p key={i} className="text-sm font-semibold text-slate-900">{renderInline(block.items[0]!, `${i}`)}</p>;
        return (
          <p key={i}>
            {block.items.map((t, j) => (
              <Fragment key={j}>{j > 0 && " "}{renderInline(t, `${i}-${j}`)}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
