import { jsPDF } from "jspdf";
import type { TailoredCv } from "../../../services/agentContract";
import type { ContactDetails } from "./contactDetails";
import { cvTemplate, type Rgb, type SectionKey } from "./cvTemplates";

/**
 * Writes the tailored CV as a one-column A4 PDF with real, selectable text, so applicant tracking
 * systems can read it: no tables, columns, icons or images. The chosen template sets the style only
 * (see cvTemplates.ts). Made in the browser; nothing is uploaded.
 */

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const PT_TO_MM = 0.3528;

const PLAIN: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'", "‛": "'", "′": "'",
  "“": '"', "”": '"', "„": '"', "″": '"',
  "–": "-", "—": "-", "‒": "-", "‐": "-", "‑": "-", "−": "-",
  "…": "...", "•": "-", " ": " ", " ": " ", " ": " ", "​": "",
};

/** The built-in PDF fonts cover Latin-1 only: typographic punctuation becomes plain, accents stay, the rest is dropped. */
export function pdfSafe(text: string): string {
  let out = "";
  for (const ch of text) {
    if (ch.charCodeAt(0) <= 0xff && ch.codePointAt(0)! <= 0xff) out += ch;
    else if (PLAIN[ch] !== undefined) out += PLAIN[ch];
    else {
      const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      if (base && [...base].every((c) => c.codePointAt(0)! <= 0xff)) out += base;
    }
  }
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

export function tailoredCvFileName(name: string, jobTitle: string): string {
  const clean = (value: string) => pdfSafe(value).replace(/[^\p{L}\p{N} '&-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  const who = clean(name);
  const job = clean(jobTitle);
  return `${who ? `${who} CV` : "Tailored CV"}${job ? ` - ${job}` : ""}.pdf`;
}

/** The colour `amount` of the way from `color` to white. */
const towardsWhite = (color: Rgb, amount: number): Rgb => color.map((c) => Math.round(c + (255 - c) * amount)) as Rgb;

type Style = "normal" | "bold" | "italic" | "bolditalic";

export function buildTailoredCvPdf(cv: TailoredCv, contact: ContactDetails, templateId?: string): jsPDF {
  const t = cvTemplate(templateId);
  const X = t.margin.x;
  const WIDTH = PAGE_WIDTH - X * 2;
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: false });
  doc.setProperties({ title: pdfSafe(contact.name ? `${contact.name} - CV` : "CV"), creator: "CAFY" });
  let y = t.margin.top;

  const lineHeight = (size: number) => size * PT_TO_MM * 1.32;
  /** From the top of a line to its baseline. */
  const baseline = (size: number) => size * PT_TO_MM * 0.8;
  const ensure = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - t.margin.bottom) {
      doc.addPage();
      y = t.margin.top;
    }
  };
  const font = (size: number, style: Style = "normal", color: Rgb = t.ink) => {
    doc.setFont(t.font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const wrap = (text: string, width: number) => doc.splitTextToSize(pdfSafe(text), width) as string[];
  /** Wrapped text; moves y down. */
  const paragraph = (text: string, size: number, style: Style = "normal", color: Rgb = t.ink) => {
    font(size, style, color);
    for (const line of wrap(text, WIDTH)) {
      ensure(lineHeight(size));
      doc.text(line, X, y + baseline(size));
      y += lineHeight(size);
    }
  };
  const marker = (size: number) => {
    const mid = y + size * PT_TO_MM * 0.5;
    if (t.bullet === "square") {
      doc.setFillColor(...t.accent);
      doc.rect(X + 0.75, mid - 0.55, 1.1, 1.1, "F");
    } else if (t.bullet === "dash") {
      doc.setDrawColor(...t.muted);
      doc.setLineWidth(0.3);
      doc.line(X + 0.3, mid, X + 2.3, mid);
    } else {
      doc.setFillColor(...t.muted);
      doc.circle(X + 1.3, mid, 0.55, "F");
    }
  };
  const bullet = (text: string, size = t.size.body) => {
    const indent = 4.2;
    font(size);
    wrap(text, WIDTH - indent).forEach((line, i) => {
      ensure(lineHeight(size));
      if (i === 0) marker(size);
      doc.text(line, X + indent, y + baseline(size));
      y += lineHeight(size);
    });
  };
  /** A bold left text with a right-aligned muted text on the same line (title and dates). */
  const splitLine = (left: string, right: string | undefined, size: number) => {
    font(size, "normal", t.muted);
    const rightText = pdfSafe(right ?? "");
    const rightWidth = rightText ? doc.getTextWidth(rightText) + 4 : 0;
    font(size, "bold");
    wrap(left, WIDTH - rightWidth).forEach((line, i) => {
      ensure(lineHeight(size));
      font(size, "bold");
      doc.text(line, X, y + baseline(size));
      if (i === 0 && rightText) {
        font(size, "normal", t.muted);
        doc.text(rightText, PAGE_WIDTH - X, y + baseline(size), { align: "right" });
      }
      y += lineHeight(size);
    });
  };
  const section = (title: string) => {
    // Keep a heading with at least two lines of what follows.
    ensure(16);
    y += t.gap.section;
    const size = t.size.heading;
    const label = pdfSafe(t.headingCaps ? title.toUpperCase() : title);
    const options = t.headingCaps ? { charSpace: t.heading === "plain" ? 0.7 : 0.35 } : {};
    switch (t.heading) {
      case "topRule":
        doc.setDrawColor(...t.accent);
        doc.setLineWidth(0.25);
        doc.line(X, y, PAGE_WIDTH - X, y);
        y += 1.6;
        font(size, "bold", t.accent);
        doc.text(label, X, y + baseline(size), options);
        y += lineHeight(size) + 1.4;
        break;
      case "bar":
        doc.setFillColor(...t.accent);
        doc.rect(X, y + 0.25, 1.4, size * PT_TO_MM * 0.95, "F");
        font(size, "bold", t.accent);
        doc.text(label, X + 3.4, y + baseline(size), options);
        y += lineHeight(size) + 1.8;
        break;
      case "plain":
        font(size, "bold", t.accent);
        doc.text(label, X, y + baseline(size), options);
        y += lineHeight(size) + 1.4;
        break;
      case "band": {
        const height = lineHeight(size) + 1.6;
        doc.setFillColor(...towardsWhite(t.accent, 0.88));
        doc.rect(X, y, WIDTH, height, "F");
        font(size, "bold", t.accent);
        doc.text(label, X + 2, y + 0.8 + baseline(size), options);
        y += height + 2.2;
        break;
      }
      default: // rule
        font(size, "bold", t.accent);
        doc.text(label, X, y + baseline(size), options);
        y += lineHeight(size) + 0.6;
        doc.setDrawColor(...t.accent);
        doc.setLineWidth(0.3);
        doc.line(X, y, PAGE_WIDTH - X, y);
        y += 2.2;
    }
  };

  // ---- header ----
  const name = contact.name.trim();
  const headline = cv.headline.trim();
  const contactLine = [contact.location, contact.phone, contact.email, contact.linkedin, contact.website].map((v) => pdfSafe(v)).filter(Boolean).join("  |  ");

  if (t.header === "banner" && (name || headline || contactLine)) {
    const pad = 7;
    font(t.size.headline);
    const headlineLines = headline ? wrap(headline, WIDTH) : [];
    font(t.size.contact);
    const contactLines = contactLine ? (doc.splitTextToSize(contactLine, WIDTH) as string[]) : [];
    const height = pad * 2 - 1
      + (name ? lineHeight(t.size.name) + 0.8 : 0)
      + headlineLines.length * lineHeight(t.size.headline)
      + contactLines.length * lineHeight(t.size.contact);
    doc.setFillColor(...t.accent);
    doc.rect(0, 0, PAGE_WIDTH, height, "F");
    y = pad;
    if (name) {
      font(t.size.name, "bold", [255, 255, 255]);
      doc.text(pdfSafe(name), X, y + baseline(t.size.name));
      y += lineHeight(t.size.name) + 0.8;
    }
    font(t.size.headline, "normal", towardsWhite(t.accent, 0.82));
    for (const line of headlineLines) {
      doc.text(line, X, y + baseline(t.size.headline));
      y += lineHeight(t.size.headline);
    }
    font(t.size.contact, "normal", towardsWhite(t.accent, 0.93));
    for (const line of contactLines) {
      doc.text(line, X, y + baseline(t.size.contact) + 0.4);
      y += lineHeight(t.size.contact);
    }
    y = height + 3;
  } else {
    const centred = t.header === "centered";
    const at = centred ? PAGE_WIDTH / 2 : X;
    const align = { align: centred ? "center" : "left" } as const;
    if (name) {
      font(t.size.name, "bold");
      doc.text(pdfSafe(name), at, y + baseline(t.size.name), align);
      y += lineHeight(t.size.name) + 0.8;
    }
    if (headline) {
      font(t.size.headline, "normal", t.headlineAccent ? t.accent : t.muted);
      for (const line of wrap(headline, WIDTH)) {
        doc.text(line, at, y + baseline(t.size.headline), align);
        y += lineHeight(t.size.headline);
      }
    }
    if (contactLine) {
      font(t.size.contact, "normal", t.muted);
      for (const line of doc.splitTextToSize(contactLine, WIDTH) as string[]) {
        doc.text(line, at, y + baseline(t.size.contact) + 0.6, align);
        y += lineHeight(t.size.contact);
      }
    }
    y += 1;
  }

  // ---- sections, in the template's order ----
  const inline = t.roleLayout === "inline";
  const body = t.size.body;
  const render: Record<SectionKey, () => void> = {
    summary: () => {
      if (!cv.summary.trim()) return;
      section(t.titles.summary);
      paragraph(cv.summary, body);
    },
    skills: () => {
      if (!cv.skills.length) return;
      section(t.titles.skills);
      for (const group of cv.skills) {
        const label = `${pdfSafe(group.group)}:`;
        font(body, "bold");
        const labelWidth = doc.getTextWidth(`${label} `) + 0.6;
        const items = pdfSafe(group.items.join(", "));
        font(body);
        // The label and the first line share a line; the rest wraps under the full width.
        const first = (doc.splitTextToSize(items, WIDTH - labelWidth) as string[])[0] ?? "";
        const rest = items.slice(first.length).trim();
        ensure(lineHeight(body));
        font(body, "bold");
        doc.text(label, X, y + baseline(body));
        font(body);
        doc.text(first, X + labelWidth, y + baseline(body));
        y += lineHeight(body);
        if (rest) paragraph(rest, body);
        y += 0.6;
      }
    },
    experience: () => {
      if (!cv.experience.length) return;
      section(t.titles.experience);
      cv.experience.forEach((role, index) => {
        if (index > 0) y += t.gap.entry;
        ensure(lineHeight(t.size.role) + lineHeight(t.size.meta) + lineHeight(body) * 2);
        if (inline) {
          splitLine([role.title, role.employer].filter(Boolean).join(", "), [role.location, role.dates].filter(Boolean).join("  |  "), t.size.role);
        } else {
          splitLine(role.title || role.employer, role.dates, t.size.role);
          const where = [role.title ? role.employer : "", role.location].filter(Boolean).join(", ");
          if (where) paragraph(where, t.size.meta, "italic", t.muted);
        }
        y += inline ? 0.4 : 0.8;
        for (const text of role.bullets) bullet(text);
      });
    },
    projects: () => {
      if (!cv.projects.length) return;
      section(t.titles.projects);
      cv.projects.forEach((project, index) => {
        if (index > 0) y += t.gap.entry * 0.75;
        ensure(lineHeight(t.size.role) + lineHeight(body));
        splitLine(project.name, undefined, t.size.role);
        for (const text of project.bullets) bullet(text);
      });
    },
    education: () => {
      if (!cv.education.length) return;
      section(t.titles.education);
      cv.education.forEach((item, index) => {
        if (index > 0) y += t.gap.entry * 0.75;
        ensure(lineHeight(t.size.role) + lineHeight(t.size.meta));
        if (inline) {
          splitLine([item.qualification, item.institution].filter(Boolean).join(", "), item.dates, t.size.role);
        } else {
          splitLine(item.qualification || item.institution || "", item.dates, t.size.role);
          if (item.qualification && item.institution) paragraph(item.institution, t.size.meta, "italic", t.muted);
        }
        if (item.details) paragraph(item.details, t.size.meta);
      });
    },
    certifications: () => {
      if (!cv.certifications.length) return;
      section(t.titles.certifications);
      for (const text of cv.certifications) bullet(text);
    },
    extras: () => {
      for (const extra of cv.extras) {
        section(extra.heading);
        for (const text of extra.items) bullet(text);
      }
    },
  };
  for (const key of t.order) render[key]();

  return doc;
}
