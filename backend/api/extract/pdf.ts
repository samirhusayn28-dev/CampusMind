import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PDFParse } from 'pdf-parse';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let parser: PDFParse | null = null;
  try {
    const { fileBase64, fileName } = req.body || {};

    if (!fileBase64) {
      return res.status(400).json({ error: 'Missing required fileBase64 in request body' });
    }

    // Convert base64 data to buffer (stripping data:application/pdf;base64, header if present)
    const base64Clean = fileBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo().catch(() => null);

    const cleanText = (textResult.text || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
    const numPages = textResult.pages?.length || 1;

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
    if (parser) {
      await parser.destroy().catch(() => {});
    }
  }
}
