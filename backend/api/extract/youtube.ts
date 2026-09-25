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

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

interface CaptionTrackInfo {
  baseUrl: string;
  languageCode: string;
  name?: { simpleText?: string };
  kind?: string;
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ANDROID_USER_AGENT = 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)';

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTimedTextXml(xml: string): TranscriptSegment[] {
  const items: TranscriptSegment[] = [];

  // Format 3: <p t="ms" d="ms">...<s>words</s>...</p>
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRegex.exec(xml)) !== null) {
    const rawText = pMatch[3].replace(/<[^>]+>/g, '').trim();
    if (rawText) {
      items.push({
        text: decodeHtmlEntities(rawText),
        offset: parseInt(pMatch[1], 10),
        duration: parseInt(pMatch[2], 10),
      });
    }
  }

  // Format 1 / classic: <text start="s" dur="s">...</text>
  if (items.length === 0) {
    const textRegex = /<text\s+start="([^"]*)"\s+dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = textRegex.exec(xml)) !== null) {
      const rawText = tMatch[3].replace(/<[^>]+>/g, '').trim();
      if (rawText) {
        items.push({
          text: decodeHtmlEntities(rawText),
          offset: Math.round(parseFloat(tMatch[1]) * 1000),
          duration: Math.round(parseFloat(tMatch[2]) * 1000),
        });
      }
    }
  }

  return items;
}

// Select best caption track prioritizing English manual -> English auto -> Any manual -> Any auto
function selectBestTrack(tracks: CaptionTrackInfo[]): CaptionTrackInfo | null {
  if (!tracks || tracks.length === 0) return null;

  // 1. English manual track
  const enManual = tracks.find(
    (t) => (t.languageCode === 'en' || t.languageCode?.startsWith('en-')) && t.kind !== 'asr'
  );
  if (enManual) return enManual;

  // 2. English auto-generated (ASR) track
  const enAsr = tracks.find((t) => t.languageCode === 'en' || t.languageCode?.startsWith('en-'));
  if (enAsr) return enAsr;

  // 3. Any manual track in any language
  const anyManual = tracks.find((t) => t.kind !== 'asr');
  if (anyManual) return anyManual;

  // 4. Default to first available track
  return tracks[0];
}

// Tier 1: YouTube InnerTube Android API
async function fetchCaptionsViaInnerTube(videoId: string): Promise<{
  tracks: CaptionTrackInfo[];
  title?: string;
  author?: string;
} | null> {
  try {
    const resp = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': ANDROID_USER_AGENT,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '20.10.38',
          },
        },
        videoId,
      }),
    });

    if (!resp.ok) return null;

    const data = (await resp.json()) as any;
    const playability = data?.playabilityStatus?.status;
    if (playability && playability !== 'OK') {
      if (playability === 'UNPLAYABLE' || playability === 'LOGIN_REQUIRED') {
        return null;
      }
    }

    const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    const title = data?.videoDetails?.title;
    const author = data?.videoDetails?.author;

    if (Array.isArray(captionTracks) && captionTracks.length > 0) {
      return { tracks: captionTracks, title, author };
    }
    return { tracks: [], title, author };
  } catch (err) {
    console.warn('[InnerTube Extraction Warning]:', err);
    return null;
  }
}

// Extract a JSON array from a string matching key with balanced bracket parsing
function extractJsonArray(source: string, key: string): any[] | null {
  const keyIdx = source.indexOf(key);
  if (keyIdx === -1) return null;

  const startBracket = source.indexOf('[', keyIdx + key.length);
  if (startBracket === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startBracket; i < source.length; i++) {
    const char = source[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '[') depth++;
      else if (char === ']') {
        depth--;
        if (depth === 0) {
          const jsonStr = source.slice(startBracket, i + 1);
          try {
            return JSON.parse(jsonStr);
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

// Tier 2: HTML Page Scraper (ytInitialPlayerResponse fallback)
async function fetchCaptionsViaWebPage(videoId: string): Promise<{
  tracks: CaptionTrackInfo[];
  title?: string;
} | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return null;

    const html = await res.text();
    if (html.includes('class="g-recaptcha"')) {
      throw new Error('CAPTCHA_REQUIRED');
    }

    // Depth-matched parser for captionTracks
    let tracks: CaptionTrackInfo[] = extractJsonArray(html, '"captionTracks"') || [];

    let title: string | undefined;
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    if (titleMatch) {
      title = decodeHtmlEntities(titleMatch[1].replace(/ - YouTube$/, ''));
    }

    return { tracks, title };
  } catch (err: any) {
    if (err?.message === 'CAPTCHA_REQUIRED') throw err;
    console.warn('[Web Scraping Warning]:', err);
    return null;
  }
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
      return res.status(400).json({
        error: 'Invalid YouTube URL. Please paste a standard lecture link (e.g., https://youtu.be/...)',
      });
    }

    let transcriptItems: TranscriptSegment[] | null = null;
    let videoTitle: string | undefined;

    // 1. Tier 1: InnerTube Android API
    const innerTubeResult = await fetchCaptionsViaInnerTube(videoId);
    let tracks = innerTubeResult?.tracks || [];
    if (innerTubeResult?.title) videoTitle = innerTubeResult.title;

    // 2. Tier 2: HTML Page Scraper if no tracks from InnerTube
    if (tracks.length === 0) {
      const webResult = await fetchCaptionsViaWebPage(videoId);
      if (webResult && webResult.tracks.length > 0) {
        tracks = webResult.tracks;
        if (!videoTitle && webResult.title) videoTitle = webResult.title;
      }
    }

    // 3. Extract and parse timedtext XML if tracks available
    if (tracks.length > 0) {
      const bestTrack = selectBestTrack(tracks);
      if (bestTrack && bestTrack.baseUrl) {
        try {
          const xmlRes = await fetch(bestTrack.baseUrl, {
            headers: { 'User-Agent': USER_AGENT },
          });
          if (xmlRes.ok) {
            const xml = await xmlRes.text();
            const parsed = parseTimedTextXml(xml);
            if (parsed.length > 0) {
              transcriptItems = parsed;
            }
          }
        } catch (fetchErr) {
          console.warn('[TimedText XML Fetch Warning]:', fetchErr);
        }
      }
    }

    // 4. Tier 3: youtube-transcript package fallback
    if (!transcriptItems || transcriptItems.length === 0) {
      try {
        const libItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
        if (libItems && libItems.length > 0) {
          transcriptItems = libItems.map((item) => ({
            text: decodeHtmlEntities(item.text),
            offset: item.offset,
            duration: item.duration,
          }));
        }
      } catch {
        try {
          const fallbackLib = await YoutubeTranscript.fetchTranscript(videoId);
          if (fallbackLib && fallbackLib.length > 0) {
            transcriptItems = fallbackLib.map((item) => ({
              text: decodeHtmlEntities(item.text),
              offset: item.offset,
              duration: item.duration,
            }));
          }
        } catch {
          // Fallback failed
        }
      }
    }

    if (!transcriptItems || transcriptItems.length === 0) {
      return res.status(422).json({
        error:
          'This video does not have closed captions or subtitles enabled by its creator. Please try a video with captions, or paste your lecture notes directly.',
      });
    }

    // Assemble continuous transcript text
    const fullText = transcriptItems
      .map((item) => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const wordCount = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;

    // Calculate approximate duration from last item
    const lastItem = transcriptItems[transcriptItems.length - 1];
    const durationSeconds = lastItem ? Math.round((lastItem.offset + lastItem.duration) / 1000) : 0;

    return res.status(200).json({
      success: true,
      videoId,
      title: videoTitle || `YouTube Lecture (${videoId})`,
      text: fullText,
      durationSeconds,
      segmentCount: transcriptItems.length,
      wordCount,
    });
  } catch (error: any) {
    console.error('[YouTube Extraction Error]', error);

    const msg = error?.message || '';

    if (
      error instanceof YoutubeTranscriptTooManyRequestError ||
      msg.includes('CAPTCHA_REQUIRED') ||
      msg.includes('too many requests') ||
      msg.includes('captcha')
    ) {
      return res.status(429).json({
        error:
          'YouTube is temporarily rate-limiting requests. Please try again in a few minutes or paste the transcript manually.',
      });
    }

    if (
      error instanceof YoutubeTranscriptVideoUnavailableError ||
      msg.includes('no longer available') ||
      msg.includes('private')
    ) {
      return res.status(403).json({
        error: 'This video is private, age-restricted, or no longer available.',
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
        error:
          'This video does not have subtitles or captions enabled. Please try a video with captions, or paste the lecture notes directly.',
      });
    }

    return res.status(500).json({
      error: 'Could not extract lecture transcript from YouTube. Please verify the link or paste the text directly.',
      details: error.message,
    });
  }
}
