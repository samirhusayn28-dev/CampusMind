import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.status(200).json({
    status: 'ok',
    service: 'CampusMind API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    integrations: {
      groq: Boolean(process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes('mock')),
      pinecone: Boolean(process.env.PINECONE_API_KEY && !process.env.PINECONE_API_KEY.includes('mock')),
      pineconeIndex: process.env.PINECONE_INDEX || 'campusmind-index',
      googleVision: Boolean(process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_CREDENTIALS_JSON),
    },
  });
}
