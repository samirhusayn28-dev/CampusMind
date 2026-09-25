import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let parser: any = null;
  try {
    const { fileBase64, fileName } = req.body || {};

    if (!fileBase64) {
      return res.status(400).json({ error: 'Missing required fileBase64 in request body' });
    }

    // Convert base64 data to buffer (stripping data:application/pdf;base64, header if present)
    const base64Clean = fileBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    let cleanText = '';
    let numPages = 1;
    let infoResult: any = {};

    try {
      const { PDFParse } = await import('pdf-parse');
      parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      infoResult = await parser.getInfo().catch(() => null);

      cleanText = (textResult.text || '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      numPages = textResult.pages?.length || 1;
    } catch (parserErr: any) {
      console.warn('[PDFParse Module Error, attempting raw text fallback]:', parserErr.message);
      // Fallback: extract plain text from uncompressed PDF streams
      const rawString = buffer.toString('binary');
      const textMatches: string[] = [];
      const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
      let match: RegExpExecArray | null;
      while ((match = streamRegex.exec(rawString)) !== null) {
        const streamData = match[1];
        const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
        let tjMatch: RegExpExecArray | null;
        while ((tjMatch = tjRegex.exec(streamData)) !== null) {
          textMatches.push(tjMatch[1]);
        }
      }
      if (textMatches.length > 0) {
        cleanText = textMatches.join(' ').replace(/[ \t]+/g, ' ').trim();
      }
      if (!cleanText || cleanText.length < 20) {
        throw parserErr;
      }
    }

    if (!cleanText || cleanText.length < 20) {
      return res.status(400).json({
        error: 'No readable text could be extracted from this PDF. If it contains scanned pages, please take photos and use Camera Scan.',
      });
    }

    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

    return res.status(200).json({
      success: true,
      text: cleanText,
      numPages,
      fileName: fileName || 'Uploaded Lecture.pdf',
      info: infoResult || {},
      wordCount,
    });
  } catch (error: any) {
    console.error('[PDF Extraction Error]', error);
    return res.status(500).json({
      error: 'Failed to extract text from PDF document',
      details: error.message,
    });
  } finally {
    if (parser && typeof parser.destroy === 'function') {
      await parser.destroy().catch(() => {});
    }
  }
}
