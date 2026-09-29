import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from '../_utils/auth.js';
import { getSupabaseAdmin } from '../_utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Verify Firebase authentication token
  const authUser = await verifyAuth(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized. Please sign in to extract PDF text.' });
  }

  let parser: any = null;
  try {
    const { storagePath, fileName } = req.body || {};

    if (!storagePath || typeof storagePath !== 'string') {
      return res.status(400).json({ error: 'Missing required storagePath in request body' });
    }

    // 2. Prevent path traversal attacks
    if (storagePath.includes('..') || storagePath.includes('\\')) {
      return res.status(400).json({ error: 'Invalid storagePath' });
    }

    // 3. Ensure storagePath strictly belongs to the authenticated user
    const expectedPrefix = `pdfs/${authUser.uid}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      return res.status(403).json({
        error: 'Access denied: PDF does not belong to the authenticated user.',
      });
    }

    // 4. Download PDF from Supabase Storage into buffer
    const relativePath = storagePath.slice('pdfs/'.length);
    const supabase = getSupabaseAdmin();
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(relativePath);

    if (downloadError || !fileBlob) {
      console.error('[Supabase Storage Download Error]:', downloadError);
      return res.status(404).json({
        error: 'Failed to retrieve PDF file from storage.',
        details: downloadError?.message,
      });
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate authentic PDF format via magic bytes
    const fileHeader = buffer.subarray(0, 1024).toString('latin1');
    if (!fileHeader.includes('%PDF-')) {
      return res.status(400).json({
        error: "This doesn't look like a valid PDF. Please upload a real PDF file.",
      });
    }

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
