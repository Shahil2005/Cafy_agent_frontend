export const AI_DISCLAIMER_MESSAGE =
  'Cafy is AI-powered and can make mistakes. Please double-check before you use this.';

export type AiDisclaimerContext = 'resume' | 'cover-letter' | 'email' | 'analysis' | 'optimization';

export type AiDisclaimerVariant = 'full' | 'compact' | 'banner';

export function getAiDisclaimerMessage(): string {
  return AI_DISCLAIMER_MESSAGE;
}

/** @deprecated Context and variant are ignored — same message everywhere. */
export function getAiDisclaimerText(
  _variant?: AiDisclaimerVariant,
  _context?: AiDisclaimerContext
): { message: string } {
  return { message: AI_DISCLAIMER_MESSAGE };
}

export const AI_DISCLAIMER_FOOTNOTE = AI_DISCLAIMER_MESSAGE;

export function getAiDisclaimerFootnote(): string {
  return `\n\n---\n${AI_DISCLAIMER_MESSAGE}`;
}
