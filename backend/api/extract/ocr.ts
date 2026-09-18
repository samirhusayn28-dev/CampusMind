import type { VercelRequest, VercelResponse } from '@vercel/node';
import vision from '@google-cloud/vision';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64 } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body' });
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // Priority 1: Google Cloud Vision API Key (recommended for serverless Vercel)
    const visionApiKey = process.env.GOOGLE_VISION_API_KEY;
    if (visionApiKey && !visionApiKey.includes('mock')) {
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

      if (!response.ok) {
        const errText = await response.text();
        console.error('[Vision OCR REST Error]', response.status, errText);
        throw new Error(`Google Vision API error (${response.status}): ${errText}`);
      }

      const data = (await response.json()) as any;
      const firstResponse = data?.responses?.[0] || {};
      const fullTextAnnotation = firstResponse.fullTextAnnotation;
      const extractedText = fullTextAnnotation && fullTextAnnotation.text
        ? fullTextAnnotation.text.trim()
        : (firstResponse.textAnnotations && firstResponse.textAnnotations[0]?.description
          ? firstResponse.textAnnotations[0].description.trim()
          : '');

      const wordCount = extractedText ? extractedText.split(/\s+/).length : 0;
      const detectedLanguages = fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages || [];

      return res.status(200).json({
        success: true,
        text: extractedText,
        wordCount,
        detectedLanguages,
      });
    }

    // Priority 2: Google Cloud Service Account JSON (ImageAnnotatorClient)
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      const buffer = Buffer.from(cleanBase64, 'base64');
      const client = getVisionClient();
      const [result] = await client.documentTextDetection({
        image: { content: buffer },
      });

      const fullTextAnnotation = result.fullTextAnnotation;
      const extractedText = fullTextAnnotation && fullTextAnnotation.text
        ? fullTextAnnotation.text.trim()
        : (result.textAnnotations && result.textAnnotations[0]?.description
          ? result.textAnnotations[0].description.trim()
          : '');

      const wordCount = extractedText ? extractedText.split(/\s+/).length : 0;

      return res.status(200).json({
        success: true,
        text: extractedText,
        wordCount,
        detectedLanguages: fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages || [],
      });
    }

    // Fallback: When no keys are configured, return helpful mock/guide
    console.warn('[Vision OCR] Neither GOOGLE_VISION_API_KEY nor GOOGLE_CREDENTIALS_JSON found. Using simulated OCR response.');
    return res.status(200).json({
      success: true,
      text: '[Simulated OCR Output: Please set GOOGLE_VISION_API_KEY on Vercel to extract live handwriting.]\n\nChapter 4: Neural Networks\n- Backpropagation computes gradient of loss\n- Activation functions introduce non-linearity\n- Learning rate governs convergence speed',
      wordCount: 30,
      detectedLanguages: [{ languageCode: 'en' }],
    });
  } catch (error: any) {
    console.error('[Vision OCR Error]', error);
    return res.status(500).json({
      error: 'Failed to extract text from handwritten notes photo via Google Cloud Vision',
      details: error.message,
    });
  }
}
