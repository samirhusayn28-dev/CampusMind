import NetInfo from '@react-native-community/netinfo';
import { ConceptMapData } from '../types/content';

/**
 * CampusMind API Client
 * Guaranteed production URL fallback — no localhost or insecure http:// in release builds.
 */
export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL?.trim() || 'https://campusmind-backend.vercel.app';

// Log the exact API base URL for verification
console.log('[CampusMind] Active API Base URL:', BACKEND_URL);

/**
 * Check whether the device is truly connected to the internet.
 * Uses NetInfo so that real backend errors are never falsely reported as "no internet".
 */
export async function isNetworkConnected(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return true; // optimistic fallback
  }
}

/**
 * Filters out raw technical jargon, stack traces, and library names from user-facing error messages.
 * "No technology names in the UI" — friendly and student-centric.
 */
function sanitizeErrorMessage(serverMessage: string, defaultMessage: string): string {
  if (!serverMessage || typeof serverMessage !== 'string') {
    return defaultMessage;
  }

  const technicalTerms = [
    'groq',
    'llama',
    'gpt',
    'qwen',
    'whisper',
    'tesseract',
    'pinecone',
    'vercel',
    'json',
    'model_not_found',
    '404',
    '500',
    '502',
    '503',
    'econnrefused',
    'etimedout',
    'enotfound',
    'stack',
    'api key',
    'exception',
    'failed with status',
    'internal server error',
    'syntaxerror',
  ];

  const lower = serverMessage.toLowerCase();
  const containsJargon = technicalTerms.some((term) => lower.includes(term));
  if (containsJargon) {
    return defaultMessage;
  }

  return serverMessage.trim();
}

/**
 * Core API Request Helper with comprehensive NetInfo offline detection,
 * full console-only logging, 4.5MB Vercel 413 handling, and friendly error mapping.
 */
async function requestBackend<T = any>(
  endpoint: string,
  options: RequestInit,
  actionDescription: string
): Promise<T> {
  // 1. Pre-flight network check
  const onlineBefore = await isNetworkConnected();
  if (!onlineBefore) {
    throw new Error('No internet connection. Please check your network and try again.');
  }

  let response: Response;
  const fullUrl = `${BACKEND_URL}${endpoint}`;

  try {
    response = await fetch(fullUrl, options);
  } catch (fetchErr: any) {
    // 2. Fetch failed — verify if device actually dropped offline
    const isOnline = await isNetworkConnected();
    console.error(`[API Network Exception] ${endpoint}:`, fetchErr);

    if (!isOnline) {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    throw new Error(`Couldn't reach the study service. Please try again in a moment.`);
  }

  // 3. HTTP status verification
  if (!response.ok) {
    const status = response.status;
    let bodyText = '';
    let parsedBody: any = null;

    try {
      bodyText = await response.text();
      parsedBody = JSON.parse(bodyText);
    } catch {
      // Non-JSON response
    }

    // Console-only logging of full technical context
    console.error(`[CampusMind API Error] ${status} ${endpoint}`, {
      status,
      url: fullUrl,
      body: parsedBody || bodyText,
    });

    // Handle 413 Payload Too Large (Vercel ~4.5 MB request body limit)
    if (status === 413) {
      throw new Error('File is too large. Please upload a smaller document or shorter audio recording.');
    }

    // Re-verify network state before showing any generic offline error
    const isOnline = await isNetworkConnected();
    if (!isOnline) {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    const serverMsg = parsedBody?.error || parsedBody?.message || '';

    if (status === 400) {
      throw new Error(
        sanitizeErrorMessage(
          serverMsg,
          `Couldn't process this ${actionDescription}. Please verify your content and try again.`
        )
      );
    }

    if (status === 404) {
      throw new Error(
        sanitizeErrorMessage(serverMsg, 'The requested study resource was not found. Please try again.')
      );
    }

    if (status === 429) {
      throw new Error('High request volume right now. Please wait a few seconds and try again.');
    }

    // Default 500 / other errors
    const friendlyDefault = `Couldn't ${actionDescription}, please try again.`;
    throw new Error(sanitizeErrorMessage(serverMsg, friendlyDefault));
  }

  try {
    return (await response.json()) as T;
  } catch (parseErr: any) {
    console.error(`[CampusMind API Parse Error] ${endpoint}:`, parseErr);
    throw new Error('Invalid response received from study service. Please try again.');
  }
}

export interface ExtractionResult {
  text: string;
  wordCount: number;
  title?: string;
  numPages?: number;
  durationSeconds?: number;
  detectedLanguages?: string[];
}

// 1. PDF Extraction via backend
export async function extractPdfText(fileBase64: string, fileName: string): Promise<ExtractionResult> {
  const data = await requestBackend<any>(
    '/api/extract/pdf',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64, fileName }),
    },
    'extract PDF text'
  );

  const text = (data.text || '').trim();
  if (!text || text.length < 20) {
    throw new Error(
      `No readable text could be extracted from "${fileName}". If it contains scanned images, please take photos and use Camera Scan.`
    );
  }

  return {
    text,
    wordCount: data.wordCount || text.split(/\s+/).filter(Boolean).length,
    title: fileName.replace(/\.pdf$/i, ''),
    numPages: data.numPages,
  };
}

// 2. YouTube Transcript Extraction via backend
export async function extractYouTubeTranscript(url: string): Promise<ExtractionResult> {
  const data = await requestBackend<any>(
    '/api/extract/youtube',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    },
    'extract YouTube transcript'
  );

  const text = (data.text || '').trim();
  if (!text || text.length < 20) {
    throw new Error('No transcript could be extracted from this YouTube video. Please verify English captions are enabled.');
  }

  return {
    text,
    wordCount: data.wordCount || text.split(/\s+/).filter(Boolean).length,
    title: data.title || `YouTube Lecture (${data.videoId || 'Video'})`,
    durationSeconds: data.durationSeconds,
  };
}

// 3. Audio Transcription via backend
export async function transcribeAudio(
  audioBase64: string,
  fileName: string = 'lecture_recording.m4a'
): Promise<ExtractionResult> {
  const data = await requestBackend<any>(
    '/api/extract/audio',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, fileName }),
    },
    'transcribe audio'
  );

  const text = (data.text || '').trim();
  if (!text || text.length < 10) {
    throw new Error('No speech was detected in this recording. Please try recording again closer to the speaker.');
  }

  return {
    text,
    wordCount: data.wordCount || text.split(/\s+/).filter(Boolean).length,
    title: 'Live Audio Recording',
    durationSeconds: data.durationSeconds,
  };
}

// 4. Handwritten Notes OCR via backend
export async function extractOcrText(imageBase64: string): Promise<ExtractionResult> {
  const data = await requestBackend<any>(
    '/api/extract/ocr',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    },
    'read handwritten notes'
  );

  const text = (data.text || '').trim();
  if (!text || text.length < 10) {
    throw new Error("Couldn't read this photo, try better lighting and clearer handwriting.");
  }

  return {
    text,
    wordCount: data.wordCount || text.split(/\s+/).filter(Boolean).length,
    title: 'Handwritten Study Notes',
    detectedLanguages: data.detectedLanguages,
  };
}

// 5. CampusMind AI Summarization via backend
export interface SummarizeResponse {
  title: string;
  overview: string;
  keyPoints: string[];
  headings: { title: string; points: string[] }[];
  fullSummary: string;
}

export async function summarizeContent(
  text: string,
  title?: string,
  contentType: string = 'lecture'
): Promise<SummarizeResponse> {
  const trimmed = (text || '').trim();
  if (!trimmed || trimmed.length < 20) {
    throw new Error("We couldn't extract enough readable text from this material to summarize. Please provide clearer notes.");
  }

  const data = await requestBackend<any>(
    '/api/ai/summarize',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed, title, contentType }),
    },
    'generate the summary'
  );

  if (!data.summary) {
    throw new Error("Couldn't generate the summary, try again.");
  }

  return data.summary;
}

// 6. Bilingual Translation via backend (Roman Urdu & Urdu)
export async function translateSummaryContent(
  summary: {
    title?: string;
    overview: string;
    keyPoints: string[];
    headings: { title: string; points: string[] }[];
    fullSummary?: string;
  },
  targetLang: 'roman_urdu' | 'urdu'
): Promise<any> {
  const data = await requestBackend<any>(
    '/api/ai/translate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: summary.title,
        overview: summary.overview,
        keyPoints: summary.keyPoints,
        headings: summary.headings,
        fullSummary: summary.fullSummary,
        targetLang,
      }),
    },
    'translate summary'
  );

  return data.translation;
}

// 7. Active Recall Quiz Generation via backend
export async function generateQuizContent(
  text: string,
  title?: string,
  summary?: any,
  questionCount: number = 6
): Promise<any[]> {
  const data = await requestBackend<any>(
    '/api/ai/quiz',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        title,
        summary,
        questionCount,
      }),
    },
    'generate practice quiz'
  );

  return data.questions || [];
}

// 8. RAG-based Study Chat via backend
export interface RagChatResponse {
  reply: string;
  sources: {
    chunkIndex: number;
    textSnippet: string;
    score: number;
  }[];
}

export async function askStudyChat(params: {
  message: string;
  materialId?: string;
  materialTitle?: string;
  materialText?: string;
  materialSummary?: any;
  history?: { role: 'user' | 'assistant'; content: string }[];
  language?: 'en' | 'roman_urdu' | 'urdu';
}): Promise<RagChatResponse> {
  const data = await requestBackend<any>(
    '/api/ai/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    'answer your question'
  );

  return {
    reply: data.reply || 'No response generated.',
    sources: data.sources || [],
  };
}

// 9. Concept Map Generation via backend
export async function generateConceptMapContent(
  text: string,
  title?: string,
  summary?: any
): Promise<ConceptMapData> {
  const data = await requestBackend<any>(
    '/api/ai/concept-map',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        title,
        summary,
      }),
    },
    'generate concept map'
  );

  return {
    nodes: data.nodes || [],
    edges: data.edges || [],
  };
}
