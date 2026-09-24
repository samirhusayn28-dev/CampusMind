import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { GROQ_MODELS, extractJson } from '../_utils/ai.js';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'gsk_mock_preview_key',
});

interface ConceptMapRequestBody {
  text: string;
  title?: string;
  summary?: any;
}

export interface ConceptNode {
  id: string;
  label: string;
  category: 'root' | 'core' | 'mechanism' | 'application' | 'example';
  description: string;
}

export interface ConceptEdge {
  source: string;
  target: string;
  label: string;
}

export interface ConceptMapResponse {
  success: boolean;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, title = 'Study Topic', summary } = (req.body || {}) as ConceptMapRequestBody;

    if (!text && !summary) {
      return res.status(400).json({ error: 'Study material text or summary is required' });
    }

    // Check if real Groq API key is present
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes('mock')) {
      console.warn('[Groq Concept Map] Using simulated concept graph for preview');
      const fallback = generateFallbackConceptMap(title, text || JSON.stringify(summary));
      return res.status(200).json(fallback);
    }

    const truncated = text && text.length > 25000 ? text.substring(0, 25000) : text || '';
    const summaryContext = summary ? JSON.stringify(summary) : '';

    const systemPrompt = `You are CampusMind AI, an expert conceptual diagram and mind-map architect for university students.
Analyze the provided study material and extract an interconnected concept map graph that visualizes the core mental model.

RULES:
1. Generate between 6 and 10 distinct nodes.
2. The first node (id: "n1") must be the root topic.
3. Other nodes should be core concepts, mechanisms, applications, or examples.
4. Each node must have:
   - "id": string like "n1", "n2", "n3", etc.
   - "label": short, readable concept name (2-4 words max).
   - "category": one of ["root", "core", "mechanism", "application", "example"].
   - "description": 1-2 sentence educational explanation of the concept and why it matters.
5. Generate between 6 and 12 directed edges connecting the nodes:
   - "source": node id
   - "target": node id
   - "label": short relationship verb/phrase (e.g., "regulates", "comprises", "leads to", "optimizes", "depends on").
6. The graph should be connected and clear to navigate.

Respond ONLY with valid JSON matching this schema:
{
  "nodes": [
    {
      "id": "n1",
      "label": "Short Title",
      "category": "root",
      "description": "Clear explanation"
    }
  ],
  "edges": [
    {
      "source": "n1",
      "target": "n2",
      "label": "branches into"
    }
  ]
}`;

    const userPrompt = `Document Title: ${title}
Summary Context: ${summaryContext}
Raw Material Content:
"""
${truncated}
"""

Please construct the structured concept map graph in the specified JSON format.`;

    let nodes: ConceptNode[] = [];
    let edges: ConceptEdge[] = [];

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          model: GROQ_MODELS.text,
          temperature: attempt === 1 ? 0.3 : 0.1,
          response_format: { type: 'json_object' },
        });

        const content = chatCompletion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Groq returned empty response');
        }

        const parsedJson = extractJson(content);
        nodes = parsedJson.nodes || [];
        edges = parsedJson.edges || [];
        if (Array.isArray(nodes) && nodes.length > 0) {
          break;
        }
      } catch (err: any) {
        console.warn(`[Concept Map] Attempt ${attempt} failed: ${err.message}`);
        if (attempt === 2 && nodes.length === 0) {
          throw err;
        }
      }
    }

    return res.status(200).json({
      success: true,
      nodes,
      edges,
    });
  } catch (error: any) {
    console.error('[Groq Concept Map Error]', error);
    const fallback = generateFallbackConceptMap(
      req.body?.title || 'Study Subject',
      req.body?.text || ''
    );
    return res.status(200).json(fallback);
  }
}

function generateFallbackConceptMap(title: string, rawText: string): ConceptMapResponse {
  const rootLabel = title.length > 28 ? title.substring(0, 25) + '...' : title;

  const nodes: ConceptNode[] = [
    {
      id: 'n1',
      label: rootLabel,
      category: 'root',
      description: `Primary subject domain representing the overarching foundation of ${title}.`,
    },
    {
      id: 'n2',
      label: 'Core Principles',
      category: 'core',
      description: 'Foundational postulates and structural definitions establishing the topic boundaries.',
    },
    {
      id: 'n3',
      label: 'Functional Flow',
      category: 'mechanism',
      description: 'Step-by-step procedural lifecycle and sequential transitions observed during execution.',
    },
    {
      id: 'n4',
      label: 'Resource Allocation',
      category: 'mechanism',
      description: 'Methods used to distribute capacity, schedule workloads, and minimize latency.',
    },
    {
      id: 'n5',
      label: 'Isolation & Safety',
      category: 'core',
      description: 'Guarantees preventing fault cascading, invalid states, or unhandled exceptions.',
    },
    {
      id: 'n6',
      label: 'Real-World Systems',
      category: 'application',
      description: 'Production implementations and industry standard architectures relying on this model.',
    },
    {
      id: 'n7',
      label: 'Performance Tradeoffs',
      category: 'example',
      description: 'Exam evaluation points contrasting space vs time complexity and resource efficiency.',
    },
  ];

  const edges: ConceptEdge[] = [
    { source: 'n1', target: 'n2', label: 'establishes' },
    { source: 'n1', target: 'n3', label: 'governs' },
    { source: 'n2', target: 'n4', label: 'allocates' },
    { source: 'n2', target: 'n5', label: 'enforces' },
    { source: 'n3', target: 'n4', label: 'coordinates' },
    { source: 'n4', target: 'n6', label: 'powers' },
    { source: 'n5', target: 'n7', label: 'analyzed via' },
    { source: 'n6', target: 'n7', label: 'evaluates' },
  ];

  return {
    success: true,
    nodes,
    edges,
  };
}
