import type { VercelRequest, VercelResponse } from '@vercel/node';
import vision from '@google-cloud/vision';
import Groq from 'groq-sdk';
import { GROQ_MODELS, stripReasoning } from '../_utils/ai.js';

// Optional Vision Client for Service Account credentials
let visionClient: any = null;
function getVisionClient() {
  if (!visionClient) {
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
        visionClient = new vision.ImageAnnotatorClient({ credentials });
      } catch (e) {
        console.warn('[Vision OCR] Could not parse GOOGLE_CREDENTIALS_JSON, using default client');
        visionClient = new vision.ImageAnnotatorClient();
      }
    } else {
      visionClient = new vision.ImageAnnotatorClient();
    }
  }
  return visionClient;
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64 } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Missing imageBase64 in request body' });
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '').trim();
    if (!cleanBase64) {
      return res.status(400).json({ error: 'Empty image data provided' });
    }

    let extractedText = '';
    let detectedLanguages: any[] = [];

    // Step 1: Try Google Cloud Vision DOCUMENT_TEXT_DETECTION via REST API Key
    const visionApiKey = process.env.GOOGLE_VISION_API_KEY;
    if (visionApiKey && !visionApiKey.includes('mock')) {
      try {
        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [
              {
                image: { content: cleanBase64 },
                features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              },
            ],
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          const firstResponse = data?.responses?.[0] || {};
          const fullTextAnnotation = firstResponse.fullTextAnnotation;
          extractedText = fullTextAnnotation?.text?.trim() ||
            firstResponse.textAnnotations?.[0]?.description?.trim() ||
            '';
          detectedLanguages = fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages || [];
        } else {
          console.warn('[Vision OCR REST Error]', response.status);
        }
      } catch (err: any) {
        console.warn('[Vision OCR REST failed, trying alternative methods]:', err.message);
      }
    }

    // Step 2: Try Service Account client if still empty
    if (!extractedText && process.env.GOOGLE_CREDENTIALS_JSON) {
      try {
        const buffer = Buffer.from(cleanBase64, 'base64');
        const client = getVisionClient();
        const [result] = await client.documentTextDetection({
          image: { content: buffer },
        });

        const fullTextAnnotation = result.fullTextAnnotation;
        extractedText = fullTextAnnotation?.text?.trim() ||
          result.textAnnotations?.[0]?.description?.trim() ||
          '';
        detectedLanguages = fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages || [];
      } catch (err: any) {
        console.warn('[Vision Client OCR failed, trying vision model fallback]:', err.message);
      }
    }

    // Step 3: High-Yield Fallback to Vision LLM (reads handwritten notes, math formulas, cursive)
    if (!extractedText && process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes('mock')) {
      try {
        const visionResponse = await groq.chat.completions.create({
          model: GROQ_MODELS.vision,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Transcribe all handwritten and printed text, equations, math formulas (e.g. factorials, fractions), diagrams, and bullet points from this student notes image with exact fidelity. Do not explain, summarize, or add introductory words. Return ONLY the transcribed text as written in the photo.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${cleanBase64}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 2048,
        });

        const rawContent = visionResponse.choices[0]?.message?.content || '';
        extractedText = stripReasoning(rawContent).trim();
      } catch (visionErr: any) {
        console.warn('[Groq Vision OCR failed]:', visionErr.message);
      }
    }

    // Step 4: Strict validation — NEVER return empty or fake text
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({
        error: "Couldn't read this photo, try better lighting and clearer handwriting.",
        text: '',
        wordCount: 0,
      });
    }

    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;

    return res.status(200).json({
      success: true,
      text: extractedText,
      wordCount,
      detectedLanguages,
    });
  } catch (error: any) {
    console.error('[Vision OCR Error]', error);
    return res.status(500).json({
      error: "Couldn't process this photo. Please try with better lighting.",
      details: error.message,
    });
  }
}
