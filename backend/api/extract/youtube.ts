import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  YoutubeTranscript,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
} from 'youtube-transcript';

// Extract 11-character video ID from varied YouTube URL formats
function extractVideoId(url: string): string | null {
  if (!url) return null;
  const cleaned = url.trim();

  // Handle direct 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleaned)) {
    return cleaned;
  }

  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/;
  const match = cleaned.match(regExp);
  return match ? match[1] : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: 'Please enter a valid YouTube video URL.' });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Please enter a valid YouTube video URL.' });
    }

    // 1. Try English first, then fallback to any available caption track
    let transcriptItems: Array<{ text: string; duration: number; offset: number }> | null = null;

    try {
      transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
    } catch (enErr) {
      // English captions not available or failed; attempt fallback to default/any available track
      try {
        transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }

    if (!transcriptItems || transcriptItems.length === 0) {
      return res.status(422).json({
        error: 'This video does not have subtitles or captions enabled. Please try a video with captions, or paste the lecture notes directly.',
      });
    }

    // Assemble continuous transcript text
    const fullText = transcriptItems
      .map((item) => item.text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const wordCount = fullText ? fullText.split(/\s+/).length : 0;

    // Calculate approximate duration from last item
    const lastItem = transcriptItems[transcriptItems.length - 1];
    const durationSeconds = lastItem ? Math.round((lastItem.offset + lastItem.duration) / 1000) : 0;

    return res.status(200).json({
      success: true,
      videoId,
      text: fullText,
      durationSeconds,
      segmentCount: transcriptItems.length,
      wordCount,
    });
  } catch (error: any) {
    console.error('[YouTube Extraction Error]', error);

    const msg = error?.message || '';

    // Categorize errors cleanly
    if (
      error instanceof YoutubeTranscriptTooManyRequestError ||
      msg.includes('too many requests') ||
      msg.includes('captcha')
    ) {
      return res.status(429).json({
        error: 'YouTube is temporarily rate-limiting requests. Please try again in a few minutes or paste the transcript manually.',
      });
    }

    if (
      error instanceof YoutubeTranscriptVideoUnavailableError ||
      msg.includes('no longer available') ||
      msg.includes('private')
    ) {
      return res.status(403).json({
        error: 'This video is private or restricted.',
      });
    }

    if (
      error instanceof YoutubeTranscriptDisabledError ||
      error instanceof YoutubeTranscriptNotAvailableError ||
      error instanceof YoutubeTranscriptNotAvailableLanguageError ||
      msg.includes('Transcript is disabled') ||
      msg.includes('No transcripts are available')
    ) {
      return res.status(422).json({
        error: 'This video does not have subtitles or captions enabled. Please try a video with captions, or paste the lecture notes directly.',
      });
    }

    return res.status(500).json({
      error: 'This video does not have subtitles or captions enabled. Please try a video with captions, or paste the lecture notes directly.',
      details: error.message,
    });
  }
}
