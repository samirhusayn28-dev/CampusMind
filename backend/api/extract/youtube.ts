import type { VercelRequest, VercelResponse } from '@vercel/node';
import { YoutubeTranscript } from 'youtube-transcript';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: 'Missing required YouTube url in request body' });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL or could not parse video ID' });
    }

    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcriptItems || transcriptItems.length === 0) {
      return res.status(404).json({
        error: 'No subtitles or transcript available for this YouTube video.',
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
    return res.status(500).json({
      error: 'Failed to extract transcript from YouTube video',
      details: error.message,
    });
  }
}
