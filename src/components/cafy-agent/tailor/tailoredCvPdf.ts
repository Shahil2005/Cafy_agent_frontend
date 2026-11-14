import { jsPDF } from "jspdf";
import type { TailoredCv } from "../../../services/agentContract";
import type { ContactDetails } from "./contactDetails";

/**
 * Writes the tailored CV as a one-column A4 PDF with real, selectable text, so applicant tracking
 * systems can read it: no tables, columns, icons or images. Made in the browser; nothing is uploaded.
 */

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 17;
const MARGIN_TOP = 16;
const MARGIN_BOTTOM = 16;
const WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const ACCENT: [number, number, number] = [25, 80, 170];
const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [71, 85, 105];
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

export function buildTailoredCvPdf(cv: TailoredCv, contact: ContactDetails): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: false });
  doc.setProperties({ title: pdfSafe(contact.name ? `${contact.name} - CV` : "CV"), creator: "CAFY" });
  let y = MARGIN_TOP;

  const lineHeight = (size: number) => size * PT_TO_MM * 1.32;
  const ensure = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }
  };
  const font = (size: number, style: "normal" | "bold" | "italic" | "bolditalic" = "normal", color = INK) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  /** Wrapped text at x; returns nothing, moves y down. */
  const paragraph = (text: string, size: number, x = MARGIN_X, width = WIDTH, style: "normal" | "bold" | "italic" = "normal", color = INK) => {
    font(size, style, color);
    const lines = doc.splitTextToSize(pdfSafe(text), width) as string[];
    for (const line of lines) {
      ensure(lineHeight(size));
      doc.text(line, x, y + size * PT_TO_MM * 0.8);
      y += lineHeight(size);
    }
  };
  const bullet = (text: string, size = 9.8) => {
    const indent = 4.2;
    font(size);
    const lines = doc.splitTextToSize(pdfSafe(text), WIDTH - indent) as string[];
    lines.forEach((line, i) => {
      ensure(lineHeight(size));
      if (i === 0) {
        doc.setFillColor(...MUTED);
        doc.circle(MARGIN_X + 1.3, y + size * PT_TO_MM * 0.5, 0.55, "F");
      }
      doc.text(line, MARGIN_X + indent, y + size * PT_TO_MM * 0.8);
      y += lineHeight(size);
    });
  };
  /** A bold left text with a right-aligned muted text on the same line (title and dates). */
  const splitLine = (left: string, right: string | undefined, size: number) => {
    font(size, "normal", MUTED);
    const rightText = pdfSafe(right ?? "");
    const rightWidth = rightText ? doc.getTextWidth(rightText) + 4 : 0;
    font(size, "bold");
    const lines = doc.splitTextToSize(pdfSafe(left), WIDTH - rightWidth) as string[];
    lines.forEach((line, i) => {
      ensure(lineHeight(size));
      font(size, "bold");
      doc.text(line, MARGIN_X, y + size * PT_TO_MM * 0.8);
      if (i === 0 && rightText) {
        font(size, "normal", MUTED);
        doc.text(rightText, PAGE_WIDTH - MARGIN_X, y + size * PT_TO_MM * 0.8, { align: "right" });
      }
      y += lineHeight(size);
    });
  };
  const section = (title: string) => {
    // Keep a heading with at least two lines of what follows.
    ensure(14);
    y += 3.2;
    font(10.5, "bold", ACCENT);
    doc.text(pdfSafe(title.toUpperCase()), MARGIN_X, y + 10.5 * PT_TO_MM * 0.8, { charSpace: 0.35 });
    y += lineHeight(10.5) + 0.6;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
    y += 2.2;
  };

  // Header
  if (contact.name.trim()) {
    font(20, "bold");
    doc.text(pdfSafe(contact.name), PAGE_WIDTH / 2, y + 20 * PT_TO_MM * 0.8, { align: "center" });
    y += lineHeight(20) + 0.8;
  }
  if (cv.headline.trim()) {
    font(11, "normal", ACCENT);
    for (const line of doc.splitTextToSize(pdfSafe(cv.headline), WIDTH) as string[]) {
      doc.text(line, PAGE_WIDTH / 2, y + 11 * PT_TO_MM * 0.8, { align: "center" });
      y += lineHeight(11);
    }
  }
  const contactLine = [contact.location, contact.phone, contact.email, contact.linkedin, contact.website].map((v) => pdfSafe(v)).filter(Boolean).join("  |  ");
  if (contactLine) {
    font(9.2, "normal", MUTED);
    for (const line of doc.splitTextToSize(contactLine, WIDTH) as string[]) {
      doc.text(line, PAGE_WIDTH / 2, y + 9.2 * PT_TO_MM * 0.8 + 0.6, { align: "center" });
      y += lineHeight(9.2);
    }
  }
  y += 1;

  if (cv.summary.trim()) {
    section("Profile");
    paragraph(cv.summary, 9.8);
  }

  if (cv.skills.length) {
    section("Key skills");
    for (const group of cv.skills) {
      const label = `${pdfSafe(group.group)}:`;
      font(9.8, "bold");
      const labelWidth = doc.getTextWidth(`${label} `) + 0.6;
      const items = pdfSafe(group.items.join(", "));
      font(9.8);
      // The label and the first line share a line; the rest wraps under the full width.
      const firstLines = doc.splitTextToSize(items, WIDTH - labelWidth) as string[];
      const first = firstLines[0] ?? "";
      const rest = items.slice(first.length).trim();
      ensure(lineHeight(9.8));
      font(9.8, "bold");
      doc.text(label, MARGIN_X, y + 9.8 * PT_TO_MM * 0.8);
      font(9.8);
      doc.text(first, MARGIN_X + labelWidth, y + 9.8 * PT_TO_MM * 0.8);
      y += lineHeight(9.8);
      if (rest) paragraph(rest, 9.8);
      y += 0.6;
    }
  }

  if (cv.experience.length) {
    section("Experience");
    cv.experience.forEach((role, index) => {
      if (index > 0) y += 2.4;
      ensure(lineHeight(10.4) + lineHeight(9.6) + lineHeight(9.8) * 2);
      splitLine(role.title || role.employer, role.dates, 10.4);
      const where = [role.title ? role.employer : "", role.location].filter(Boolean).join(", ");
      if (where) paragraph(where, 9.6, MARGIN_X, WIDTH, "italic", MUTED);
      y += 0.8;
      for (const text of role.bullets) bullet(text);
    });
  }

  if (cv.projects.length) {
    section("Projects");
    cv.projects.forEach((project, index) => {
      if (index > 0) y += 1.8;
      ensure(lineHeight(10.2) + lineHeight(9.8));
      splitLine(project.name, undefined, 10.2);
      for (const text of project.bullets) bullet(text);
    });
  }

  if (cv.education.length) {
    section("Education");
    cv.education.forEach((item, index) => {
      if (index > 0) y += 1.8;
      ensure(lineHeight(10.2) + lineHeight(9.6));
      splitLine(item.qualification || item.institution || "", item.dates, 10.2);
      if (item.qualification && item.institution) paragraph(item.institution, 9.6, MARGIN_X, WIDTH, "italic", MUTED);
      if (item.details) paragraph(item.details, 9.6);
    });
  }

  if (cv.certifications.length) {
    section("Certifications");
    for (const text of cv.certifications) bullet(text);
  }

  for (const extra of cv.extras) {
    section(extra.heading);
    for (const text of extra.items) bullet(text);
  }

  return doc;
}
