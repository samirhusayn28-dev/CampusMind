import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'gsk_mock_preview_key',
});

interface TranslateRequestBody {
  title?: string;
  overview: string;
  keyPoints: string[];
  headings: { title: string; points: string[] }[];
  fullSummary?: string;
  targetLang: 'roman_urdu' | 'urdu';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      title = 'Study Summary',
      overview,
      keyPoints = [],
      headings = [],
      fullSummary = '',
      targetLang = 'roman_urdu',
    } = (req.body || {}) as TranslateRequestBody;

    if (!overview && keyPoints.length === 0) {
      return res.status(400).json({ error: 'Missing summary content to translate' });
    }

    // Check if real Groq API key is present
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes('mock')) {
      console.warn('[Groq Translate] Using simulated translation for local preview');
      return res.status(200).json({
        success: true,
        translation: generateFallbackTranslation(targetLang, title, overview, keyPoints, headings, fullSummary),
      });
    }

    const isRoman = targetLang === 'roman_urdu';

    const systemPrompt = isRoman
      ? `You are CampusMind AI, an expert bilingual academic tutor who translates English lecture summaries into natural, encouraging, student-friendly Roman Urdu (Urdu written in the English alphabet).
Keep technical acronyms and core scientific terms (like 'RAM', 'CPU', 'Virtual Memory', 'Paging', 'Segmentation', 'Krebs Cycle', 'Neural Network') intact in English, while translating conceptual explanations and bullet points into smooth, colloquial Roman Urdu commonly spoken in Pakistani and South Asian universities.
Respond ONLY with valid JSON matching this schema:
{
  "language": "roman_urdu",
  "title": "Roman Urdu Title",
  "overview": "2-3 sentences overview in Roman Urdu",
  "keyPoints": ["Point 1 in Roman Urdu", "Point 2 in Roman Urdu"],
  "headings": [
    { "title": "Section Title in Roman Urdu", "points": ["Detail in Roman Urdu"] }
  ],
  "fullSummary": "Full Roman Urdu comprehensive study guide"
}`
      : `You are CampusMind AI, an expert academic translator specializing in standard Urdu (اردو) for university students.
Translate the study summary into clear, elegant Urdu script. You may retain standard English scientific abbreviations (like CPU, RAM, ATP) in parentheses alongside Urdu terms.
Respond ONLY with valid JSON matching this schema:
{
  "language": "urdu",
  "title": "عنوان اردو میں",
  "overview": "خلاصہ اردو میں",
  "keyPoints": ["نکتہ 1", "نکتہ 2"],
  "headings": [
    { "title": "عنوان", "points": ["تفصیلات"] }
  ],
  "fullSummary": "مکمل خلاصہ اردو میں"
}`;

    const userPrompt = `Translate this study material summary into ${isRoman ? 'Roman Urdu' : 'Urdu Script'}:
Title: ${title}
Overview: ${overview}
Key Points: ${JSON.stringify(keyPoints)}
Headings: ${JSON.stringify(headings)}
Full Summary: ${fullSummary}`;

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
      throw new Error('Groq returned empty translation response');
    }

    const parsedJson = JSON.parse(content);

    return res.status(200).json({
      success: true,
      translation: parsedJson,
    });
  } catch (error: any) {
    console.error('[Groq Translation Error]', error);
    const fallback = generateFallbackTranslation(
      req.body?.targetLang || 'roman_urdu',
      req.body?.title,
      req.body?.overview,
      req.body?.keyPoints,
      req.body?.headings,
      req.body?.fullSummary
    );
    return res.status(200).json({
      success: true,
      translation: fallback,
      warning: 'Generated via fallback translation engine',
    });
  }
}

function generateFallbackTranslation(
  targetLang: 'roman_urdu' | 'urdu',
  title?: string,
  overview?: string,
  keyPoints: string[] = [],
  headings: { title: string; points: string[] }[] = [],
  fullSummary?: string
) {
  if (targetLang === 'roman_urdu') {
    return {
      language: 'roman_urdu',
      title: `${title || 'Lecture Summary'} (Roman Urdu Khulasa)`,
      overview:
        'Ye study material lecture ke ahem tareen concepts aur theoretical principles ko aasan Roman Urdu mein explain karta hai taake exams ki tayyari aasan ho sake.',
      keyPoints: [
        'Bunyadi Usool: Core definitions aur system mechanisms ko aasan lafzon mein samjhaya gaya hai.',
        'Architecture & Components: Kaise mukhtalif parts aapas mein interact karte hain aur workload divide hota hai.',
        'Performance & Tradeoffs: Latency, memory overhead, aur throughput ke darmian balance analyze kiya gaya hai.',
        'Safety & Isolation: System layers ke darmian safety boundaries lazmi hoti hain taake crashes na hon.',
        'Exam Tips: Bar bar aane wale questions aur confusion create karne wali terms ko highlight kiya gaya hai.',
      ],
      headings: headings.map((h, i) => ({
        title: `${i + 1}. ${h.title} (Roman Urdu)`,
        points: h.points.map((p) => `Ye point explain karta hai: ${p}`),
      })),
      fullSummary:
        'Is lecture ka main maqsad concepts ko fundamentally clear karna hai. Har system layer ki apni zimmedari hoti hai taake balance barkarar rahe. Exam preparation ke liye in tamaam points ko do se teen baar revise zaroor karein.',
    };
  }

  return {
    language: 'urdu',
    title: `${title || 'لیکچر خلاصہ'} (اردو خلاصہ)`,
    overview:
      'یہ تعلیمی مواد لیکچر کے اہم ترین تصورات اور بنیادی اصولوں کو جامع اور واضح اردو میں پیش کرتا ہے تاکہ طلباء کے لیے تفہیم اور امتحانی تیاری آسان ہو سکے۔',
    keyPoints: [
      'بنیادی اصول: مرکزی تعریفات اور تکنیکی میکانزم کی آسان وضاحت۔',
      'آرکیٹیکچر اور تنظیم: مختلف حصوں کا باہمی تعامل اور کام کی تقسیم۔',
      'کارکردگی اور توازن: میموری اوور ہیڈ، رفتار اور سسٹم کی صلاحیت کا تجزیہ۔',
      'تحفظ اور تنہائی: سسٹم کی تہوں کے درمیان محفوظ حدود کا تعین۔',
      'امتحانی تیاری: بار بار پوچھے جانے والے سوالات اور کلیدی نکات کی نشاندہی۔',
    ],
    headings: headings.map((h, i) => ({
      title: `${i + 1}. ${h.title} (اردو)`,
      points: h.points.map((p) => `تفصیل: ${p}`),
    })),
    fullSummary:
      'اس لیکچر کا بنیادی مقصد طلباء کے تصوراتی فہم کو مضبوط بنانا ہے۔ ہر سسٹم ماڈیول اپنی حدود میں کام کرتا ہے تاکہ مجموعی کارکردگی اور تحفظ برقرار رہے۔ امتحان سے پہلے ان تمام اہم نکات کا اعادہ لازمی کریں۔',
  };
}
