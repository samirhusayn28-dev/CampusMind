import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { GROQ_MODELS, extractJson } from '../_utils/ai.js';
import { verifyAuth, checkRateLimit } from '../_utils/auth.js';

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

  // 1. Verify Firebase authentication
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized. Please sign in to use CampusMind AI features.' });
  }

  // 2. Enforce per-user rate limiting (max 30 requests / minute)
  const rateLimit = checkRateLimit(user.uid, 30, 60_000);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.retryAfterSeconds.toString());
    return res.status(429).json({
      error: `Rate limit exceeded. Please wait ${rateLimit.retryAfterSeconds}s before trying again.`,
    });
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

    // Smart text sampling to prevent token overflow while capturing beginning, middle, and conclusion
    let processedText = text.trim();
    if (processedText.length > 24000) {
      const head = processedText.slice(0, 10000);
      const midStart = Math.floor((processedText.length - 8000) / 2);
      const mid = processedText.slice(midStart, midStart + 8000);
      const tail = processedText.slice(-6000);
      processedText = `${head}\n\n[... content omitted for length ...]\n\n${mid}\n\n[... content omitted for length ...]\n\n${tail}`;
    }

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
Generate the summary, key takeaways, section headings, and optional tables/charts based ONLY and STRICTLY on the facts, concepts, and details provided in the user's raw extracted text.
Do NOT introduce external subjects, unmentioned topics, or fabricated information.

OPTIONAL STRUCTURED TABLES & CHARTS:
If and ONLY IF the provided text clearly contains tabular data (such as spreadsheet tables, markdown tables, matrix data, schedules, or comparisons) or comparable numeric data:
- "tables": Include structured tables with "title" (string), "columns" (string[]), and "rows" (string[][]).
- "charts": Include visualization objects with "type" ("bar" | "line" | "pie"), "title" (string), "labels" (string[]), and "series" ([{ "name": string, "data": number[] }]). Values in "data" MUST be numbers.
- If NO clear tabular or numeric data exists in the source text, set "tables" and "charts" to empty arrays []. NEVER invent numbers or fabricate data.

Respond ONLY with valid JSON matching this exact structure:
{
  "title": "Clear, concise academic title based strictly on the text",
  "overview": "A 2-3 sentence calm and intuitive overview of the core theme.",
  "keyPoints": [
    "Key takeaway 1",
    "Key takeaway 2",
    "Key takeaway 3",
    "Key takeaway 4",
    "Key takeaway 5"
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
  "fullSummary": "Comprehensive multi-paragraph study guide written in an approachable, warm educational tone.",
  "tables": [
    {
      "title": "Table Title",
      "columns": ["Col 1", "Col 2"],
      "rows": [
        ["Val 1", "Val 2"],
        ["Val 3", "Val 4"]
      ]
    }
  ],
  "charts": [
    {
      "type": "bar",
      "title": "Chart Title",
      "labels": ["Item A", "Item B"],
      "series": [
        {
          "name": "Score",
          "data": [90, 85]
        }
      ]
    }
  ]
}`;

    const userPrompt = `Material Title: ${title || 'Study Material'}
Content Type: ${contentType}
Raw Extracted Text:
"""
${processedText}
"""

Please produce a comprehensive 5-10 key-points summary, auto-headings, study guide, and optional structured tables/charts (if tabular/numeric data is present in the text) in the specified JSON format strictly based on the text above.`;

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
          max_tokens: 3000,
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
        if (attempt === 2) break;
      }
    }

    if (!parsedJson || (!parsedJson.overview && !parsedJson.keyPoints)) {
      console.warn('[Summarize] Using heuristic fallback summary due to AI generation issue:', lastError?.message);
      const paragraphs = text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 30);
      const firstPara = paragraphs[0] || text.slice(0, 300);
      const overview = firstPara.length > 350 ? firstPara.slice(0, 350) + '...' : firstPara;
      const keyPoints = paragraphs
        .slice(1, 7)
        .map((p) => (p.length > 160 ? p.slice(0, 160) + '...' : p));

      parsedJson = {
        title: title || 'Study Material Summary',
        overview,
        keyPoints: keyPoints.length > 0 ? keyPoints : [overview],
        headings: [
          {
            title: 'Core Concepts & Study Guide',
            points: keyPoints.length > 0 ? keyPoints : [overview],
          },
        ],
        fullSummary: paragraphs.slice(0, 5).join('\n\n') || text.slice(0, 1500),
      };
    }
    // Sanitize and validate optional tables
    if (Array.isArray(parsedJson?.tables)) {
      parsedJson.tables = parsedJson.tables
        .filter((t: any) => t && Array.isArray(t.columns) && t.columns.length > 0 && Array.isArray(t.rows) && t.rows.length > 0)
        .map((t: any) => ({
          title: typeof t.title === 'string' && t.title.trim() ? t.title.trim() : 'Data Table',
          columns: t.columns.map((c: any) => String(c ?? '').trim()),
          rows: t.rows.map((row: any) =>
            Array.isArray(row)
              ? row.map((cell: any) => String(cell ?? '').trim())
              : [String(row ?? '').trim()]
          ),
        }));
      if (parsedJson.tables.length === 0) delete parsedJson.tables;
    } else {
      delete parsedJson.tables;
    }

    // Sanitize and validate optional charts
    if (Array.isArray(parsedJson?.charts)) {
      parsedJson.charts = parsedJson.charts
        .filter((c: any) => {
          if (!c || !['bar', 'line', 'pie'].includes(c.type)) return false;
          if (!Array.isArray(c.labels) || c.labels.length === 0) return false;
          if (!Array.isArray(c.series) || c.series.length === 0) return false;
          return c.series.some((s: any) => Array.isArray(s.data) && s.data.length > 0);
        })
        .map((c: any) => ({
          type: c.type,
          title: typeof c.title === 'string' && c.title.trim() ? c.title.trim() : 'Data Chart',
          labels: c.labels.map((l: any) => String(l ?? '').trim()),
          series: c.series.map((s: any) => ({
            name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : 'Value',
            data: Array.isArray(s.data)
              ? s.data.map((d: any) => {
                  const num = Number(d);
                  return isNaN(num) ? 0 : num;
                })
              : [],
          })),
        }));
      if (parsedJson.charts.length === 0) delete parsedJson.charts;
    } else {
      delete parsedJson.charts;
    }

    return res.status(200).json({
      success: true,
      summary: parsedJson,
    });
  } catch (error: any) {
    console.error('[CampusMind Summarization Error]', error);
    // Even if an unexpected outer exception occurs, return structured fallback if text exists
    try {
      const rawText = (req.body?.text || '').trim();
      if (rawText.length >= 20) {
        const paras = rawText.split(/\n\s*\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 30);
        const overview = (paras[0] || rawText.slice(0, 300)).slice(0, 350);
        const keyPoints = paras.slice(1, 7).map((p: string) => (p.length > 160 ? p.slice(0, 160) + '...' : p));
        return res.status(200).json({
          success: true,
          summary: {
            title: req.body?.title || 'Study Material Summary',
            overview,
            keyPoints: keyPoints.length > 0 ? keyPoints : [overview],
            headings: [{ title: 'Overview & Key Points', points: keyPoints.length > 0 ? keyPoints : [overview] }],
            fullSummary: paras.slice(0, 5).join('\n\n') || rawText.slice(0, 1500),
          },
        });
      }
    } catch (_) {}

    return res.status(500).json({
      error: 'Unable to generate summary from this content. Please verify your material and try again.',
      details: error.message,
    });
  }
}
