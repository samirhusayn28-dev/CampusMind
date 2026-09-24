import { Platform } from 'react-native';
import { ConceptMapData } from '../types/content';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

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
  const response = await fetch(`${BACKEND_URL}/api/extract/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64, fileName }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `PDF extraction failed with status ${response.status}`);
  }

  const data = await response.json();
  const text = (data.text || '').trim();

  if (!text || text.length < 20) {
    throw new Error(
      `Could not extract readable text from "${fileName}". Please ensure the document is not an image-only scan or password-protected.`
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
  const response = await fetch(`${BACKEND_URL}/api/extract/youtube`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `YouTube transcript extraction failed with status ${response.status}`);
  }

  const data = await response.json();
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

// 3. Audio Transcription via Smart Audio Transcription on backend
export async function transcribeAudio(audioBase64: string, fileName: string = 'lecture_recording.m4a'): Promise<ExtractionResult> {
  const response = await fetch(`${BACKEND_URL}/api/extract/audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, fileName }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Audio transcription failed with status ${response.status}`);
  }

  const data = await response.json();
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

// 4. Handwritten Notes OCR via CampusMind Note Scanner on backend
export async function extractOcrText(imageBase64: string): Promise<ExtractionResult> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/extract/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Could not read text from this image. Please try a clearer, well-lit photo.');
    }

    const data = await response.json();
    const text = (data.text || '').trim();

    if (!text || text.length < 10) {
      throw new Error('No readable text found in this photo. Please retake with better lighting and focus.');
    }

    return {
      text,
      wordCount: data.wordCount || text.split(/\s+/).filter(Boolean).length,
      title: 'Handwritten Study Notes',
      detectedLanguages: data.detectedLanguages,
    };
  } catch (error: any) {
    // Zero mock/canned fallbacks: surface clean student error
    throw new Error(error.message || 'Could not read text from this image. Please try a clearer, well-lit photo.');
  }
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
  if (!text || text.trim().length < 20) {
    throw new Error('Content is too short to generate a study summary (minimum 20 characters required).');
  }

  const response = await fetch(`${BACKEND_URL}/api/ai/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, title, contentType }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Summarization failed with status ${response.status}`);
  }

  const data = await response.json();
  if (!data.summary) {
    throw new Error('AI summary could not be generated. Please try again.');
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
  const response = await fetch(`${BACKEND_URL}/api/ai/translate`, {
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
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Translation failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.translation;
}

// 7. Active Recall Quiz Generation via backend
export async function generateQuizContent(
  text: string,
  title?: string,
  summary?: any,
  questionCount: number = 6
): Promise<any[]> {
  const response = await fetch(`${BACKEND_URL}/api/ai/quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      title,
      summary,
      questionCount,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Quiz generation failed with status ${response.status}`);
  }

  const data = await response.json();
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
  const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Study chat failed with status ${response.status}`);
  }

  const data = await response.json();
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
  const response = await fetch(`${BACKEND_URL}/api/ai/concept-map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      title,
      summary,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Concept map generation failed with status ${response.status}`);
  }

  const data = await response.json();
  return {
    nodes: data.nodes || [],
    edges: data.edges || [],
  };
}
