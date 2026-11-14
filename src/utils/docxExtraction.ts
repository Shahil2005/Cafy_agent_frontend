/**
 * DOCX Text Extraction Utility
 * 
 * Extracts text from DOCX files (which are ZIP archives containing XML files)
 * with support for headers, footers, textboxes, and formatting detection
 * Uses both Mammoth library (if available) and direct XML parsing
 */

/**
 * Decode XML entities
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([\dA-Fa-f]+);/g, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Extract text from XML using regex patterns
 */
function extractTextFromXML(xml: string): string {
  const paragraphs: string[] = [];

  // Split by paragraph tags
  const paragraphMatches = xml.matchAll(/<w:p[^>]*>.*?<\/w:p>/gs);

  for (const match of paragraphMatches) {
    const paragraphXML = match[0];
    const textRuns: string[] = [];

    // Find all text tags within this paragraph
    const textMatches = paragraphXML.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);

    for (const textMatch of textMatches) {
      const text = decodeXmlEntities(textMatch[1]);
      if (text.trim()) {
        textRuns.push(text);
      }
    }

    if (textRuns.length > 0) {
      paragraphs.push(textRuns.join(''));
    }
  }

  return paragraphs.join('\n');
}

/**
 * Formatting issues detected in DOCX
 */
interface FormattingIssues {
  hasImages: boolean;
  tableCount: number;
  hasMultipleColumns: boolean;
  hasJustifiedText: boolean;
  nonStandardPageSize: boolean;
}

/**
 * Detect formatting issues in DOCX XML
 */
function detectFormattingIssues(xml: string): FormattingIssues {
  return {
    hasImages: /(<w:drawing>|<w:pict>|<a:blip>)/i.test(xml),
    tableCount: (xml.match(/<w:tbl>/gi) || []).length,
    hasMultipleColumns: /<w:cols[^>]*\s+num="[2-9]"/i.test(xml),
    hasJustifiedText: /<w:jc[^>]*w:val="(both|center)"/.test(xml),
    nonStandardPageSize: !/w:pgSz[^>]*w:w="12240"[^>]*w:h="15840"|w:pgSz[^>]*w:w="11906"[^>]*w:h="16838"/.test(xml),
  };
}

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
  // Replace multiple spaces with single space
  let cleaned = text.replace(/ {2,}/g, ' ');

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
 * Extract text from DOCX using Mammoth library
 * Requires: npm install mammoth
 */
async function extractWithMammoth(arrayBuffer: ArrayBuffer): Promise<string | null> {
  try {
    let mammoth: any;
    try {
      mammoth = await import(/* @vite-ignore */ 'mammoth');
    } catch (error) {
      console.warn('Mammoth not installed, using XML parsing instead');
      return null;
    }
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || null;
  } catch (error) {
    console.warn('Mammoth extraction failed, falling back to XML parsing:', error);
    return null;
  }
}

/**
 * Extract specific XML content from DOCX
 * DOCX files are ZIP archives, so we need JSZip to read them
 */
async function extractXMLFromDocx(arrayBuffer: ArrayBuffer, filePath: string): Promise<string> {
  try {
    let JSZip: any;
    try {
      JSZip = (await import(/* @vite-ignore */ 'jszip')).default;
    } catch (error) {
      throw new Error('jszip is not installed. Please install it: npm install jszip');
    }
    const zip = new JSZip();
    await zip.loadAsync(arrayBuffer);

    const file = zip.file(filePath);
    if (!file) return '';

    const content = await file.async('text');
    return content;
  } catch (error) {
    console.warn(`Failed to extract ${filePath} from DOCX:`, error);
    return '';
  }
}

/**
 * Extract headers from DOCX
 */
async function extractHeaders(arrayBuffer: ArrayBuffer): Promise<string> {
  const headers: string[] = [];

  for (let i = 1; i <= 3; i++) {
    const headerXML = await extractXMLFromDocx(arrayBuffer, `word/header${i}.xml`);
    if (headerXML) {
      const headerText = extractTextFromXML(headerXML);
      if (headerText.trim()) {
        headers.push(headerText);
      }
    }
  }

  return headers.join('\n\n');
}

/**
 * Extract footers from DOCX
 */
async function extractFooters(arrayBuffer: ArrayBuffer): Promise<string> {
  const footers: string[] = [];

  for (let i = 1; i <= 3; i++) {
    const footerXML = await extractXMLFromDocx(arrayBuffer, `word/footer${i}.xml`);
    if (footerXML) {
      const footerText = extractTextFromXML(footerXML);
      if (footerText.trim()) {
        footers.push(footerText);
      }
    }
  }

  return footers.join('\n\n');
}

/**
 * Extract textboxes from DOCX
 */
async function extractTextboxes(documentXML: string): Promise<string> {
  const textboxes: string[] = [];

  // Look for textbox content tags
  const textboxMatches = documentXML.matchAll(/<w:txbxContent>.*?<\/w:txbxContent>/gs);

  for (const match of textboxMatches) {
    const content = match[0];
    const text = extractTextFromXML(content);
    if (text.trim()) {
      textboxes.push(text);
    }
  }

  return textboxes.join('\n\n');
}

/**
 * Extract main document content from DOCX
 */
async function extractMainContent(arrayBuffer: ArrayBuffer): Promise<string> {
  const documentXML = await extractXMLFromDocx(arrayBuffer, 'word/document.xml');
  return extractTextFromXML(documentXML);
}

/**
 * Extract text from DOCX file
 * 
 * Supports extraction from:
 * - Main document content
 * - Headers (up to 3)
 * - Footers (up to 3)
 * - Textboxes
 * - Direct XML parsing for complex structures
 * 
 * Requires: npm install mammoth jszip (or just jszip for XML-only extraction)
 */
export async function extractTextFromDOCX(arrayBuffer: ArrayBuffer): Promise<string> {
  try {

    // Try Mammoth first (cleaner output)
    let mammothText = await extractWithMammoth(arrayBuffer);

    if (mammothText && mammothText.trim().length > 50) {
      return cleanText(mammothText);
    }

    // Fall back to manual XML extraction
    console.log('Using XML-based extraction for DOCX');

    // Extract from all sources
    const [headers, mainContent, footers, textboxes] = await Promise.all([
      extractHeaders(arrayBuffer),
      extractMainContent(arrayBuffer),
      extractFooters(arrayBuffer),
      (async () => {
        const docXML = await extractXMLFromDocx(arrayBuffer, 'word/document.xml');
        return extractTextboxes(docXML);
      })(),
    ]);

    // Get document XML for formatting detection
    const documentXML = await extractXMLFromDocx(arrayBuffer, 'word/document.xml');
    const formattingIssues = detectFormattingIssues(documentXML);

    console.log('DOCX Formatting issues detected:', formattingIssues);

    // Combine all content in order: headers, content, textboxes, footers
    const allContent = [headers, mainContent, textboxes, footers]
      .filter(text => text.trim())
      .join('\n\n');

    if (!allContent.trim()) {
      throw new Error('No text content found in DOCX file');
    }

    return cleanText(allContent);
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error(
      `Failed to extract text from DOCX: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      'Please ensure jszip is installed: npm install jszip'
    );
  }
}

/**
 * Extract text from DOC file (legacy format)
 * 
 * DOC files are binary Microsoft Word format files.
 * For browser-based extraction, we recommend converting to DOCX.
 * 
 * This function provides error handling guidance.
 */
export async function extractTextFromDOC(_arrayBuffer: ArrayBuffer): Promise<string> {
  throw new Error(
    'DOC file extraction is not supported in browser environment. ' +
    'Please convert your DOC file to DOCX or PDF format. ' +
    'You can do this using Microsoft Word, LibreOffice, or online conversion tools.'
  );
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

