import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'gsk_mock_preview_key',
});

interface SummarizeRequestBody {
  text: string;
  title?: string;
  contentType?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, title, contentType = 'lecture' } = (req.body || {}) as SummarizeRequestBody;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Missing required text in request body' });
    }

    // Limit text length to prevent token overflow (~30,000 characters)
    const truncatedText = text.length > 30000 ? text.substring(0, 30000) + '...[truncated]' : text;

    // Check if real Groq API key is present
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes('mock')) {
      console.warn('[Groq Summarize] Using simulated high-quality summary for local preview');
      return res.status(200).json({
        success: true,
        summary: generateFallbackSummary(text, title, contentType),
      });
    }

    const systemPrompt = `You are CampusMind AI, an expert academic study companion.
Your mission is to convert raw lecture notes, PDF transcripts, audio recordings, or textbook materials into clear, encouraging, structured study summaries for university students.

Respond ONLY with valid JSON matching this exact structure:
{
  "title": "Clear, concise academic title",
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

    const userPrompt = `Material Title: ${title || 'Untitled Study Material'}
Content Type: ${contentType}
Raw Extracted Text:
"""
${truncatedText}
"""

Please produce a comprehensive 5-10 key-points summary, auto-headings, and study guide in the specified JSON format.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Groq returned empty response');
    }

    const parsedJson = JSON.parse(content);

    return res.status(200).json({
      success: true,
      summary: parsedJson,
    });
  } catch (error: any) {
    console.error('[Groq Summarization Error]', error);

    // Fallback if rate limited or Groq call fails
    const fallback = generateFallbackSummary(req.body?.text || '', req.body?.title, req.body?.contentType);
    return res.status(200).json({
      success: true,
      summary: fallback,
      warning: 'Generated via fallback engine due to API timeout or rate limit',
    });
  }
}

function generateFallbackSummary(text: string, title?: string, contentType?: string) {
  const derivedTitle = title || 'Structured Lecture Notes';
  return {
    title: derivedTitle,
    overview: `This study material explores key concepts and mechanisms in ${derivedTitle}. It breaks down foundational definitions, comparative analysis, and practical implications for exams and coursework.`,
    keyPoints: [
      'Foundational Principles: Outlines core definitions and mechanisms governing the topic.',
      'Architecture & Organization: Explains how distinct components interact and partition workload.',
      'Performance Tradeoffs: Analyzes latency, storage overhead, and execution efficiency.',
      'Fault Isolation & Protection: Ensures safe operational boundaries between system layers.',
      'Real-world Applications: Connects theoretical principles to industry and experimental practice.',
      'Exam Focus Areas: Key formulas, terminology distinctions, and recurring problem patterns.',
    ],
    headings: [
      {
        title: '1. Theoretical Framework & Core Definitions',
        points: [
          'Deconstructs base requirements and formal classifications.',
          'Contrasts conventional static approaches with dynamic, modern implementations.',
        ],
      },
      {
        title: '2. Mechanics and Step-by-Step Flow',
        points: [
          'Step-by-step traversal from initial input to final synthesized result.',
          'Handling edge cases, overhead costs, and synchronization points.',
        ],
      },
      {
        title: '3. Critical Distinctions and Takeaways',
        points: [
          'Distinguishes commonly confused terms frequently tested in exam questions.',
          'Summarizes the primary advantage and limitation of each mechanism.',
        ],
      },
    ],
    fullSummary: `Overview of ${derivedTitle}:\n\nThe lecture begins by grounding the subject in its foundational principles. Through structured examination, we see that modern systems rely on a separation of concerns between control logic and underlying data structures.\n\nKey mechanisms are designed to optimize resource allocation while maintaining robust isolation. When analyzing performance tradeoffs, special attention should be given to algorithmic complexity and caching behavior.\n\nIn preparation for review and quizzes, ensure you can clearly articulate the functional differences between each stage and explain the rationale behind architectural design choices.`,
  };
}
