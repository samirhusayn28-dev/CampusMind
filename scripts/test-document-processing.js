import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import * as XLSX from '../backend/node_modules/xlsx/xlsx.mjs';
import JSZip from '../backend/node_modules/jszip/dist/jszip.min.js';

// Regex matching acceptable human-readable characters across all languages:
const READABLE_CHAR_REGEX = /^[\p{L}\p{N}\p{P}\p{S}\s]$/u;
const ALPHANUMERIC_CHAR_REGEX = /[\p{L}\p{N}]/u;
const MARKDOWN_TOKEN_REGEX = /^(\|+|-+|\*+|\++|#+|>+|={2,}|_{2,}|:?-+:?)$/;

function backendIsTextReadable(text) {
  if (!text || typeof text !== 'string') return { readable: false, reason: 'empty' };
  const trimmed = text.trim();
  if (trimmed.length < 20) return { readable: false, reason: 'length < 20' };

  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(trimmed)) {
    return { readable: false, reason: 'Text contains illegal binary control characters.' };
  }

  let readableCount = 0;
  let replacementCount = 0;
  const totalCount = trimmed.length;

  for (let i = 0; i < totalCount; i++) {
    const char = trimmed[i];
    if (char === '\uFFFD') replacementCount++;
    if (READABLE_CHAR_REGEX.test(char)) readableCount++;
  }

  const readableRatio = readableCount / totalCount;
  const replacementRatio = replacementCount / totalCount;

  if (readableRatio < 0.65) return { readable: false, reason: 'low readable ratio' };
  if (replacementRatio > 0.03) return { readable: false, reason: 'high replacement ratio' };

  const cidMatches = (trimmed.match(/\(?cid:\s*\d+\)?/gi) || []).length;
  if (cidMatches >= 3 && (cidMatches * 7) / totalCount > 0.15) {
    return { readable: false, reason: 'unmapped CID glyphs' };
  }

  const latin1Count = (trimmed.match(/[\u0080-\u00FF]/g) || []).length;
  if (latin1Count / totalCount > 0.08) {
    return { readable: false, reason: 'high Latin-1 supplement ratio (mojibake binary noise)' };
  }

  const interleavedNoise = (trimmed.match(/[\p{L}][0-9][\p{L}]|[0-9][\p{L}][0-9]|[\u0080-\u00FF][\p{P}\p{S}]/gu) || []).length;
  if (interleavedNoise >= 2 && (interleavedNoise * 2) / totalCount > 0.05) {
    return { readable: false, reason: 'interleaved binary noise' };
  }

  const words = trimmed.split(/\s+/).filter((w) => w.length >= 1);
  if (words.length >= 1) {
    const coherentWords = words.filter(
      (w) => ALPHANUMERIC_CHAR_REGEX.test(w) || MARKDOWN_TOKEN_REGEX.test(w)
    ).length;
    if (coherentWords / words.length < 0.5) {
      return { readable: false, reason: 'low word coherence' };
    }
  }

  return { readable: true };
}

console.log('====================================================');
console.log('  CAMPUSMIND END-TO-END DOCUMENT PROCESSING TEST SUITE');
console.log('====================================================\n');

let allPassed = true;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    allPassed = false;
  }
}

// Client extraction functions (exact logic from clientDocumentExtractor.ts)
function parseCsvToMarkdownTable(csvText, maxRows = 300) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return '';

  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  let delimiter = ',';
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
  else if (semiCount > commaCount) delimiter = ';';

  const parseLine = (line) => {
    const result = [];
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
    const cells = [];
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

async function extractDocxFromBase64(base64) {
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const docEntry = zip.file('word/document.xml');
  if (!docEntry) throw new Error('Invalid Word document: missing word/document.xml');

  const xml = await docEntry.async('string');
  const tblRegex = /<w:tbl[\s\S]*?<\/w:tbl>/g;
  const blocks = [];
  let lastIdx = 0;
  let match;

  function extractParas(chunk) {
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
      const texts = [];
      let tm;
      while ((tm = tRegex.exec(p)) !== null) {
        texts.push(tm[1]);
      }
      const fullText = texts.join('').trim();
      if (fullText) {
        blocks.push(prefix + fullText);
      }
    }
  }

  function extractTable(tblXml) {
    const rowMatches = tblXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
    const tableRows = [];
    for (const r of rowMatches) {
      const cellMatches = r.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
      const cells = [];
      for (const c of cellMatches) {
        const tRegex = /<w:t(?:\s+[^>]*|>)([\s\S]*?)<\/w:t>/gi;
        const cTexts = [];
        let tm;
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

async function extractPptxFromBase64(base64) {
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

  const parsePptxText = (xml) => {
    const pMatches = xml.split(/<\/a:p>/gi);
    const paragraphs = [];
    for (const p of pMatches) {
      const textMatches = [];
      const tRegex = /<a:t(?:\s+[^>]*|>)([\s\S]*?)<\/a:t>/gi;
      let m;
      while ((m = tRegex.exec(p)) !== null) {
        textMatches.push(m[1]);
      }
      const pText = textMatches.join('').trim();
      if (pText) paragraphs.push(pText);
    }
    return paragraphs.join('\n');
  };

  const slideOutputs = [];
  for (let idx = 0; idx < slideFiles.length; idx++) {
    const sFile = slideFiles[idx];
    const slideNum = idx + 1;
    const slideXml = await zip.file(sFile).async('string');
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

async function extractXlsxFromBase64(base64) {
  const zip = await JSZip.loadAsync(base64, { base64: true });

  const sstEntry = zip.file('xl/sharedStrings.xml') || zip.file('xl/sharedstrings.xml');
  const sharedStrings = [];
  if (sstEntry) {
    const sstXml = await sstEntry.async('string');
    const siMatches = sstXml.split(/<\/si>/);
    for (const si of siMatches) {
      if (!si.trim()) continue;
      const tMatches = [];
      const tRegex = /<t(?:\s+[^>]*|>)([\s\S]*?)<\/t>/gi;
      let tm;
      while ((tm = tRegex.exec(si)) !== null) {
        tMatches.push(tm[1]);
      }
      sharedStrings.push(tMatches.join(''));
    }
  }

  const wbEntry = zip.file('xl/workbook.xml');
  const sheets = [];
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

  const sheetOutputs = [];
  let sheetIdx = 1;
  while (true) {
    const wsEntry = zip.file(`xl/worksheets/sheet${sheetIdx}.xml`);
    if (!wsEntry) break;
    const wsXml = await wsEntry.async('string');
    const rowMatches = wsXml.match(/<row[\s\S]*?<\/row>/g) || [];
    const rows = [];

    for (const r of rowMatches) {
      const cMatches = r.match(/<c[\s\S]*?<\/c>|<c[^\/>]*\/>/g) || [];
      const cells = [];
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

// ---------------------------------------------------------------------
// TEST 1: CSV Processing (Table-Aware Markdown)
// ---------------------------------------------------------------------
console.log('\n--- TEST 1: CSV Extraction ---');
const sampleCsv = `Subject,Exam Date,Credits,Grade
Calculus III,2026-11-15,4,A
Organic Chemistry,2026-11-18,4,A-
Computer Architecture,2026-11-22,3,A+
World History,2026-11-25,3,B+`;

const csvMarkdown = parseCsvToMarkdownTable(sampleCsv);
assert(csvMarkdown.includes('| Subject | Exam Date | Credits | Grade |'), 'CSV headers converted to Markdown table header');
assert(csvMarkdown.includes('| Calculus III | 2026-11-15 | 4 | A |'), 'CSV row values preserved in Markdown cells');
const csvQuality = backendIsTextReadable(csvMarkdown);
assert(csvQuality.readable === true, 'CSV extracted text passes text readability checks');

// ---------------------------------------------------------------------
// TEST 2: Word DOCX Processing (Headings, Paragraphs, Tables)
// ---------------------------------------------------------------------
console.log('\n--- TEST 2: Word DOCX Extraction ---');
const tableDocxPath = path.resolve('backend/node_modules/mammoth/test/test-data/tables.docx');
const tableDocxBuffer = fs.readFileSync(tableDocxPath);
const tableDocxB64 = tableDocxBuffer.toString('base64');

const docxResult = await extractDocxFromBase64(tableDocxB64);
assert(docxResult.includes('Above'), 'Paragraphs extracted from DOCX');
assert(docxResult.includes('| Top left | Top right |'), 'Table cells extracted into Markdown table in DOCX');
assert(docxResult.includes('Below'), 'Following paragraphs preserved in DOCX');
const docxQuality = backendIsTextReadable(docxResult);
assert(docxQuality.readable === true, 'DOCX extracted text passes readability checks');

// ---------------------------------------------------------------------
// TEST 3: PowerPoint PPTX Processing (Slides, Titles, Notes)
// ---------------------------------------------------------------------
console.log('\n--- TEST 3: PowerPoint PPTX Extraction ---');
const pptxZip = new JSZip();
pptxZip.file('[Content_Types].xml', '<Types></Types>');
pptxZip.file('ppt/presentation.xml', '<p:presentation></p:presentation>');

const slide1Xml = `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:sp>
    <p:txBody><a:p><a:r><a:t>Introduction to Neurobiology</a:t></a:r></a:p></p:txBody>
  </p:sp><p:sp>
    <p:txBody>
      <a:p><a:r><a:t>Action Potential Propagation</a:t></a:r></a:p>
      <a:p><a:r><a:t>Synaptic Neurotransmission</a:t></a:r></a:p>
    </p:txBody>
  </p:sp></p:spTree></p:cSld>
</p:sld>`;

const notes1Xml = `<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:txBody><a:p><a:r><a:t>Focus on sodium-potassium ATPase pump in midterm review.</a:t></a:r></a:p></p:txBody>
</p:notes>`;

pptxZip.file('ppt/slides/slide1.xml', slide1Xml);
pptxZip.file('ppt/notesSlides/notesSlide1.xml', notes1Xml);

const pptxBuffer = await pptxZip.generateAsync({ type: 'nodebuffer' });
const pptxResult = await extractPptxFromBase64(pptxBuffer.toString('base64'));

assert(pptxResult.numSlides === 1, 'PPTX slide count detected correctly');
assert(pptxResult.text.includes('### Slide 1'), 'PPTX slide header generated');
assert(pptxResult.text.includes('Introduction to Neurobiology'), 'PPTX slide title extracted');
assert(pptxResult.text.includes('Action Potential Propagation'), 'PPTX body content extracted');
assert(pptxResult.text.includes('*Speaker Notes:*'), 'PPTX speaker notes header generated');
assert(pptxResult.text.includes('sodium-potassium ATPase pump'), 'PPTX speaker notes content extracted');
const pptxQuality = backendIsTextReadable(pptxResult.text);
assert(pptxQuality.readable === true, 'PPTX extracted text passes readability checks');

// ---------------------------------------------------------------------
// TEST 4: Excel XLSX Processing (Worksheets, Shared Strings, Tables)
// ---------------------------------------------------------------------
console.log('\n--- TEST 4: Excel XLSX Extraction ---');
const wb = XLSX.utils.book_new();
const ws1Data = [
  ['Student Name', 'Assignment 1', 'Midterm Exam', 'Final Grade'],
  ['Evelyn Adams', '98', '94', 'A'],
  ['Marcus Vance', '85', '88', 'B+'],
  ['Sarah Lin', '92', '90', 'A-']
];
const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
XLSX.utils.book_append_sheet(wb, ws1, 'Course Roster');

const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
const xlsxResult = await extractXlsxFromBase64(xlsxBuf.toString('base64'));

assert(xlsxResult.numSheets >= 1, 'XLSX sheet count detected correctly');
assert(xlsxResult.text.includes('## Sheet: Course Roster'), 'XLSX sheet title extracted');
assert(xlsxResult.text.includes('| Student Name | Assignment 1 | Midterm Exam | Final Grade |'), 'XLSX table header formatted');
assert(xlsxResult.text.includes('| Evelyn Adams | 98 | 94 | A |'), 'XLSX row data formatted');
const xlsxQuality = backendIsTextReadable(xlsxResult.text);
assert(xlsxQuality.readable === true, 'XLSX extracted text passes readability checks');

// ---------------------------------------------------------------------
// TEST 5: PDF Processing via pdfjs-dist Legacy (Clean Decompression, NO Binary Garbage)
// ---------------------------------------------------------------------
console.log('\n--- TEST 5: PDF Decompression & Garbage Elimination ---');
const pdfjsLib = await import('../backend/node_modules/pdfjs-dist/legacy/build/pdf.mjs');

// Create a FlateDecode (zlib-compressed) PDF
const streamData = zlib.deflateSync(Buffer.from('BT /F1 14 Tf 72 712 Td (Advanced Artificial Intelligence and Machine Learning Lecture Notes) Tj ET'));
const compressedPdf = Buffer.concat([
  Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj\n4 0 obj<</Filter/FlateDecode/Length ' + streamData.length + '>>stream\n'),
  streamData,
  Buffer.from('\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000212 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n' + (300 + streamData.length) + '\n%%EOF')
]);

const doc = await pdfjsLib.getDocument({
  data: new Uint8Array(compressedPdf),
  useSystemFonts: true,
  disableFontFace: true,
}).promise;

assert(doc.numPages === 1, 'PDF page count detected');
const page1 = await doc.getPage(1);
const textContent = await page1.getTextContent();
const pdfExtractedText = textContent.items.map((i) => i.str).join(' ').trim();

assert(pdfExtractedText.includes('Advanced Artificial Intelligence and Machine Learning Lecture Notes'), 'Decompressed FlateDecode stream text accurately');
assert(!pdfExtractedText.includes('Ù9'), 'Zero corrupted binary characters (no Ù9)');
assert(!pdfExtractedText.includes('Ã'), 'Zero corrupted binary characters (no Ã)');
assert(!pdfExtractedText.includes('Ø'), 'Zero corrupted binary characters (no Ø)');
const pdfQuality = backendIsTextReadable(pdfExtractedText);
assert(pdfQuality.readable === true, 'PDF extracted text passes readability checks');

// ---------------------------------------------------------------------
// TEST 6: Scanned / Empty PDF Rejection (Clear OCR Recommendation)
// ---------------------------------------------------------------------
console.log('\n--- TEST 6: Scanned / Empty PDF Handling ---');
const emptyPdf = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj\n4 0 obj<</Length 0>>stream\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000212 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n260\n%%EOF'
);

const emptyDoc = await pdfjsLib.getDocument({
  data: new Uint8Array(emptyPdf),
  useSystemFonts: true,
  disableFontFace: true,
}).promise;

const emptyPage = await emptyDoc.getPage(1);
const emptyContent = await emptyPage.getTextContent();
const emptyText = emptyContent.items.map((i) => i.str).join(' ').trim();
const emptyQuality = backendIsTextReadable(emptyText);
assert(emptyQuality.readable === false, 'Scanned/Empty PDF text correctly rejected by quality assessment');

// ---------------------------------------------------------------------
// TEST 7: Corrupted Binary Garbage Rejection Test
// ---------------------------------------------------------------------
console.log('\n--- TEST 7: Corrupted Binary Garbage Rejection ---');
const binaryGarbage = 'Ù9ÃØ§12â?§â??Ù?Ù?Ã¥Ã« Ù8Ã9Ã? Â©';
const garbageQuality = backendIsTextReadable(binaryGarbage);
assert(garbageQuality.readable === false, 'Binary stream garbage string rejected with high non-printable ratio');

console.log('\n====================================================');
if (allPassed) {
  console.log('  🎉 ALL 7 DOCUMENT PROCESSING TESTS PASSED!');
  console.log('====================================================\n');
  process.exit(0);
} else {
  console.error('  💥 SOME TESTS FAILED.');
  console.log('====================================================\n');
  process.exit(1);
}
