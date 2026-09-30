import type { VercelRequest, VercelResponse } from '@vercel/node';
import JSZip from 'jszip';
import { createClient } from '@supabase/supabase-js';
import { isTextReadable } from '../_utils/quality.js';

// Server-side Supabase client using environment variables
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase Storage is not configured on the server (missing env variables).');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds a valid Microsoft Word .docx OpenXML package using JSZip
 */
function buildDocxBuffer(title: string, text: string): Promise<Buffer> {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  // 3. word/_rels/document.xml.rels
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  // 4. word/styles.xml
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="2B579A"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="365F91"/></w:rPr>
  </w:style>
</w:styles>`
  );

  // 5. Convert lines & markdown tables into WordprocessingML
  const lines = text.split('\n');
  let bodyXml = '';

  // Title header paragraph
  bodyXml += `
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>${escapeXml(title)}</w:t></w:r>
    </w:p>`;

  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    bodyXml += '<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="E0E0E0"/><w:insideV w:val="none"/></w:tblBorders></w:tblPr>';
    tableRows.forEach((row, rIdx) => {
      bodyXml += '<w:tr>';
      row.forEach((cell) => {
        const isHeader = rIdx === 0;
        bodyXml += `<w:tc><w:p><w:pPr>${isHeader ? '<w:jc w:val="left"/>' : ''}</w:pPr><w:r>${isHeader ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t>${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`;
      });
      bodyXml += '</w:tr>';
    });
    bodyXml += '</w:tbl>';
    tableRows = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Markdown Table Row detection
    if (line.startsWith('|') && line.endsWith('|')) {
      // Skip markdown separator row |---|---|
      if (line.match(/^\|[\s\-:|]+\|$/)) {
        continue;
      }
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      inTable = true;
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (!line) {
      bodyXml += '<w:p/>';
      continue;
    }

    if (line.startsWith('# ')) {
      const heading = line.slice(2).trim();
      bodyXml += `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escapeXml(heading)}</w:t></w:r></w:p>`;
    } else if (line.startsWith('## ') || line.startsWith('### ')) {
      const heading = line.replace(/^#+\s*/, '').trim();
      bodyXml += `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>${escapeXml(heading)}</w:t></w:r></w:p>`;
    } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      const bullet = line.slice(2).trim();
      bodyXml += `<w:p><w:pPr><w:ind w:left="360"/></w:pPr><w:r><w:t>• ${escapeXml(bullet)}</w:t></w:r></w:p>`;
    } else {
      bodyXml += `<w:p><w:r><w:t>${escapeXml(rawLine)}</w:t></w:r></w:p>`;
    }
  }

  if (inTable) {
    flushTable();
  }

  // 6. word/document.xml
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr/>
  </w:body>
</w:document>`
  );

  return zip.generateAsync({
    type: 'nodebuffer',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { title, subject, text, userId } = req.body || {};

    if (!text || typeof text !== 'string' || text.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Edited content must contain at least 20 characters of readable study text.',
      });
    }

    const qualityCheck = isTextReadable(text);
    if (!qualityCheck.readable) {
      return res.status(400).json({
        success: false,
        error: qualityCheck.reason || 'The text contains unreadable or garbled characters.',
      });
    }

    const docTitle = typeof title === 'string' && title.trim() ? title.trim() : 'Study Document';
    const cleanSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : 'General Studies';
    const effectiveUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : 'user_anonymous';

    // 1. Build .docx buffer
    const docxBuffer = await buildDocxBuffer(docTitle, text);

    // 2. Sanitize file name
    const sanitizedTitle = docTitle.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
    const fileName = `${sanitizedTitle || 'Study_Document'}_Edited.docx`;
    const storagePath = `documents/${Date.now()}_${fileName}`;

    // 3. Upload to Supabase Storage
    const supabase = getSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, docxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      });

    if (uploadError) {
      console.error('[Supabase Storage Upload Error]', uploadError);
      return res.status(500).json({
        success: false,
        error: `Could not save document to storage: ${uploadError.message}`,
      });
    }

    // 4. Calculate word count
    const words = text.trim().split(/\s+/).filter(Boolean);

    return res.status(200).json({
      success: true,
      storagePath,
      fileName,
      title: docTitle,
      subject: cleanSubject,
      extractedText: text.trim(),
      wordCount: words.length,
      format: 'docx',
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Export DOCX Error]', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred while exporting the edited document.',
    });
  }
}
