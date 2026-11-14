/**
 * Reads the contact details from the top of a CV, in the browser only. The server removes them
 * before the CV reaches the AI, so the tailored CV comes back without them and the PDF adds them
 * here. The user can correct every field before downloading.
 */
export interface ContactDetails {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
}

export const EMPTY_CONTACT: ContactDetails = { name: "", email: "", phone: "", location: "", linkedin: "", website: "" };

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /\+?\d[\d ()-]{7,}\d/g;
const LINKEDIN = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/[^\s|•·,;]+/i;
const URL_TEXT = /(?:https?:\/\/[^\s|•·,;]+|(?:www\.)?[a-z0-9-]+\.(?:com|co\.uk|io|dev|me|org|net|uk|app)\/[^\s|•·,;]+)/gi;
const UK_POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;
const SEPARATORS = /\s*(?:\||•|·|\t|\s{3,})\s*/;
const TITLE_LINE = /^(?:curriculum vitae|cv|resume|résumé)$/i;
const NAME_LIKE = /^(?:[\p{L}][\p{L}'’.-]*\s+){1,4}[\p{L}][\p{L}'’.-]*$/u;
/** Section headings and job words that are not a name, even when they look like one. */
const NOT_A_NAME = /\b(?:profile|summary|experience|education|skills|objective|contact|personal|statement|manager|engineer|analyst|developer|consultant)\b/i;

function tidyName(value: string): string {
  if (value !== value.toUpperCase()) return value;
  // "JOHN O'NEILL" -> "John O'Neill"
  return value.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_m, before: string, letter: string) => before + letter.toUpperCase());
}

export function extractContactDetails(cvText: string): ContactDetails {
  const lines = cvText.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  const top = lines.slice(0, 8);
  const topText = top.join("\n");

  let name = "";
  for (const line of top.slice(0, 3)) {
    if (TITLE_LINE.test(line)) continue;
    const first = line.split(SEPARATORS)[0]!.trim();
    if (NAME_LIKE.test(first) && !NOT_A_NAME.test(first)) name = tidyName(first);
    break;
  }

  const email = cvText.match(EMAIL)?.[0] ?? "";
  const linkedin = (cvText.match(LINKEDIN)?.[0] ?? "").replace(/[).]+$/, "");
  const withoutEmails = cvText.replace(new RegExp(EMAIL.source, "gi"), " ");
  const website = ((withoutEmails.match(URL_TEXT) ?? []).find((url) => !/linkedin\.com/i.test(url)) ?? "").replace(/[).]+$/, "");

  let phone = "";
  for (const match of topText.matchAll(PHONE)) {
    const value = match[0].trim();
    if (/^\d{4}\s*-\s*\d{4}$/.test(value)) continue;
    if (value.replace(/\D/g, "").length >= 9) {
      phone = value;
      break;
    }
  }

  let location = "";
  for (const segment of top.flatMap((line) => line.split(SEPARATORS))) {
    const s = segment.trim();
    if (!s || s === name || EMAIL.test(s) || /linkedin|https?:|www\./i.test(s) || (phone && s.includes(phone))) continue;
    if (UK_POSTCODE.test(s) && s.length <= 60) {
      location = s;
      break;
    }
    if (/^[\p{L} .'’-]+,\s*[\p{L} .'’-]+$/u.test(s) && s.length <= 40) {
      location = s;
      break;
    }
  }

  return { name, email, phone, location, linkedin, website };
}
