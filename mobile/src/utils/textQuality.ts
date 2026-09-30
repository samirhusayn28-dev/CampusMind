/**
 * Text Quality Assessment Utility for Mobile
 * Evaluates whether extracted text is legible, cohesive, and authentic human-readable content
 * (printable ASCII, typography, math/currency, and Arabic/Urdu Unicode ranges)
 * rather than garbled binary stream noise or unmapped font glyph IDs.
 */

export interface TextQualityResult {
  readable: boolean;
  readableRatio: number;
  replacementRatio: number;
  wordCoherenceRatio: number;
  reason?: string;
}

const READABLE_CHAR_REGEX = /^[a-zA-Z0-9\s.,:;!?'"`~@#$%^&*-_+=/\\|()[\]{}<>«»“”‘’…—–•±×÷=≠≈≤≥°€£¥₹₨\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]$/;
const LETTER_CHAR_REGEX = /[a-zA-Z\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function isTextReadable(text: string | null | undefined): TextQualityResult {
  if (!text || typeof text !== 'string') {
    return {
      readable: false,
      readableRatio: 0,
      replacementRatio: 0,
      wordCoherenceRatio: 0,
      reason: 'Text is empty or missing.',
    };
  }

  const trimmed = text.trim();
  if (trimmed.length < 20) {
    return {
      readable: false,
      readableRatio: 0,
      replacementRatio: 0,
      wordCoherenceRatio: 0,
      reason: 'Text contains less than 20 characters of content.',
    };
  }

  let readableCount = 0;
  let replacementCount = 0;
  const totalCount = trimmed.length;

  for (let i = 0; i < totalCount; i++) {
    const char = trimmed[i];
    if (char === '\uFFFD') {
      replacementCount++;
    }
    if (READABLE_CHAR_REGEX.test(char)) {
      readableCount++;
    }
  }

  const readableRatio = readableCount / totalCount;
  const replacementRatio = replacementCount / totalCount;

  // 1. Ratio check: readable characters should be at least 65% of total
  if (readableRatio < 0.65) {
    return {
      readable: false,
      readableRatio,
      replacementRatio,
      wordCoherenceRatio: 0,
      reason: `Readable character ratio (${Math.round(readableRatio * 100)}%) is below acceptable threshold (65%).`,
    };
  }

  // 2. Replacement character check: corrupted Unicode glyphs should not exceed 3%
  if (replacementRatio > 0.03) {
    return {
      readable: false,
      readableRatio,
      replacementRatio,
      wordCoherenceRatio: 0,
      reason: `Corrupted replacement character ratio (${Math.round(replacementRatio * 100)}%) exceeds acceptable limit (3%).`,
    };
  }

  // 3. CID font glyph codes check: documents with unmapped font glyph IDs (e.g. (cid:124))
  const cidMatches = (trimmed.match(/\(?cid:\s*\d+\)?/gi) || []).length;
  if (cidMatches >= 3 && (cidMatches * 7) / totalCount > 0.15) {
    return {
      readable: false,
      readableRatio,
      replacementRatio,
      wordCoherenceRatio: 0,
      reason: 'Text consists of unmapped font glyph codes (CID) rather than legible characters.',
    };
  }

  // 4. Word coherence check: tokens should largely contain letters rather than random symbol strings
  const words = trimmed.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length >= 5) {
    const coherentWords = words.filter((w) => LETTER_CHAR_REGEX.test(w)).length;
    const wordCoherenceRatio = coherentWords / words.length;

    if (wordCoherenceRatio < 0.40) {
      return {
        readable: false,
        readableRatio,
        replacementRatio,
        wordCoherenceRatio,
        reason: `Word coherence ratio (${Math.round(wordCoherenceRatio * 100)}%) is too low; document consists primarily of non-alphabetic symbol clusters.`,
      };
    }

    return {
      readable: true,
      readableRatio,
      replacementRatio,
      wordCoherenceRatio,
    };
  }

  return {
    readable: true,
    readableRatio,
    replacementRatio,
    wordCoherenceRatio: 1,
  };
}

/**
 * Returns clean sanitized preview text or fallback placeholder if the text is garbled.
 */
export function getSafeTextPreview(text: string | null | undefined, maxLength: number = 160): string {
  if (!text) return '';
  const quality = isTextReadable(text);
  if (!quality.readable) {
    return 'Text could not be previewed (unreadable formatting or scanned document)';
  }
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength) + '...';
}
