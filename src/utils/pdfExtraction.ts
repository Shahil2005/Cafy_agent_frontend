/**
 * PDF Text Extraction Utility
 * 
 * Extracts text from PDF files with proper spacing and formatting
 * Uses pdfjs-dist library for parsing PDF structure
 */

/**
 * Configuration for text cleanup
 */
const TEXT_CLEANUP_CONFIG = {
  emailRegex: /[\w\.-]+@[\w\.-]+\.\w+/g,
  urlRegex: /(?:https?:\/\/|www\.)[^\s]+|linkedin\.com\/in\/[^\s]+/gi,
  multipleSpacesRegex: / {2,}/g,
  missingSpacePatterns: [
    // Lowercase letter followed by 2+ uppercase letters
    { pattern: /([a-z])([A-Z]{2,})/g, replacement: '$1 $2' },
    // Lowercase followed by digits
    { pattern: /([a-z])(\d+)/g, replacement: '$1 $2' },
    // Digits followed by uppercase (but not in URLs)
    { pattern: /(\d)([A-Z])/g, replacement: '$1 $2' },
  ]
};

/**
 * Detects document features in structured text
 */
interface DocumentFeatures {
  hasColumns: boolean;
  hasTables: boolean;
  estimatedColumnCount: number;
}

interface TextBlock {
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  fontName?: string;
}

/**
 * Detect if text has multiple columns based on X positioning
 */
function detectColumns(textBlocks: TextBlock[]): DocumentFeatures {
  if (textBlocks.length === 0) return { hasColumns: false, hasTables: false, estimatedColumnCount: 1 };

  // Collect unique X positions
  const xPositions = new Set(textBlocks.map(b => Math.round(b.x / 10) * 10)); // Group by ~10 pixel tolerance
  const sortedXPositions = Array.from(xPositions).sort((a, b) => a - b);

  // Calculate gaps between X positions
  const gaps: number[] = [];
  for (let i = 1; i < sortedXPositions.length; i++) {
    gaps.push(sortedXPositions[i] - sortedXPositions[i - 1]);
  }

  const pageWidth = 612; // Standard letter width in points
  const largeGapThreshold = pageWidth * 0.3; // 30% of page width

  // Count significant gaps that indicate column separators
  const columnGaps = gaps.filter(g => g > largeGapThreshold).length;
  const estimatedColumnCount = columnGaps + 1;

  return {
    hasColumns: estimatedColumnCount > 1,
    hasTables: false, // Will be detected separately
    estimatedColumnCount
  };
}

/**
 * Detect tables by looking for evenly-spaced Y positions
 */
function detectTables(textBlocks: TextBlock[]): boolean {
  if (textBlocks.length < 4) return false;

  const yPositions = textBlocks.map(b => b.y).sort((a, b) => a - b);
  const gaps: number[] = [];

  for (let i = 1; i < yPositions.length; i++) {
    const gap = yPositions[i] - yPositions[i - 1];
    if (gap > 1) gaps.push(gap); // Ignore negligible gaps
  }

  if (gaps.length < 3) return false;

  // Check if 60%+ of gaps are uniform (indicating table structure)
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const tolerance = avgGap * 0.2; // 20% tolerance
  const uniformGaps = gaps.filter(g => Math.abs(g - avgGap) <= tolerance).length;

  return uniformGaps / gaps.length >= 0.6;
}

/**
 * Protect text from splitting (emails, URLs, etc)
 */
function getProtectedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];

  // Find all email addresses
  for (const match of text.matchAll(TEXT_CLEANUP_CONFIG.emailRegex)) {
    if (match.index !== undefined) {
      ranges.push([match.index, match.index + match[0].length]);
    }
  }

  // Find all URLs
  for (const match of text.matchAll(TEXT_CLEANUP_CONFIG.urlRegex)) {
    if (match.index !== undefined) {
      ranges.push([match.index, match.index + match[0].length]);
    }
  }

  return ranges;
}

/**
 * Check if a position is within protected ranges
 */
function isInProtectedRange(pos: number, protectedRanges: Array<[number, number]>): boolean {
  return protectedRanges.some(([start, end]) => pos >= start && pos < end);
}

/**
 * Fix missing spaces in text with smart pattern matching
 */
function fixMissingSpaces(text: string): string {
  const protectedRanges = getProtectedRanges(text);
  let result = text;

  for (const { pattern, replacement } of TEXT_CLEANUP_CONFIG.missingSpacePatterns) {
    result = result.replace(pattern, (match, ...args) => {
      const matchIndex = args[args.length - 2]; // The index argument in replace
      // Check if this match is in a protected range
      if (isInProtectedRange(matchIndex, protectedRanges)) {
        return match; // Don't modify protected content
      }
      return match.replace(pattern, replacement);
    });
  }

  return result;
}

/**
 * Clean up extracted text
 */
function cleanText(text: string): string {
  // Fix missing spaces
  let cleaned = fixMissingSpaces(text);

  // Replace multiple spaces with single space
  cleaned = cleaned.replace(TEXT_CLEANUP_CONFIG.multipleSpacesRegex, ' ');

  // Remove spaces before and after newlines
  cleaned = cleaned.replace(/\s*\n\s*/g, '\n');

  // Convert 3+ newlines to double newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Remove replacement characters
  cleaned = cleaned.replace(/\ufffd/g, '');

  // Trim each line
  cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');

  return cleaned.trim();
}

/**
 * Extract text from PDF using pdfjs-dist
 * 
 * This function loads a PDF from base64 and extracts all text with proper formatting.
 * Note: Requires pdfjs-dist to be installed: npm install pdfjs-dist
 */
export async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // Dynamic import with proper error handling
    let pdfjsLib: any;
    try {
      // Try standard import first
      const module = await import(/* @vite-ignore */ 'pdfjs-dist');
      pdfjsLib = module.default || module;
    } catch (importError) {
      console.error('Failed to import pdfjs-dist:', importError);
      throw new Error(
        'PDF extraction library failed to load. Ensure pdfjs-dist is properly installed.'
      );
    }

    // Get the getDocument function
    const getDocument = pdfjsLib.getDocument;
    if (!getDocument) {
      throw new Error('pdfjs-dist did not load correctly. getDocument function not found.');
    }

    // Configure worker - REQUIRED by pdfjs-dist
    try {
      if (pdfjsLib.GlobalWorkerOptions) {
        // Use the worker from public folder (statically served by Vite)
        // This is the most reliable way to load the worker in browser
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }
    } catch (workerError) {
      console.warn('Worker config warning:', workerError);
    }


    // Load PDF document
    let pdf: any;
    try {
      pdf = await getDocument({ data: arrayBuffer }).promise;
    } catch (loadError) {
      const errMsg = loadError instanceof Error ? loadError.message : String(loadError);
      throw new Error(`Failed to load PDF document: ${errMsg}`);
    }

    const pageCount = pdf.numPages;
    if (pageCount < 1) {
      throw new Error('PDF has no pages or is invalid.');
    }

    let allText = '';
    const textBlocksByPage: TextBlock[][] = [];

    // Process each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText: string[] = [];
      const pageBlocks: TextBlock[] = [];

      // Group items by Y position (roughly by line)
      const itemsByLine = new Map<number, typeof textContent.items>();
      for (const item of textContent.items) {
        if ('str' in item) {
          const lineY = Math.round(item.y);
          if (!itemsByLine.has(lineY)) {
            itemsByLine.set(lineY, []);
          }
          itemsByLine.get(lineY)!.push(item);
        }
      }

      // Sort lines by Y position (top to bottom)
      const sortedLines = Array.from(itemsByLine.entries())
        .sort((a, b) => b[0] - a[0]); // Descending Y

      for (const [, items] of sortedLines) {
        // Sort items by X position within the line
        const sortedItems = (items as any[]).sort((a, b) => a.x - b.x);
        const lineText = sortedItems.map((item: any) => item.str).join('');
        pageText.push(lineText);

        // Collect text blocks for feature detection
        for (const item of sortedItems) {
          if ('str' in item) {
            pageBlocks.push({
              x: item.x,
              y: item.y,
              text: (item as any).str,
              fontSize: (item as any).height,
              fontName: (item as any).fontName,
            });
          }
        }
      }

      textBlocksByPage.push(pageBlocks);
      allText += pageText.join('\n') + '\n\n';
    }

    // Detect document features
    const allBlocks = textBlocksByPage.flat();
    const features = detectColumns(allBlocks);
    const hasTableStructure = detectTables(allBlocks);

    console.log('PDF Features detected:', {
      pages: pageCount,
      hasColumns: features.hasColumns,
      estimatedColumns: features.estimatedColumnCount,
      hasTables: hasTableStructure
    });

    // Clean and return text
    return cleanText(allText);
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      'Please ensure pdfjs-dist is installed: npm install pdfjs-dist'
    );
  }
}

/**
 * Validate that extracted text has meaningful content
 */
export function validateExtractedText(text: string, minLength: number = 50): boolean {
  if (!text || text.length < minLength) return false;

  // Check if it's mostly whitespace or special characters
  const alphanumeric = text.match(/[a-zA-Z0-9]/g) || [];
  const alphanumericRatio = alphanumeric.length / text.length;

  return alphanumericRatio > 0.1; // At least 10% alphanumeric content
}
