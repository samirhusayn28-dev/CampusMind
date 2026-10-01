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

// Regex matching acceptable human-readable characters across all languages:
// - Letters (\p{L}), Numbers (\p{N}), Punctuation (\p{P}), Symbols (\p{S}), Whitespace (\s)
const READABLE_CHAR_REGEX = /^[\p{L}\p{N}\p{P}\p{S}\s]$/u;

// Regex matching alphanumeric characters in any language
const ALPHANUMERIC_CHAR_REGEX = /[\p{L}\p{N}]/u;

// Recognized markdown structural tokens that are valid in tables/lists/formatting
const MARKDOWN_TOKEN_REGEX = /^(\|+|-+|\*+|\++|#+|>+|={2,}|_{2,}|:?-+:?)$/;

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

  // 0. Binary control characters check (indicates raw binary or uncompressed byte dump)
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(trimmed)) {
    return {
      readable: false,
      readableRatio: 0,
      replacementRatio: 0,
      wordCoherenceRatio: 0,
      reason: 'Text contains illegal binary control characters.',
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

  // 4. Mojibake Latin-1 supplement stream noise check (compressed stream binary bytes decoded as Latin-1)
  const latin1Count = (trimmed.match(/[\u0080-\u00FF]/g) || []).length;
  const latin1Ratio = latin1Count / totalCount;
  if (latin1Ratio > 0.08) {
    return {
      readable: false,
      readableRatio,
      replacementRatio,
      wordCoherenceRatio: 0,
      reason: `Corrupted stream character density (${Math.round(latin1Ratio * 100)}%) indicates binary stream noise rather than human-readable text.`,
    };
  }

  // 5. Interleaved letter-digit-symbol noise check (e.g. Ù9, Ã9, â?§)
  const interleavedNoise = (trimmed.match(/[\p{L}][0-9][\p{L}]|[0-9][\p{L}][0-9]|[\u0080-\u00FF][\p{P}\p{S}]/gu) || []).length;
  if (interleavedNoise >= 2 && (interleavedNoise * 2) / totalCount > 0.05) {
    return {
      readable: false,
      readableRatio,
      replacementRatio,
      wordCoherenceRatio: 0,
      reason: 'Document consists of interleaved binary noise and symbol fragments.',
    };
  }

  // 6. Word coherence check: tokens should contain words, numbers, or valid structure tokens rather than binary noise
  const words = trimmed.split(/\s+/).filter((w) => w.length >= 1);
  if (words.length >= 1) {
    const coherentWords = words.filter(
      (w) => ALPHANUMERIC_CHAR_REGEX.test(w) || MARKDOWN_TOKEN_REGEX.test(w)
    ).length;
    const wordCoherenceRatio = coherentWords / words.length;

    if (wordCoherenceRatio < 0.5) {
      return {
        readable: false,
        readableRatio,
        replacementRatio,
        wordCoherenceRatio,
        reason: `Word coherence ratio (${Math.round(wordCoherenceRatio * 100)}%) is too low; document consists primarily of corrupted symbol clusters.`,
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
