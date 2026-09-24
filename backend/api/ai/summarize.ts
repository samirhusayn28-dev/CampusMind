import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

interface SummarizeRequestBody {
  text: string;
  title?: string;
  contentType?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, title, contentType = 'lecture' } = (req.body || {}) as SummarizeRequestBody;

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

    const systemPrompt = `You are CampusMind AI, an expert academic study companion.
Your mission is to convert raw lecture notes, PDF transcripts, audio recordings, or textbook materials into clear, encouraging, structured study summaries for university students.

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

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('AI service returned empty response');
    }

    const parsedJson = JSON.parse(content);

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
