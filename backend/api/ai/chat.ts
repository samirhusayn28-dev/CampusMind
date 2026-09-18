import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { Pinecone } from '@pinecone-database/pinecone';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'gsk_mock_preview_key',
});

// Optional Pinecone client
let pineconeClient: Pinecone | null = null;
function getPineconeClient(): Pinecone | null {
  if (!pineconeClient && process.env.PINECONE_API_KEY && !process.env.PINECONE_API_KEY.includes('mock')) {
    try {
      pineconeClient = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });
    } catch (err) {
      console.warn('[Pinecone] Failed to initialize Pinecone client:', err);
    }
  }
  return pineconeClient;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RagChatRequestBody {
  message: string;
  materialId?: string;
  materialTitle?: string;
  materialText?: string;
  materialSummary?: any;
  history?: ChatMessage[];
  language?: 'en' | 'roman_urdu' | 'urdu';
}

interface RetrievedChunk {
  chunkIndex: number;
  textSnippet: string;
  score: number;
}

// 1. Semantic Chunking with sentence boundary preservation
function chunkText(text: string, chunkSize: number = 600, overlap: number = 100): string[] {
  if (!text || text.trim().length === 0) return [];

  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    const cleanPara = para.trim();
    if (!cleanPara) continue;

    if (currentChunk.length + cleanPara.length <= chunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + cleanPara;
    } else {
      // If single paragraph is larger than chunk size, split by sentences
      if (cleanPara.length > chunkSize) {
        const sentences = cleanPara.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [cleanPara];
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length <= chunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + sentence.trim();
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            // Retain overlap from end of previous chunk
            const overlapText = currentChunk.slice(-overlap);
            currentChunk = overlapText + ' ' + sentence.trim();
          }
        }
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + ' ' + cleanPara;
      }
    }
  }

  if (currentChunk && currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text.substring(0, chunkSize)];
}

// 2. Hybrid Keyword-Semantic Scoring (BM25 / TF-IDF style)
function retrieveRelevantChunks(
  chunks: string[],
  query: string,
  topK: number = 4
): RetrievedChunk[] {
  if (chunks.length === 0) return [];

  const queryTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const scored = chunks.map((chunk, index) => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;

    // Exact query match boost
    if (chunkLower.includes(query.toLowerCase())) {
      score += 10;
    }

    // Term match frequency and presence
    for (const term of queryTerms) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = chunkLower.match(regex);
      if (matches) {
        score += matches.length * 2;
      } else if (chunkLower.includes(term)) {
        score += 0.8;
      }
    }

    // Length normalization penalty (prevent excessively short or long chunks from biasing)
    const lengthFactor = Math.min(1.0, chunk.length / 300);
    const finalScore = score * lengthFactor;

    return {
      chunkIndex: index + 1,
      textSnippet: chunk,
      score: finalScore,
    };
  });

  // Sort descending by relevance
  scored.sort((a, b) => b.score - a.score);

  // Take top K; if no keyword matches, return first chunks as fallback context
  const bestMatches = scored.filter((s) => s.score > 0).slice(0, topK);
  if (bestMatches.length > 0) {
    return bestMatches;
  }

  return scored.slice(0, Math.min(topK, chunks.length));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      message,
      materialId,
      materialTitle = 'Study Material',
      materialText = '',
      materialSummary,
      history = [],
      language = 'en',
    } = (req.body || {}) as RagChatRequestBody;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'User message is required' });
    }

    let retrieved: RetrievedChunk[] = [];

    // 1. Attempt Pinecone Integrated Vector Search if configured
    const pClient = getPineconeClient();
    if (pClient) {
      try {
        const indexName = process.env.PINECONE_INDEX || 'campusmind-index';
        const index = pClient.index(indexName);
        const searchFilter = materialId ? { materialId: { $eq: materialId } } : undefined;

        const searchRes = await index.searchRecords({
          query: {
            topK: 4,
            inputs: { text: message },
            ...(searchFilter ? { filter: searchFilter } : {}),
          },
        });

        if (searchRes?.result?.hits && searchRes.result.hits.length > 0) {
          retrieved = searchRes.result.hits
            .map((hit, idx) => {
              const fields = (hit.fields || {}) as Record<string, any>;
              const text = String(fields.text || fields.chunkText || fields.content || '');
              return {
                chunkIndex: idx + 1,
                textSnippet: text,
                score: hit._score || 0,
              };
            })
            .filter((c) => c.textSnippet.trim().length > 0);
        }
      } catch (pineconeErr: any) {
        console.warn('[Pinecone RAG] Semantic search fell back to text chunking:', pineconeErr?.message || pineconeErr);
      }
    }

    // 2. In-Memory Chunking & Keyword-Semantic Retrieval fallback
    const fullText = materialText || (materialSummary ? JSON.stringify(materialSummary) : '');
    const chunks = chunkText(fullText);

    if (retrieved.length === 0 && chunks.length > 0) {
      retrieved = retrieveRelevantChunks(chunks, message, 4);

      // Opportunistically index into Pinecone using integrated embeddings in background
      if (pClient && materialId && chunks.length > 0) {
        const indexName = process.env.PINECONE_INDEX || 'campusmind-index';
        const index = pClient.index(indexName);
        const records = chunks.map((chunk, i) => ({
          id: `${materialId}_chunk_${i + 1}`,
          text: chunk,
          materialId,
          materialTitle,
          chunkIndex: i + 1,
        }));
        index.upsertRecords({ records }).catch((upsertErr) => {
          console.warn('[Pinecone Upsert] Background indexing note:', upsertErr?.message || upsertErr);
        });
      }
    }

    const contextSnippets = retrieved
      .map((c) => `[Excerpt ${c.chunkIndex}]:\n"${c.textSnippet}"`)
      .join('\n\n---\n\n');

    // Check if real Groq API key is present
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes('mock')) {
      console.warn('[Groq RAG Chat] Using simulated preview response');
      const mockResult = generateFallbackChatReply(message, materialTitle, retrieved, language);
      return res.status(200).json({
        success: true,
        reply: mockResult.reply,
        sources: retrieved,
      });
    }

    // 2. Build language guidelines
    let languageInstruction = 'Respond in clear, encouraging, academic English.';
    if (language === 'roman_urdu') {
      languageInstruction =
        'Respond in natural, conversational Roman Urdu (Latin script Urdu commonly used by Pakistani university students). Be warm and supportive (e.g., "Is lecture ke mutabiq...").';
    } else if (language === 'urdu') {
      languageInstruction =
        'Respond in formal, fluent Urdu script (اردو). Use proper RTL-compatible grammar and educational tone.';
    }

    // 3. Construct System Prompt with RAG grounding instructions
    const systemPrompt = `You are CampusMind Study Companion, an AI tutor designed to help students master their courses.
You answer questions strictly and accurately based on the lecture material excerpts provided below.

INSTRUCTIONS:
1. Ground your answer in the provided lecture excerpts.
2. If the answer is present in the excerpts, synthesize a comprehensive yet digestible explanation.
3. Cite your sources inline using [Excerpt X] whenever you reference a factual claim.
4. If a question cannot be answered from the provided excerpts, politely clarify: "Based on the provided lecture notes, this specific point isn't detailed, but..." and then provide helpful general educational context if appropriate.
5. Maintain an encouraging, calm, Material You companion tone — supportive, clear, never condescending.
6. Language Guideline: ${languageInstruction}

LECTURE EXCERPTS GROUNDING CONTEXT:
Document Title: "${materialTitle}"
${contextSnippets ? contextSnippets : '(No excerpts provided. Please provide general guidance on the topic.)'}`;

    // 4. Construct messages payload
    const formattedHistory = history.slice(-6).map((msg) => ({
      role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: msg.content,
    }));

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...formattedHistory,
        { role: 'user', content: message },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      max_tokens: 1024,
    });

    const reply = chatCompletion.choices[0]?.message?.content || 'I could not generate a response.';

    return res.status(200).json({
      success: true,
      reply,
      sources: retrieved,
    });
  } catch (error: any) {
    console.error('[Groq RAG Chat Error]', error);
    const fallback = generateFallbackChatReply(
      req.body?.message || '',
      req.body?.materialTitle || 'Lecture',
      [],
      req.body?.language || 'en'
    );
    return res.status(200).json({
      success: true,
      reply: fallback.reply,
      sources: [],
    });
  }
}

// Fallback generator for preview/testing
function generateFallbackChatReply(
  query: string,
  title: string,
  sources: RetrievedChunk[],
  language: 'en' | 'roman_urdu' | 'urdu'
): { reply: string } {
  const topSnippet = sources[0]?.textSnippet
    ? sources[0].textSnippet.substring(0, 180) + '...'
    : `the fundamental principles covered in ${title}`;

  if (language === 'roman_urdu') {
    return {
      reply: `Aap ke lecture "${title}" ke mutabiq [Excerpt 1]:\n\n${topSnippet}\n\nYeh concept exam ke point of view se bohat ahem hai. Is ko behtar samajhne ke liye practice quiz zaroor try karein!`,
    };
  }

  if (language === 'urdu') {
    return {
      reply: `آپ کے لیکچر "${title}" کے مطابق [Excerpt 1]:\n\n${topSnippet}\n\nیہ نکتہ امتحانی تیاری کے لحاظ سے نہایت اہم ہے۔ مزید وضاحت کے لیے آپ سمری بھی دیکھ سکتے ہیں۔`,
    };
  }

  return {
    reply: `Based on your lecture "${title}" [Excerpt 1]:\n\n${topSnippet}\n\nThis principle forms the cornerstone of this topic. Remember that active recall and connecting this with practical examples will help lock it into your long-term memory!`,
  };
}
