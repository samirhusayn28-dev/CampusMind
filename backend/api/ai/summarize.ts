import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { GROQ_MODELS, extractJson } from '../_utils/ai.js';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

interface SummarizeRequestBody {
  text: string;
  title?: string;
  contentType?: string;
  educationLevel?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      text,
      title,
      contentType = 'lecture',
      educationLevel = 'Bachelors',
    } = (req.body || {}) as SummarizeRequestBody;

    if (!text || text.trim().length < 20) {
      return res.status(400).json({
        error: 'Text is too short for summarization. At least 20 characters of readable content are required.',
      });
    }

    // Limit text length to prevent token overflow (~30,000 characters)
    const truncatedText = text.length > 30000 ? text.substring(0, 30000) + '...[truncated]' : text;

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: 'AI service configuration is missing on the server. Please contact support.',
      });
    }

    let difficultyInstruction = 'Target audience: Undergraduate / Bachelors student. Balance academic rigor, clear conceptual explanation, and university-level vocabulary.';
    if (educationLevel === 'Intermediate') {
      difficultyInstruction = 'Target audience: Intermediate / High School student. Use clear, accessible language, intuitive analogies, and avoid overly dense technical jargon.';
    } else if (educationLevel === 'Masters') {
      difficultyInstruction = 'Target audience: Graduate / Masters student. Use precise technical terminology, advanced domain depth, and scholarly concepts.';
    } else if (educationLevel === 'PhD') {
      difficultyInstruction = 'Target audience: PhD / Doctoral researcher. Use dense, rigorous academic vocabulary, deep theoretical synthesis, and nuanced edge cases.';
    }

    const systemPrompt = `You are CampusMind AI, an expert academic study companion.
Your mission is to convert raw lecture notes, PDF transcripts, audio recordings, or textbook materials into clear, encouraging, structured study summaries.

ADAPTIVE DIFFICULTY & VOCABULARY LEVEL:
${difficultyInstruction}

CRITICAL INSTRUCTION:
Generate the summary, key takeaways, and section headings based ONLY and STRICTLY on the facts, concepts, and details provided in the user's raw extracted text.
Do NOT introduce external subjects, unmentioned topics, or fabricated information.

Respond ONLY with valid JSON matching this exact structure:
{
  "title": "Clear, concise academic title based strictly on the text",
  "overview": "A 2-3 sentence calm and intuitive overview of the core theme.",
  "keyPoints": [
    "Key takeaway 1",
    "Key takeaway 2",
    "Key takeaway 3",
    "Key takeaway 4",
    "Key takeaway 5",
    "Key takeaway 6"
  ],
  "headings": [
    {
      "title": "Section / Topic Heading 1",
      "points": [
        "Detail point explaining this concept",
        "Another relevant detail or formula"
      ]
    },
    {
      "title": "Section / Topic Heading 2",
      "points": [
        "Detail point explaining this concept",
        "Another relevant detail"
      ]
    }
  ],
  "fullSummary": "Comprehensive multi-paragraph study guide written in an approachable, warm educational tone."
}`;

    const userPrompt = `Material Title: ${title || 'Study Material'}
Content Type: ${contentType}
Raw Extracted Text:
"""
${truncatedText}
"""

Please produce a comprehensive 5-10 key-points summary, auto-headings, and study guide in the specified JSON format strictly based on the text above.`;

    let parsedJson: any = null;
    let lastError: any = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          model: GROQ_MODELS.text,
          temperature: attempt === 1 ? 0.2 : 0.1,
          response_format: { type: 'json_object' },
        });

        const content = chatCompletion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('AI service returned empty response');
        }

        parsedJson = extractJson(content);
        if (parsedJson && (parsedJson.overview || parsedJson.keyPoints)) {
          break; // successfully parsed valid summary
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Summarize] Attempt ${attempt} failed: ${err.message}`);
        if (attempt === 2) throw err;
      }
    }

    return res.status(200).json({
      success: true,
      summary: parsedJson,
    });
  } catch (error: any) {
    console.error('[CampusMind Summarization Error]', error);
    return res.status(500).json({
      error: 'Unable to generate summary from this content. Please verify your material and try again.',
      details: error.message,
    });
  }
}
