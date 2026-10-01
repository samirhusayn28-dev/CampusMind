import type { VercelRequest, VercelResponse } from '@vercel/node';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { verifyAuth } from '../_utils/auth.js';
import { getSupabaseAdmin } from '../_utils/supabase.js';
import { isTextReadable } from '../_utils/quality.js';

export type SupportedDocumentFormat = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'csv';

interface DetectedFormatResult {
  format: SupportedDocumentFormat;
  zipInstance?: JSZip;
}

/**
 * Detects the real format of the uploaded file server-side via magic bytes and internal structures.
 */
async function detectDocumentFormat(buffer: Buffer, fileName?: string): Promise<DetectedFormatResult | null> {
  if (buffer.length < 4) return null;

  const ext = typeof fileName === 'string' ? fileName.toLowerCase().split('.').pop() : '';

  // 1. PDF magic bytes check (%PDF-)
  const headerPreview = buffer.subarray(0, 1024).toString('latin1');
  if (headerPreview.includes('%PDF-')) {
    return { format: 'pdf' };
  }

  // 2. ZIP container magic bytes check (PK\x03\x04 = 0x50 0x4B 0x03 0x04)
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const fileNames = Object.keys(zip.files);

      if (fileNames.some((f) => f.startsWith('word/') || f === 'word/document.xml')) {
        return { format: 'docx', zipInstance: zip };
      }
      if (fileNames.some((f) => f.startsWith('ppt/') || f.startsWith('ppt/slides/'))) {
        return { format: 'pptx', zipInstance: zip };
      }
      if (fileNames.some((f) => f.startsWith('xl/') || f.startsWith('xl/worksheets/'))) {
        return { format: 'xlsx', zipInstance: zip };
      }

      // If zip internal structure was slightly atypical, use file extension hint
      if (ext === 'docx') return { format: 'docx', zipInstance: zip };
      if (ext === 'pptx') return { format: 'pptx', zipInstance: zip };
      if (ext === 'xlsx') return { format: 'xlsx', zipInstance: zip };
    } catch {
      // Corrupt or non-standard zip
      return null;
    }
  }

  // 3. CSV plain text check: no null bytes, valid text encoding with line breaks and delimiters
  if (!buffer.subarray(0, 4096).includes(0)) {
    const textPreview = buffer.toString('utf8');
    const lines = textPreview.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (ext === 'csv') {
      return { format: 'csv' };
    }
    if (lines.length >= 1 && (textPreview.includes(',') || textPreview.includes(';') || textPreview.includes('\t'))) {
      return { format: 'csv' };
    }
  }

  return null;
}

/**
 * Converts a 2D array of rows into a structured Markdown table
 */
function rowsToMarkdownTable(rows: any[][], maxRows: number = 300): string {
  if (!rows || rows.length === 0) return '';
  const firstRow = rows[0] || [];
  const colCount = firstRow.length;
  if (colCount === 0) return '';

  const cleanHeader = firstRow.map((c, i) => {
    const val = (c ?? '').toString().replace(/\|/g, '\\|').trim();
    return val || `Column ${i + 1}`;
  });

  let md = '| ' + cleanHeader.join(' | ') + ' |\n';
  md += '| ' + cleanHeader.map(() => '---').join(' | ') + ' |\n';

  const rowsToProcess = rows.slice(1, maxRows + 1);
  for (const row of rowsToProcess) {
    const padded: string[] = [];
    for (let c = 0; c < colCount; c++) {
      const cellVal = (row[c] ?? '').toString().replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
      padded.push(cellVal);
    }
    md += '| ' + padded.join(' | ') + ' |\n';
  }

  if (rows.length > maxRows + 1) {
    md += `\n*(Showing first ${maxRows} rows of ${rows.length - 1} records)*\n`;
  }

  return md;
}

/**
 * Extracts plain text from PPTX drawing/presentation XML fragments
 */
function extractPptxXmlText(xml: string): string {
  const pMatches = xml.split(/<\/a:p>/gi);
  const paragraphs: string[] = [];
  for (const p of pMatches) {
    const textMatches: string[] = [];
    const tRegex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/gi;
    let m: RegExpExecArray | null;
    while ((m = tRegex.exec(p)) !== null) {
      textMatches.push(m[1]);
    }
    const pText = textMatches.join('').trim();
    if (pText) paragraphs.push(pText);
  }
  return paragraphs.join('\n');
}

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
    return res.status(401).json({ error: 'Unauthorized. Please sign in to extract document content.' });
  }

  let pdfParser: any = null;

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
        error: 'Access denied: Document does not belong to the authenticated user.',
      });
    }

    // 4. Download file from Supabase Storage into buffer
    const relativePath = storagePath.slice('pdfs/'.length);
    const supabase = getSupabaseAdmin();
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(relativePath);

    if (downloadError || !fileBlob) {
      console.error('[Supabase Storage Download Error]:', downloadError);
      return res.status(404).json({
        error: 'Failed to retrieve document from storage.',
        details: downloadError?.message,
      });
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Server-side format detection via magic bytes & structural inspection
    const detected = await detectDocumentFormat(buffer, fileName);
    if (!detected) {
      return res.status(400).json({
        error: "This file format is not supported or the document is corrupted. Please upload a valid PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx), or CSV (.csv) file.",
      });
    }

    let cleanText = '';
    let numPages = 1;
    const format = detected.format;

    // 6. Format-specific extraction
    if (format === 'docx') {
      // Word extraction via mammoth: preserves headings, paragraphs, and tables as Markdown
      try {
        const mammothAny = mammoth as any;
        const result =
          typeof mammothAny.convertToMarkdown === 'function'
            ? await mammothAny.convertToMarkdown({ buffer })
            : await mammoth.extractRawText({ buffer });
        cleanText = (result.value || '').trim();

        // Fallback to extractRawText if markdown is completely empty
        if (!cleanText) {
          const rawResult = await mammoth.extractRawText({ buffer });
          cleanText = (rawResult.value || '').trim();
        }
      } catch (err: any) {
        return res.status(422).json({
          error: "We couldn't read this Word document properly. Try re-saving it or exporting as PDF.",
          details: err.message,
        });
      }
    } else if (format === 'pptx') {
      // PowerPoint extraction: slides sorted in numerical sequence with slide text and speaker notes
      try {
        const zip = detected.zipInstance || (await JSZip.loadAsync(buffer));
        const slideFiles = Object.keys(zip.files)
          .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
          .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
            const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
            return numA - numB;
          });

        if (slideFiles.length === 0) {
          throw new Error('No slides found inside PowerPoint presentation.');
        }

        numPages = slideFiles.length;
        const slideOutputs: string[] = [];

        for (let idx = 0; idx < slideFiles.length; idx++) {
          const sFile = slideFiles[idx];
          const slideNum = idx + 1;
          const slideXml = await zip.file(sFile)!.async('string');
          const slideText = extractPptxXmlText(slideXml);

          // Check if speaker notes exist for this slide
          const notesFile = `ppt/notesSlides/notesSlide${slideNum}.xml`;
          let notesText = '';
          const notesEntry = zip.file(notesFile);
          if (notesEntry) {
            const notesXml = await notesEntry.async('string');
            notesText = extractPptxXmlText(notesXml);
          }

          let slideBlock = `### Slide ${slideNum}\n${slideText || '(No text content)'}`;
          if (notesText) {
            slideBlock += `\n\n*Speaker Notes:*\n${notesText}`;
          }
          slideOutputs.push(slideBlock);
        }

        cleanText = slideOutputs.join('\n\n---\n\n');
      } catch (err: any) {
        return res.status(422).json({
          error: "We couldn't read this PowerPoint presentation properly. Try re-saving it or exporting as PDF.",
          details: err.message,
        });
      }
    } else if (format === 'xlsx' || format === 'csv') {
      // Excel and CSV extraction: table-aware extraction preserving sheet names, rows, and columns
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        numPages = workbook.SheetNames.length || 1;
        const sheetBlocks: string[] = [];

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) continue;

          const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false,
            defval: '',
          });

          // Filter out completely blank rows
          const nonEmptyRows = rows.filter((r) => r.some((c) => (c ?? '').toString().trim().length > 0));
          if (nonEmptyRows.length === 0) continue;

          const tableMarkdown = rowsToMarkdownTable(nonEmptyRows);
          sheetBlocks.push(`## Sheet: ${sheetName}\n\n${tableMarkdown}`);
        }

        cleanText = sheetBlocks.join('\n\n---\n\n').trim();
      } catch (err: any) {
        return res.status(422).json({
          error: "We couldn't parse this spreadsheet properly. Please check that it contains valid tabular data.",
          details: err.message,
        });
      }
    } else if (format === 'pdf') {
      // PDF extraction via pdf-parse
      try {
        const { PDFParse } = await import('pdf-parse');
        pdfParser = new PDFParse({ data: buffer });
        const textResult = await pdfParser.getText();

        cleanText = (textResult.text || '')
          .replace(/\r\n/g, '\n')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        numPages = textResult.pages?.length || 1;
      } catch (parserErr: any) {
        return res.status(422).json({
          error: "We couldn't read this PDF's text properly. Try re-exporting it, or use Notes OCR instead.",
          details: parserErr.message,
        });
      }
    }

    // 7. Normalize text
    cleanText = cleanText
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // 8. Strict text quality assessment across all formats
    const quality = isTextReadable(cleanText);
    if (!quality.readable) {
      return res.status(422).json({
        error: "We couldn't read this document's text properly. Try re-exporting it, or use Notes OCR instead.",
        details: quality.reason,
      });
    }

    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

    return res.status(200).json({
      success: true,
      text: cleanText,
      numPages,
      format,
      fileName: fileName || `Document.${format}`,
      wordCount,
      info: {},
    });
  } catch (error: any) {
    console.error('[Document Extraction Error]', error);
    return res.status(500).json({
      error: 'Failed to extract text from document',
      details: error.message,
    });
  } finally {
    if (pdfParser && typeof pdfParser.destroy === 'function') {
      await pdfParser.destroy().catch(() => {});
    }
  }
}
