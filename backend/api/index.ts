import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.status(200).json({
    name: 'CampusMind Serverless API',
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      summarize: '/api/ai/summarize',
      chat: '/api/ai/chat',
      quiz: '/api/ai/quiz',
      translate: '/api/ai/translate',
      conceptMap: '/api/ai/concept-map',
      extractPdf: '/api/extract/pdf',
      extractYouTube: '/api/extract/youtube',
      extractAudio: '/api/extract/audio',
      extractOcr: '/api/extract/ocr',
    },
  });
}
