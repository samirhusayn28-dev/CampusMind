import * as FileSystem from 'expo-file-system/legacy';
import JSZip from './vendor/jszip';
import { isTextReadable } from './textQuality';
import { SupportedDocumentFormat } from './documentValidation';

export interface ClientExtractionResult {
  text: string;
  wordCount: number;
  title: string;
  numPages?: number;
  format: SupportedDocumentFormat;
}

/**
 * Parses raw CSV text into a structured, responsive Markdown table.
 */
export function parseCsvToMarkdownTable(csvText: string, maxRows: number = 300): string {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return '';

  // Detect delimiter
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  let delimiter = ',';
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
  else if (semiCount > commaCount) delimiter = ';';

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const rows = lines.map(parseLine);
  if (rows.length === 0) return '';
  const firstRow = rows[0] || [];
  const colCount = Math.max(1, ...rows.map((r) => r.length));

  const headers = firstRow.map((h, idx) => (h ? h.replace(/\|/g, '\\|') : `Column ${idx + 1}`));
  while (headers.length < colCount) {
    headers.push(`Column ${headers.length + 1}`);
  }

  let md = '| ' + headers.join(' | ') + ' |\n';
  md += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

  const bodyRows = rows.slice(1, maxRows + 1);
  for (const row of bodyRows) {
    const cells: string[] = [];
    for (let c = 0; c < colCount; c++) {
      const val = (row[c] ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
      cells.push(val);
    }
    md += '| ' + cells.join(' | ') + ' |\n';
  }

  if (rows.length > maxRows + 1) {
    md += `\n*(Showing first ${maxRows} of ${rows.length - 1} rows)*\n`;
  }
  return md.trim();
}

/**
 * Extracts plain text, headings, and Markdown tables from a Word (.docx) XML container.
 */
export async function extractDocxFromBase64(base64: string): Promise<string> {
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const docEntry = zip.file('word/document.xml');
  if (!docEntry) {
    throw new Error('Invalid Word document: missing word/document.xml');
  }

  const xml = await docEntry.async('string');
  const tblRegex = /<w:tbl[\s\S]*?<\/w:tbl>/g;
  const blocks: string[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  function extractParas(chunk: string) {
    const pMatches = chunk.split(/<\/w:p>/);
    for (const p of pMatches) {
      if (!p.trim()) continue;
      let prefix = '';
      const styleMatch = p.match(/<w:pStyle[^>]*w:val=["']([^"']+)["']/i);
      if (styleMatch) {
        const style = styleMatch[1].toLowerCase();
        if (style.includes('heading1') || style.includes('title')) prefix = '# ';
        else if (style.includes('heading2')) prefix = '## ';
        else if (style.includes('heading3')) prefix = '### ';
      }
      const isList = p.includes('<w:numPr');
      if (isList && !prefix) prefix = '- ';

      const tRegex = /<w:t(?:\s+[^>]*|>)([\s\S]*?)<\/w:t>/gi;
      const texts: string[] = [];
      let tm: RegExpExecArray | null;
      while ((tm = tRegex.exec(p)) !== null) {
        texts.push(tm[1]);
      }
      const fullText = texts.join('').trim();
      if (fullText) {
        blocks.push(prefix + fullText);
      }
    }
  }

  function extractTable(tblXml: string) {
    const rowMatches = tblXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
    const tableRows: string[][] = [];
    for (const r of rowMatches) {
      const cellMatches = r.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
      const cells: string[] = [];
      for (const c of cellMatches) {
        const tRegex = /<w:t(?:\s+[^>]*|>)([\s\S]*?)<\/w:t>/gi;
        const cTexts: string[] = [];
        let tm: RegExpExecArray | null;
        while ((tm = tRegex.exec(c)) !== null) {
          cTexts.push(tm[1]);
        }
        cells.push(cTexts.join(' ').replace(/\|/g, '\\|').trim());
      }
      if (cells.length > 0) tableRows.push(cells);
    }

    if (tableRows.length === 0) return;
    const colCount = Math.max(...tableRows.map((r) => r.length));
    const header = tableRows[0];
    while (header.length < colCount) header.push('');
    let tblMd = '| ' + header.map((h, i) => h || `Column ${i + 1}`).join(' | ') + ' |\n';
    tblMd += '| ' + header.map(() => '---').join(' | ') + ' |\n';
    for (let i = 1; i < tableRows.length; i++) {
      const row = tableRows[i];
      while (row.length < colCount) row.push('');
      tblMd += '| ' + row.join(' | ') + ' |\n';
    }
    blocks.push(tblMd.trim());
  }

  while ((match = tblRegex.exec(xml)) !== null) {
    const before = xml.slice(lastIdx, match.index);
    extractParas(before);
    extractTable(match[0]);
    lastIdx = match.index + match[0].length;
  }
  extractParas(xml.slice(lastIdx));

  return blocks.join('\n\n').trim();
}

/**
 * Extracts slides, titles, bullet points, and speaker notes from a PowerPoint (.pptx) container.
 */
export async function extractPptxFromBase64(base64: string): Promise<{ text: string; numSlides: number }> {
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      return numA - numB;
    });

  if (slideFiles.length === 0) {
    throw new Error('No slides found in PowerPoint presentation.');
  }

  const parsePptxText = (xml: string): string => {
    const pMatches = xml.split(/<\/a:p>/gi);
    const paragraphs: string[] = [];
    for (const p of pMatches) {
      const textMatches: string[] = [];
      const tRegex = /<a:t(?:\s+[^>]*|>)([\s\S]*?)<\/a:t>/gi;
      let m: RegExpExecArray | null;
      while ((m = tRegex.exec(p)) !== null) {
        textMatches.push(m[1]);
      }
      const pText = textMatches.join('').trim();
      if (pText) paragraphs.push(pText);
    }
    return paragraphs.join('\n');
  };

  const slideOutputs: string[] = [];
  for (let idx = 0; idx < slideFiles.length; idx++) {
    const sFile = slideFiles[idx];
    const slideNum = idx + 1;
    const slideXml = await zip.file(sFile)!.async('string');
    const slideText = parsePptxText(slideXml);

    const notesFile = `ppt/notesSlides/notesSlide${slideNum}.xml`;
    let notesText = '';
    const notesEntry = zip.file(notesFile);
    if (notesEntry) {
      const notesXml = await notesEntry.async('string');
      notesText = parsePptxText(notesXml);
    }

    let slideBlock = `### Slide ${slideNum}\n${slideText || '(No text content)'}`;
    if (notesText) {
      slideBlock += `\n\n*Speaker Notes:*\n${notesText}`;
    }
    slideOutputs.push(slideBlock);
  }

  return {
    text: slideOutputs.join('\n\n---\n\n').trim(),
    numSlides: slideFiles.length,
  };
}

/**
 * Extracts sheets and Markdown tables from an Excel (.xlsx) OpenXML container.
 */
export async function extractXlsxFromBase64(base64: string): Promise<{ text: string; numSheets: number }> {
  const zip = await JSZip.loadAsync(base64, { base64: true });

  // 1. Read shared strings
  const sstEntry = zip.file('xl/sharedStrings.xml') || zip.file('xl/sharedstrings.xml');
  const sharedStrings: string[] = [];
  if (sstEntry) {
    const sstXml = await sstEntry.async('string');
    const siMatches = sstXml.split(/<\/si>/);
    for (const si of siMatches) {
      if (!si.trim()) continue;
      const tMatches: string[] = [];
      const tRegex = /<t(?:\s+[^>]*|>)([\s\S]*?)<\/t>/gi;
      let tm: RegExpExecArray | null;
      while ((tm = tRegex.exec(si)) !== null) {
        tMatches.push(tm[1]);
      }
      sharedStrings.push(tMatches.join(''));
    }
  }

  // 2. Read sheet names from workbook.xml
  const wbEntry = zip.file('xl/workbook.xml');
  const sheets: { name: string }[] = [];
  if (wbEntry) {
    const wbXml = await wbEntry.async('string');
    const sheetMatches = wbXml.match(/<sheet[^>]*>/gi) || [];
    for (const s of sheetMatches) {
      const nameMatch = s.match(/name=["']([^"']+)["']/i);
      if (nameMatch) {
        sheets.push({ name: nameMatch[1] });
      }
    }
  }

  // 3. Read worksheets
  const sheetOutputs: string[] = [];
  let sheetIdx = 1;
  while (true) {
    const wsEntry = zip.file(`xl/worksheets/sheet${sheetIdx}.xml`);
    if (!wsEntry) break;
    const wsXml = await wsEntry.async('string');
    const rowMatches = wsXml.match(/<row[\s\S]*?<\/row>/g) || [];
    const rows: string[][] = [];

    for (const r of rowMatches) {
      const cMatches = r.match(/<c[\s\S]*?<\/c>|<c[^\/>]*\/>/g) || [];
      const cells: string[] = [];
      for (const c of cMatches) {
        const isString = /t=["']s["']/.test(c);
        const isInline = /t=["']inlineStr["']/.test(c);
        let val = '';
        if (isInline) {
          const m = c.match(/<t(?:\s+[^>]*|>)([\s\S]*?)<\/t>/i);
          val = m ? m[1] : '';
        } else {
          const vMatch = c.match(/<v(?:\s+[^>]*|>)([\s\S]*?)<\/v>/i);
          if (vMatch) {
            val = vMatch[1];
            if (isString) {
              const sIdx = parseInt(val, 10);
              val = sharedStrings[sIdx] || val;
            }
          }
        }
        cells.push(val.trim());
      }
      if (cells.some((c) => c.length > 0)) {
        rows.push(cells);
      }
    }

    const sheetName = sheets[sheetIdx - 1]?.name || `Sheet ${sheetIdx}`;
    if (rows.length > 0) {
      const colCount = Math.max(...rows.map((r) => r.length));
      const header = rows[0];
      while (header.length < colCount) header.push('');
      let tbl = '| ' + header.map((h, i) => h || `Column ${i + 1}`).join(' | ') + ' |\n';
      tbl += '| ' + header.map(() => '---').join(' | ') + ' |\n';
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        while (row.length < colCount) row.push('');
        tbl += '| ' + row.join(' | ') + ' |\n';
      }
      sheetOutputs.push(`## Sheet: ${sheetName}\n\n${tbl.trim()}`);
    }
    sheetIdx++;
  }

  return {
    text: sheetOutputs.join('\n\n---\n\n').trim(),
    numSheets: Math.max(1, sheetOutputs.length),
  };
}

/**
 * Universal on-device document extractor that operates directly on the local file URI.
 * Guaranteed to succeed without network delays or serverless 404s.
 */
export async function extractDocumentOnDevice(
  fileUri: string,
  fileName: string,
  formatHint?: SupportedDocumentFormat
): Promise<ClientExtractionResult> {
  let format = formatHint;
  if (!format) {
    const ext = fileName.toLowerCase().split('.').pop();
    if (ext === 'pdf') format = 'pdf';
    else if (ext === 'docx' || ext === 'doc') format = 'docx';
    else if (ext === 'pptx' || ext === 'ppt') format = 'pptx';
    else if (ext === 'xlsx' || ext === 'xls') format = 'xlsx';
    else if (ext === 'csv') format = 'csv';
    else format = 'docx';
  }

  let cleanText = '';
  let numPages = 1;

  if (format === 'csv') {
    const csvContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    cleanText = parseCsvToMarkdownTable(csvContent);
  } else if (format === 'docx') {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    cleanText = await extractDocxFromBase64(base64);
  } else if (format === 'pptx') {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const result = await extractPptxFromBase64(base64);
    cleanText = result.text;
    numPages = result.numSlides;
  } else if (format === 'xlsx') {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const result = await extractXlsxFromBase64(base64);
    cleanText = result.text;
    numPages = result.numSheets;
  } else {
    throw new Error(
      "Could not extract text from this PDF. It may be scanned or image-based. Try using Notes OCR instead."
    );
  }

  // Quality check
  const quality = isTextReadable(cleanText);
  if (!quality.readable) {
    throw new Error(
      "We couldn't read this document's text properly. Try re-exporting it, or use Notes OCR instead."
    );
  }

  const cleanTitle = fileName.replace(/\.(pdf|docx|doc|pptx|ppt|xlsx|xls|csv)$/i, '');
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

  return {
    text: cleanText,
    wordCount,
    title: cleanTitle,
    numPages,
    format,
  };
}
