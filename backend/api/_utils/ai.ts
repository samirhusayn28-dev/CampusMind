/**
 * AI Models and Response Utilities for CampusMind
 * Centralizes model identifiers with environment variable overrides and safe fallbacks.
 */

export const GROQ_MODELS = {
  get text(): string {
    return process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-120b';
  },
  get vision(): string {
    return process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';
  },
  get stt(): string {
    return process.env.GROQ_STT_MODEL || 'whisper-large-v3';
  },
};

/**
 * Strips reasoning tokens or tags such as <think>...</think> or <thought>...</thought>
 */
export function stripReasoning(text: string): string {
  if (!text) return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .trim();
}

/**
 * Extracts and safely parses JSON from model output that might contain
 * markdown code fences, reasoning text, or leading/trailing commentary.
 */
export function extractJson<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Cannot extract JSON from empty content');
  }

  // 1. Strip reasoning blocks
  let cleaned = stripReasoning(rawText);

  // 2. Strip markdown fences: ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // 3. Try direct JSON.parse
  try {
    return JSON.parse(cleaned) as T;
  } catch (initialErr) {
    // 4. Try extracting from outermost '{' to '}' or '[' to ']'
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // Fall through to regex cleaning
      }
    }

    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const candidate = cleaned.slice(firstBracket, lastBracket + 1);
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // Fall through
      }
    }

    // 5. Try fixing common issues like trailing commas before closing braces/brackets and smart quotes
    const sanitized = cleaned
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");

    const fb = sanitized.indexOf('{');
    const lb = sanitized.lastIndexOf('}');
    if (fb !== -1 && lb > fb) {
      try {
        return JSON.parse(sanitized.slice(fb, lb + 1)) as T;
      } catch {
        // Fall through
      }
    }

    throw new Error(`Failed to parse AI JSON response: ${(initialErr as Error).message}`);
  }
}
