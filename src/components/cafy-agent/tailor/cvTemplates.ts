/**
 * CV templates for the tailored CV PDF. A template is only a style: fonts, header, section headings,
 * bullets, colour, density and section order. Every template keeps one column of real, selectable
 * text, so applicant tracking systems read them all the same way. No AI and no server are involved.
 */

export type Rgb = [number, number, number];
export type SectionKey = "summary" | "skills" | "experience" | "projects" | "education" | "certifications" | "extras";

export interface CvTemplate {
  id: string;
  name: string;
  description: string;
  /** One of jsPDF's built-in fonts (Latin-1 only; see pdfSafe). */
  font: "helvetica" | "times";
  accent: Rgb;
  ink: Rgb;
  muted: Rgb;
  /** centered / left: name, headline and contact on the page; banner: on a full-width accent band. */
  header: "centered" | "left" | "banner";
  /** rule: line under; topRule: line above; bar: accent block on the left; plain: text only; band: tinted strip. */
  heading: "rule" | "topRule" | "bar" | "plain" | "band";
  /** Upper-case section headings with letter spacing, or as written. */
  headingCaps: boolean;
  bullet: "dot" | "dash" | "square";
  /** stacked: title and dates, then employer and location in italics; inline: everything on one line. */
  roleLayout: "stacked" | "inline";
  /** The headline uses the accent colour, or the muted ink. */
  headlineAccent: boolean;
  margin: { x: number; top: number; bottom: number };
  size: { name: number; headline: number; contact: number; heading: number; role: number; body: number; meta: number };
  /** Extra space between sections and between entries, in mm. */
  gap: { section: number; entry: number };
  order: SectionKey[];
  titles: Record<Exclude<SectionKey, "extras">, string>;
}

const STANDARD_ORDER: SectionKey[] = ["summary", "skills", "experience", "projects", "education", "certifications", "extras"];
const STANDARD_TITLES: CvTemplate["titles"] = {
  summary: "Profile",
  skills: "Key skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
};

const BASE = {
  ink: [30, 41, 59] as Rgb,
  muted: [71, 85, 105] as Rgb,
  margin: { x: 17, top: 16, bottom: 16 },
  size: { name: 20, headline: 11, contact: 9.2, heading: 10.5, role: 10.4, body: 9.8, meta: 9.6 },
  gap: { section: 3.2, entry: 2.4 },
  order: STANDARD_ORDER,
  titles: STANDARD_TITLES,
};

export const CV_TEMPLATES: CvTemplate[] = [
  {
    ...BASE,
    id: "classic",
    name: "Classic",
    description: "Centred header, blue headings with a rule. Fits most jobs.",
    font: "helvetica",
    accent: [25, 80, 170],
    header: "centered",
    heading: "rule",
    headingCaps: true,
    bullet: "dot",
    roleLayout: "stacked",
    headlineAccent: true,
  },
  {
    ...BASE,
    id: "executive",
    name: "Executive",
    description: "Serif type in navy, for senior, finance and legal roles.",
    font: "times",
    accent: [24, 38, 74],
    ink: [20, 24, 33],
    muted: [70, 76, 90],
    header: "centered",
    heading: "topRule",
    headingCaps: true,
    bullet: "dot",
    roleLayout: "stacked",
    headlineAccent: true,
    margin: { x: 19, top: 17, bottom: 17 },
    size: { name: 23, headline: 12, contact: 10, heading: 11.5, role: 11.4, body: 10.8, meta: 10.6 },
    titles: { ...STANDARD_TITLES, summary: "Professional profile", skills: "Core competencies", experience: "Professional experience" },
  },
  {
    ...BASE,
    id: "modern",
    name: "Modern",
    description: "Left-aligned with teal accent blocks. Good for tech and digital roles.",
    font: "helvetica",
    accent: [13, 118, 110],
    header: "left",
    heading: "bar",
    headingCaps: true,
    bullet: "square",
    roleLayout: "stacked",
    headlineAccent: true,
    size: { ...BASE.size, name: 22 },
  },
  {
    ...BASE,
    id: "minimal",
    name: "Minimal",
    description: "Black and grey only, lots of white space. Quiet and easy to read.",
    font: "helvetica",
    accent: [15, 23, 42],
    ink: [33, 37, 41],
    muted: [100, 108, 118],
    header: "left",
    heading: "plain",
    headingCaps: true,
    bullet: "dash",
    roleLayout: "stacked",
    headlineAccent: false,
    margin: { x: 20, top: 18, bottom: 18 },
    gap: { section: 4.6, entry: 3 },
  },
  {
    ...BASE,
    id: "compact",
    name: "Compact",
    description: "Tighter spacing and one-line roles, to fit more on one page.",
    font: "helvetica",
    accent: [51, 65, 85],
    header: "left",
    heading: "rule",
    headingCaps: true,
    bullet: "dot",
    roleLayout: "inline",
    headlineAccent: false,
    margin: { x: 13, top: 12, bottom: 12 },
    size: { name: 17, headline: 10, contact: 8.6, heading: 9.6, role: 9.4, body: 9, meta: 8.8 },
    gap: { section: 2.2, entry: 1.6 },
  },
  {
    ...BASE,
    id: "banner",
    name: "Banner",
    description: "Your name on a blue band, with tinted headings. Stands out but stays ATS-friendly.",
    font: "helvetica",
    accent: [25, 85, 218],
    header: "banner",
    heading: "band",
    headingCaps: true,
    bullet: "dot",
    roleLayout: "stacked",
    headlineAccent: true,
  },
  {
    ...BASE,
    id: "graduate",
    name: "Graduate",
    description: "Education and projects first. Made for students and recent graduates.",
    font: "times",
    accent: [122, 31, 52],
    ink: [28, 25, 30],
    muted: [88, 80, 86],
    header: "centered",
    heading: "rule",
    headingCaps: false,
    bullet: "dot",
    roleLayout: "stacked",
    headlineAccent: true,
    size: { name: 22, headline: 11.6, contact: 9.8, heading: 12.5, role: 11, body: 10.6, meta: 10.4 },
    order: ["summary", "education", "projects", "skills", "experience", "certifications", "extras"],
  },
];

export const DEFAULT_TEMPLATE_ID = "classic";

export function cvTemplate(id: string | undefined): CvTemplate {
  return CV_TEMPLATES.find((t) => t.id === id) ?? CV_TEMPLATES[0];
}
