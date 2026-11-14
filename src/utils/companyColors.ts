// Deterministic color mapping for company initials (A-Z)
// Each entry defines a light background color with a dark text color for accessibility.
// Palette chosen to be soft, subtle, and professional.

export const LETTER_COLOR_MAP: Record<string, { bg: string; text: string }> = {
  A: { bg: "#FEF3C7", text: "#0F172A" },
  B: { bg: "#FEE7E7", text: "#0F172A" },
  C: { bg: "#E0F2FE", text: "#0F172A" },
  D: { bg: "#EFF6FF", text: "#0F172A" },
  E: { bg: "#ECFCCB", text: "#0F172A" },
  F: { bg: "#F0F9FF", text: "#0F172A" },
  G: { bg: "#F6F6FF", text: "#0F172A" },
  H: { bg: "#FFF7ED", text: "#0F172A" },
  I: { bg: "#FFF1F2", text: "#0F172A" },
  J: { bg: "#F0EFEB", text: "#0F172A" },
  K: { bg: "#F1F5F9", text: "#0F172A" },
  L: { bg: "#ECFDF5", text: "#0F172A" },
  M: { bg: "#FEF7ED", text: "#0F172A" },
  N: { bg: "#F3E8FF", text: "#0F172A" },
  O: { bg: "#FDF2F8", text: "#0F172A" },
  P: { bg: "#F0FFF4", text: "#0F172A" },
  Q: { bg: "#FFF5F5", text: "#0F172A" },
  R: { bg: "#F7FEE7", text: "#0F172A" },
  S: { bg: "#EFFAF4", text: "#0F172A" },
  T: { bg: "#FFF8E7", text: "#0F172A" },
  U: { bg: "#F8FAFC", text: "#0F172A" },
  V: { bg: "#FFF7FB", text: "#0F172A" },
  W: { bg: "#FEF3F3", text: "#0F172A" },
  X: { bg: "#EFF6EC", text: "#0F172A" },
  Y: { bg: "#FFFBEB", text: "#0F172A" },
  Z: { bg: "#F0F9FF", text: "#0F172A" }
};

const DEFAULT_COLOR = { bg: "#F1F5F9", text: "#0F172A" };

export function getColorForLetter(letter?: string) {
  if (!letter) return DEFAULT_COLOR;
  const key = letter.trim().charAt(0).toUpperCase();
  return LETTER_COLOR_MAP[key] || DEFAULT_COLOR;
}

// Generate initials for a company name by taking the first letter of each word.
// For readability we cap to 3 characters (e.g., "Tata Consultancy Services" -> "TCS").
export function getCompanyInitials(name?: string, max = 3) {
  if (!name) return "?";
  const words = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase())
    .filter(Boolean);

  if (words.length === 0) return "?";
  const initials = words.join("");
  return initials.slice(0, max);
}
